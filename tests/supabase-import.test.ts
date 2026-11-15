import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { hash } from 'bcryptjs';
import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';
import { importUsers, parseSnapshot } from '../scripts/supabase-import.ts';
import { passwordOptions } from '../src/lib/server/password.ts';

const id = '11111111-1111-4111-8111-111111111111';
function docker(...args: string[]) { return execFileSync('docker', args, { encoding: 'utf8' }).trim(); }

test('Supabase import preserves credentials and safely replaces matching destination accounts', async t => {
	const container = docker('run', '--rm', '--detach', '--publish', '127.0.0.1::5432',
		'--env', 'POSTGRES_PASSWORD=import_test', 'postgres:17-alpine');
	const port = Number(docker('port', container, '5432/tcp').split(':').at(-1));
	const database = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'import_test', connectionTimeoutMillis: 1000 });
	try {
		for (let attempt = 0; ; attempt++) {
			try { await database.query('select 1'); break; }
			catch (error) { if (attempt === 59) throw error; await setTimeout(250); }
		}
		const options = { database, baseURL: 'http://localhost:3000', secret: 'import-test-secret-at-least-32-characters',
			emailAndPassword: { enabled: true, password: passwordOptions }, logger: { disabled: true } };
		await (await getMigrations(options)).runMigrations();
		const password = 'short';
		const storedHash = (await hash(password, 4)).replace('$2b$', '$2a$');
		const raw = { users: [{ id, email: 'Old@Example.com', encrypted_password: storedHash,
			email_confirmed_at: '2020-01-01T00:00:00Z', created_at: '2020-01-01T00:00:00Z', updated_at: '2020-01-02T00:00:00Z',
			deleted_at: null, banned_until: null, is_anonymous: false, raw_user_meta_data: { name: 'Source User' } }], identities: [] };
		const source = parseSnapshot(raw);
		await database.query(`INSERT INTO public."user" (id,name,email,"emailVerified") VALUES
			('old-destination-id','Current','old@example.com',true), ('unrelated','Unrelated','unrelated@example.com',true)`);
		await database.query(`INSERT INTO public.account (id,"userId","accountId","providerId",password,"updatedAt")
			VALUES ('old','old-destination-id','old-destination-id','credential','old-hash',now())`);
		await database.query(`INSERT INTO public.session (id,token,"userId","expiresAt","updatedAt")
			VALUES ('old','old-session','old-destination-id',now()+interval '1 day',now())`);
		await database.query(`INSERT INTO public.verification (id,identifier,value,"expiresAt","createdAt","updatedAt")
			VALUES ('old-reset','reset-password:old-token','old-destination-id',now()+interval '1 day',now(),now())`);
		let backups = 0;
		const run = (apply: boolean, overwrite = true) => importUsers({ database, source, apply, overwrite,
			async beforeWrite() { backups++; } });
		await t.test('dry run leaves destination untouched', async () => {
			assert.equal((await run(false)).matchingDestinationUsers, 1);
			assert.equal(backups, 0);
			assert.equal((await database.query('SELECT count(*) FROM public.session')).rows[0].count, '1');
		});
		await t.test('overwrite must be explicit', async () => { await assert.rejects(run(true, false), /overwrite/); });
		await t.test('protects application foreign keys from cascading deletion', async () => {
			await database.query('CREATE TABLE public.profile (id text REFERENCES public."user"(id) ON DELETE CASCADE)');
			await database.query("INSERT INTO public.profile VALUES ('old-destination-id')");
			await assert.rejects(run(true), /Other tables/);
			assert.equal((await database.query('SELECT count(*) FROM public.profile')).rows[0].count, '1');
			await database.query('DROP TABLE public.profile');
		});
		await t.test('backup failure rolls back without modifying users', async () => {
			await assert.rejects(importUsers({ database, source, apply: true, overwrite: true,
				async beforeWrite() { throw new Error('backup failed'); } }), /backup failed/);
			assert.equal((await database.query('SELECT count(*) FROM public.session')).rows[0].count, '1');
		});
		await t.test('refuses to take a Google identity from an unrelated user', async () => {
			await database.query(`INSERT INTO public.account (id,"userId","accountId","providerId","updatedAt")
				VALUES ('unrelated-google','unrelated','google-subject','google',now())`);
			const withGoogle = parseSnapshot({ ...raw, identities: [{ user_id: id, provider: 'google',
				provider_id: 'google-subject', identity_data: { sub: 'google-subject' } }] });
			await assert.rejects(importUsers({ database, source: withGoogle, apply: true, overwrite: true,
				async beforeWrite() { throw new Error('must not reach backup'); } }), /unrelated destination user/);
			await database.query("DELETE FROM public.account WHERE id = 'unrelated-google'");
		});
		await t.test('imports a credential even without an email identity, retains hash, revokes sessions', async () => {
			const report = await run(true);
			assert.deepEqual(report.replacedDestinationIds, ['old-destination-id']);
			assert.deepEqual(report.idMappings, [{ previousId: 'old-destination-id', sourceId: id }]);
			assert.equal(backups, 1);
			assert.equal((await database.query('SELECT password FROM public.account')).rows[0].password, storedHash);
			assert.equal((await database.query('SELECT count(*) FROM public.session')).rows[0].count, '0');
			assert.equal((await database.query('SELECT count(*) FROM public.verification')).rows[0].count, '0');
			assert.equal((await database.query('SELECT count(*) FROM public."user"')).rows[0].count, '2');
		});
		await t.test('reapplying creates no duplicates', async () => {
			await run(true);
			assert.equal((await database.query('SELECT count(*) FROM public.account')).rows[0].count, '1');
			assert.equal((await database.query('SELECT count(*) FROM public."user"')).rows[0].count, '2');
		});
		await t.test('real Better Auth login accepts the old short password and rejects a wrong one', async () => {
			const auth = betterAuth(options);
			const request = (password: string) => auth.handler(new Request('http://localhost:3000/api/auth/sign-in/email', {
				method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
				body: JSON.stringify({ email: 'old@example.com', password })
			}));
			assert.equal((await request(password)).status, 200);
			assert.equal((await request('wrong')).status, 401);
		});
		await t.test('rejects duplicate users, bans and unsupported hashes before writing', () => {
			assert.throws(() => parseSnapshot({ ...raw, users: [...raw.users, ...raw.users] }), /Duplicate/);
			assert.throws(() => parseSnapshot({ ...raw, users: raw.users.map(user => ({ ...user, banned_until: '2999-01-01T00:00:00Z' })) }), /banned/);
			assert.throws(() => parseSnapshot({ ...raw, users: raw.users.map(user => ({ ...user, encrypted_password: 'unsupported' })) }), /hash/);
		});
	} finally { await database.end(); docker('rm', '--force', container); }
});
