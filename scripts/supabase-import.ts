import { z } from 'zod';
import type { Pool } from 'pg';

const userSchema = z.object({
	id: z.string().uuid(), email: z.string().email().transform(value => value.toLowerCase()),
	encrypted_password: z.string().nullable(), email_confirmed_at: z.string().nullable(),
	created_at: z.coerce.date(), updated_at: z.coerce.date(),
	deleted_at: z.string().nullable(), banned_until: z.string().nullable(), is_anonymous: z.boolean(),
	raw_user_meta_data: z.object({
		name: z.string().optional(), full_name: z.string().optional(),
		avatar_url: z.string().optional(), picture: z.string().optional()
	}).nullable()
});
const snapshotSchema = z.object({
	users: z.array(userSchema),
	identities: z.array(z.object({
		user_id: z.string().uuid(), provider: z.enum(['email', 'google']),
		provider_id: z.string(), identity_data: z.object({ sub: z.string().optional() }).nullable()
	}))
});

export function parseSnapshot(input: unknown) {
	const snapshot = snapshotSchema.parse(input);
	const users = snapshot.users.filter(user => !user.deleted_at);
	if (!users.length) throw new Error('No active source users');
	const emails = new Set<string>();
	const ids = new Set<string>();
	const subjects = new Set<string>();
	const accounts: { id: string; userId: string; accountId: string; providerId: string; password: string | null }[] = [];
	for (const user of users) {
		if (ids.has(user.id) || emails.has(user.email)) throw new Error('Duplicate source user ID or email');
		ids.add(user.id); emails.add(user.email);
		if (user.is_anonymous || (user.banned_until && new Date(user.banned_until) > new Date())) {
			throw new Error('Anonymous or currently banned source users require manual review');
		}
		if (user.encrypted_password) {
			if (!/^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.encrypted_password)) {
				throw new Error('Unsupported source password hash');
			}
			accounts.push({ id: `supabase:credential:${user.id}`, userId: user.id,
				accountId: user.id, providerId: 'credential', password: user.encrypted_password });
		}
		for (const identity of snapshot.identities.filter(identity => identity.user_id === user.id && identity.provider === 'google')) {
			const subject = identity.identity_data?.sub || identity.provider_id;
			if (!subject || subjects.has(subject)) throw new Error('Missing or duplicate Google identity');
			subjects.add(subject);
			accounts.push({ id: `supabase:google:${user.id}`, userId: user.id,
				accountId: subject, providerId: 'google', password: null });
		}
		if (!accounts.some(account => account.userId === user.id)) throw new Error('Source user has no supported login method');
	}
	return { users, accounts, skippedDeleted: snapshot.users.length - users.length };
}

export type ImportSource = ReturnType<typeof parseSnapshot>;
const targetUsers = z.array(z.object({ id: z.string(), email: z.string() }));

export async function importUsers({ database, source, apply, overwrite, beforeWrite }: {
	database: Pool; source: ImportSource; apply: boolean; overwrite: boolean;
	beforeWrite: () => Promise<void>;
}) {
	const client = await database.connect();
	try {
		await client.query('BEGIN');
		await client.query("SET LOCAL lock_timeout = '10s'");
		await client.query('LOCK TABLE public."user", public.account, public.session, public.verification IN SHARE ROW EXCLUSIVE MODE');
		const ids = source.users.map(user => user.id);
		const emails = source.users.map(user => user.email);
		const existing = targetUsers.parse((await client.query(
			'SELECT id, email FROM public."user" WHERE id = ANY($1::text[]) OR lower(email) = ANY($2::text[])', [ids, emails]
		)).rows);
		const replacedIds = existing.map(user => user.id);
		for (const target of existing) {
			if (ids.includes(target.id) && source.users.find(user => user.id === target.id)?.email !== target.email.toLowerCase()) {
				throw new Error('A source ID already belongs to a different destination email; review required');
			}
		}
		const removedIds = existing.filter(user => !ids.includes(user.id)).map(user => user.id);
		if (removedIds.length) {
			const dependencies = await client.query(`SELECT conname FROM pg_constraint
				WHERE contype = 'f' AND confrelid = 'public."user"'::regclass
				AND conrelid NOT IN ('public.account'::regclass, 'public.session'::regclass)`);
			if (dependencies.rowCount) throw new Error('Other tables reference destination user IDs; map those IDs before overwriting');
		}
		for (const account of source.accounts) {
			const collision = await client.query(`SELECT id FROM public.account
				WHERE (("providerId" = $1 AND "accountId" = $2) OR id = $3)
				AND NOT ("userId" = ANY($4::text[]))`,
			[account.providerId, account.accountId, account.id, replacedIds]);
			if (collision.rowCount) throw new Error('Source identity belongs to an unrelated destination user');
		}
		const report = { users: source.users.length, credentials: source.accounts.filter(a => a.providerId === 'credential').length,
			google: source.accounts.filter(a => a.providerId === 'google').length, matchingDestinationUsers: existing.length,
			replacedDestinationIds: removedIds,
			idMappings: source.users.flatMap(user => existing
				.filter(target => target.id !== user.id && target.email.toLowerCase() === user.email)
				.map(target => ({ previousId: target.id, sourceId: user.id }))),
			skippedDeleted: source.skippedDeleted, applied: apply };
		const accountDependencies = await client.query(`SELECT conname FROM pg_constraint
			WHERE contype = 'f' AND confrelid = 'public.account'::regclass`);
		if (accountDependencies.rowCount) throw new Error('Other tables reference destination accounts; review required before replacing accounts');
		if (!apply) { await client.query('ROLLBACK'); return report; }
		if (existing.length && !overwrite) throw new Error('Existing users found; --overwrite is required');
		await beforeWrite();
		const affectedIds = [...new Set([...ids, ...replacedIds])];
		await client.query('DELETE FROM public.session WHERE "userId" = ANY($1::text[])', [affectedIds]);
		await client.query('DELETE FROM public.account WHERE "userId" = ANY($1::text[])', [affectedIds]);
		await client.query('DELETE FROM public.verification WHERE value = ANY($1::text[]) OR identifier = ANY($2::text[])', [affectedIds, emails]);
		await client.query('DELETE FROM public."user" WHERE id = ANY($1::text[])', [removedIds]);
		for (const user of source.users) {
			const meta = user.raw_user_meta_data;
			await client.query(`INSERT INTO public."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
				VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET
				name=EXCLUDED.name, email=EXCLUDED.email, "emailVerified"=EXCLUDED."emailVerified",
				image=EXCLUDED.image, "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"`,
			[user.id, meta?.name || meta?.full_name || user.email.split('@')[0], user.email,
				!!user.email_confirmed_at, meta?.avatar_url || meta?.picture || null, user.created_at, user.updated_at]);
		}
		for (const account of source.accounts) {
			await client.query(`INSERT INTO public.account
				(id,"accountId","providerId","userId",password,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,now(),now())`,
			[account.id, account.accountId, account.providerId, account.userId, account.password]);
		}
		await client.query('COMMIT');
		return report;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally { client.release(); }
}
