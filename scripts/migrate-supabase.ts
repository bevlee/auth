import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import { z } from 'zod';
import { importUsers, parseSnapshot } from './supabase-import.ts';

const { values } = parseArgs({ options: {
	backup: { type: 'string' }, apply: { type: 'boolean', default: false },
	overwrite: { type: 'boolean', default: false }, help: { type: 'boolean', default: false }
} });
if (values.help) {
	console.info('pnpm migrate:supabase --backup <backup-directory> [--apply --overwrite]\nRequires explicit PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD. Defaults to dry run.');
	process.exit(0);
}

function docker(...args: string[]) {
	return execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 }).trim();
}

async function loadSource(directory: string) {
	const manifest = z.object({
		project_ref: z.string(),
		files: z.record(z.string(), z.object({ sha256: z.string() })),
		auth_table_rows: z.record(z.string(), z.number())
	}).parse(JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8')));
	for (const table of ['mfa_factors', 'webauthn_credentials']) {
		if (manifest.auth_table_rows[table] !== 0) throw new Error('MFA/WebAuthn migration requires manual review');
	}
	const schema = await readFile(resolve(directory, 'auth-schema.sql'), 'utf8');
	const data = await readFile(resolve(directory, 'auth-data.sql'), 'utf8');
	for (const [name, content] of [['auth-schema.sql', schema], ['auth-data.sql', data]]) {
		if (createHash('sha256').update(content).digest('hex') !== manifest.files[name]?.sha256) {
			throw new Error('Source backup checksum mismatch');
		}
	}
	let sql = 'CREATE SCHEMA auth;\n';
	for (const table of ['users', 'identities']) {
		const definition = schema.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"auth"\\."${table}" \\([\\s\\S]*?^\\);`, 'm'))?.[0];
		const rows = data.match(new RegExp(`^COPY "auth"\\."${table}" [^\\n]*\\n[\\s\\S]*?^\\\\\\.\\r?$`, 'm'))?.[0];
		if (!definition || !rows) throw new Error(`Missing ${table} schema or COPY data`);
		sql += definition + '\n' + rows + '\n';
	}
	const container = docker('run', '--rm', '--detach', '--env', 'POSTGRES_PASSWORD=source_scratch', 'postgres:17-alpine');
	try {
		for (let attempt = 0; ; attempt++) {
			try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); break; }
			catch { if (attempt === 59) throw new Error('Source scratch database did not start'); await setTimeout(250); }
		}
		execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres'], {
			input: sql, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024
		});
		const json = docker('exec', container, 'psql', '-X', '-A', '-t', '-U', 'postgres', '-c',
			`SELECT json_build_object('users', (SELECT coalesce(json_agg(u),'[]') FROM auth.users u),
			'identities', (SELECT coalesce(json_agg(i),'[]') FROM auth.identities i))`);
		const source = parseSnapshot(JSON.parse(json));
		if (source.users.length + source.skippedDeleted !== manifest.auth_table_rows.users) throw new Error('Source user count mismatch');
		return { source, project: manifest.project_ref };
	} finally { docker('rm', '--force', container); }
}

try {
	if (!values.backup) throw new Error('--backup <directory> is required');
	const env = z.object({
		PGHOST: z.string().min(1), PGPORT: z.coerce.number().int().min(1).max(65535),
		PGDATABASE: z.string().min(1), PGUSER: z.string().min(1), PGPASSWORD: z.string().min(1)
	}).safeParse(process.env);
	if (!env.success) throw new Error('Set all five PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD variables explicitly');
	const { source, project } = await loadSource(resolve(values.backup));
	const database = new Pool({ host: env.data.PGHOST, port: env.data.PGPORT, database: env.data.PGDATABASE,
		user: env.data.PGUSER, password: env.data.PGPASSWORD, connectionTimeoutMillis: 5000 });
	const directory = resolve('.backups', `pre-supabase-import-${new Date().toISOString().replaceAll(':', '-')}`);
	try {
		console.info(JSON.stringify({ project, destination: { host: env.data.PGHOST, port: env.data.PGPORT, database: env.data.PGDATABASE }, mode: values.apply ? 'apply' : 'dry-run' }));
		const report = await importUsers({ database, source, apply: values.apply, overwrite: values.overwrite,
			async beforeWrite() {
				await mkdir(directory, { recursive: true, mode: 0o700 });
				const dump = resolve(directory, 'destination.dump');
				await writeFile(dump, '', { mode: 0o600, flag: 'wx' });
				execFileSync('pg_dump', ['--format=custom', '--no-password', '--lock-wait-timeout=10s', '--file', dump], { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
				await chmod(dump, 0o600);
			}
		});
		if (values.apply) {
			await writeFile(resolve(directory, 'report.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
			console.info(`Destination backup and ID mapping: ${directory}`);
		}
		console.info(JSON.stringify(report));
	} finally { await database.end(); }
} catch (error) {
	// Database and child-process errors may contain SQL values or captured source rows.
	console.error(error instanceof Error && error.constructor === Error ? error.message : 'Migration failed; no success confirmed. Check source format, destination schema, Docker and pg_dump availability.');
	process.exitCode = 1;
}
