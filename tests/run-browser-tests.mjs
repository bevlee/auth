import { execFileSync, spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { getMigrations } from 'better-auth/db/migration';
import { Pool } from 'pg';

let container;
let tests;

function docker(...args) {
	return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

function stop() {
	tests?.kill('SIGTERM');
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
	container = docker('run', '--rm', '--detach', '--publish', '127.0.0.1::5432',
		'--env', 'POSTGRES_USER=auth_test', '--env', 'POSTGRES_PASSWORD=auth_test',
		'--env', 'POSTGRES_DB=auth_test', 'postgres:17-alpine');
	const port = docker('port', container, '5432/tcp').split(':').at(-1);
	const database = new Pool({
		host: '127.0.0.1', port: Number(port), user: 'auth_test',
		password: 'auth_test', database: 'auth_test', connectionTimeoutMillis: 1000
	});
	try {
		for (let attempt = 0; ; attempt++) {
			try {
				await database.query('select 1');
				break;
			} catch (error) {
				if (attempt === 29) throw error;
				await setTimeout(200);
			}
		}
		const { runMigrations } = await getMigrations({
			database,
			emailAndPassword: { enabled: true }
		});
		await runMigrations();
	} finally {
		await database.end();
	}
	tests = spawn('pnpm', ['exec', 'playwright', 'test', ...process.argv.slice(2)], {
		stdio: 'inherit',
		env: {
			...process.env,
			PGHOST: '127.0.0.1', PGPORT: port, PGUSER: 'auth_test',
			PGPASSWORD: 'auth_test', PGDATABASE: 'auth_test'
		}
	});
	const exitCode = await new Promise((resolve, reject) => {
		tests.once('error', reject);
		tests.once('exit', (code) => resolve(code ?? 1));
	});
	process.exitCode = exitCode;
} finally {
	if (container) docker('rm', '--force', container);
}
