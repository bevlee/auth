import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { setTimeout } from 'node:timers/promises';

const { values } = parseArgs({ options: {
	backup: { type: 'string' }, output: { type: 'string' },
	apply: { type: 'boolean', default: false },
	'attachment-key': { type: 'string' }
} });
const tables = ['property_groups', 'properties', 'transactions', 'documents'];
const directory = resolve(values.backup ?? '.backups/supabase/investments-20261021T221935+1100');
const output = resolve(values.output ?? `.backups/application-import-${new Date().toISOString().replaceAll(':', '-')}`);
const context = 'context-cszouotwbgq';

function command(binary, args, input) {
	return execFileSync(binary, args, { input, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
}
function docker(...args) { return command('docker', args).toString().trim(); }
function remote(database, sql) {
	return command('kubectl', ['--context', context, '--request-timeout=60s', '-n', 'db', 'exec', '-i', 'svc/postgres', '--',
		'psql', '-U', 'app', '-d', database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'], sql).toString().trim();
}
function copyBlock(data, table) {
	const block = data.match(new RegExp(`^COPY "public"\\."${table}" [^\\n]*\\n[\\s\\S]*?^\\\\\\.\\r?$`, 'm'))?.[0];
	if (!block) throw new Error(`Missing source COPY block: ${table}`);
	return block;
}
function sourceDefinition(schema, table) {
	const definition = schema.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"public"\\."${table}" \\([\\s\\S]*?^\\);`, 'm'))?.[0];
	if (!definition) throw new Error(`Missing source schema: ${table}`);
	return definition;
}
function jsonSQL(value) { return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString('hex')}','hex'),'UTF8')::jsonb`; }

async function main() {
	const manifest = JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
	const files = {};
	for (const name of ['schema.sql', 'data.sql']) {
		files[name] = await readFile(resolve(directory, name), 'utf8');
		if (createHash('sha256').update(files[name]).digest('hex') !== manifest.files[name].sha256) throw new Error(`Checksum mismatch: ${name}`);
	}
	await mkdir(output, { recursive: true, mode: 0o700 });
	const container = docker('run', '--rm', '--detach', '--env', 'POSTGRES_PASSWORD=data_scratch', 'postgres:17-alpine');
	let snapshot;
	try {
		for (let i = 0; ; i++) {
			try { docker('exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); break; }
			catch { if (i === 59) throw new Error('Scratch database did not start'); await setTimeout(250); }
		}
		let sql = '';
		for (const table of tables) sql += sourceDefinition(files['schema.sql'], table) + '\n' + copyBlock(files['data.sql'], table) + '\n';
		command('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1'], sql);
		const pairs = tables.map(table => `'${table}',(select coalesce(json_agg(t),'[]') from public.${table} t)`);
		snapshot = JSON.parse(docker('exec', container, 'psql', '-U', 'postgres', '-X', '-A', '-t', '-c', `select json_build_object(${pairs.join(',')})`));
	} finally { docker('rm', '--force', container); }
	for (const table of tables) {
		if (snapshot[table].length !== manifest.data_table_rows[`"public"."${table}"`]) throw new Error(`Source count mismatch: ${table}`);
	}
	const ownerIds = [...new Set(tables.flatMap(table => snapshot[table].map(row => row.user_id)))];
	const users = JSON.parse(remote('auth', `select coalesce(json_agg(u),'[]') from
		(select id,name,email from public."user" where id in (select jsonb_array_elements_text(${jsonSQL(ownerIds)}))) u;`));
	if (users.length !== ownerIds.length) throw new Error('Application data owners are missing from Better Auth');
	let attachments = [];
	for (const doc of snapshot.documents) {
		let bytes;
		if (values['attachment-key']) {
			const key = (await readFile(values['attachment-key'], 'utf8')).trim();
			const url = `https://${manifest.project_ref}.supabase.co/storage/v1/object/authenticated/documents/${doc.storage_path.split('/').map(encodeURIComponent).join('/')}`;
			const response = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000) });
			if (!response.ok) throw new Error(`Attachment download failed: HTTP ${response.status}`);
			bytes = Buffer.from(await response.arrayBuffer());
			if (!bytes.length || bytes.length > 5242880) throw new Error('Attachment size exceeds destination limits');
			if (doc.file_size !== null && bytes.length !== doc.file_size) throw new Error('Attachment size differs from source metadata');
			await writeFile(resolve(output, `${doc.id}.bin`), bytes, { mode: 0o600 });
		} else {
			try { bytes = await readFile(resolve(output, `${doc.id}.bin`)); } catch { /* Dry run can report missing file bytes. */ }
		}
		attachments.push({ id: doc.id, hex: bytes?.toString('hex') ?? null, mime: doc.mime_type || 'application/octet-stream' });
	}
	if (values.apply && attachments.some(file => !file.hex)) throw new Error('Missing attachment bytes; supply --attachment-key <private-key-file>');
	await writeFile(resolve(output, 'source-snapshot.json'), JSON.stringify(snapshot), { mode: 0o600 });
	const fallback = new Date(manifest.completed_at).getTime();
	const epoch = column => `coalesce((extract(epoch from ${column})*1000)::bigint,${fallback})`;
	let sql = `BEGIN; SET LOCAL lock_timeout='10s';
LOCK TABLE public.users,public.property_groups,public.properties,public.transactions,public.documents IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE source_users AS SELECT * FROM jsonb_to_recordset(${jsonSQL(users)}) AS u(id text,name text,email text);
INSERT INTO public.users SELECT * FROM source_users ON CONFLICT(id) DO NOTHING;
`;
	for (const table of tables) {
		sql += sourceDefinition(files['schema.sql'], table).replace(/CREATE TABLE (?:IF NOT EXISTS )?"public"\."\w+"/, `CREATE TEMP TABLE source_${table}`) + '\n';
		sql += copyBlock(files['data.sql'], table).replace(`"public"."${table}"`, `source_${table}`) + '\n';
	}
	sql += `CREATE TEMP TABLE attachment_bytes AS SELECT * FROM jsonb_to_recordset(${jsonSQL(attachments)}) AS f(id text,hex text,mime text);
CREATE TEMP TABLE expected_property_groups AS SELECT id::text,user_id::text,name,type,color,${epoch('created_at')} created_at,${epoch('updated_at')} updated_at FROM source_property_groups;
CREATE TEMP TABLE expected_properties AS SELECT id::text,user_id::text,group_id::text,address,${epoch('created_at')} created_at,${epoch('updated_at')} updated_at FROM source_properties;
CREATE TEMP TABLE expected_transactions AS SELECT id::text,user_id::text,property_id::text,type,(amount*100)::integer amount_cents,description,category,date::text,${epoch('created_at')} created_at,${epoch('updated_at')} updated_at FROM source_transactions;
CREATE TEMP TABLE expected_documents AS SELECT d.id::text,d.user_id::text,d.transaction_id::text,d.original_filename,d.storage_path,d.file_size,coalesce(d.mime_type,f.mime) mime_type,${epoch('d.created_at')} created_at,decode(f.hex,'hex') content FROM source_documents d JOIN attachment_bytes f ON f.id=d.id::text;
`;
	const columns = {
		property_groups: 'id,user_id,name,type,color,created_at,updated_at',
		properties: 'id,user_id,group_id,address,created_at,updated_at',
		transactions: 'id,user_id,property_id,type,amount_cents,description,category,date,created_at,updated_at',
		documents: 'id,user_id,transaction_id,original_filename,storage_path,file_size,mime_type,created_at,content'
	};
	for (const table of tables) {
		sql += `INSERT INTO public.${table} (${columns[table]}) SELECT ${columns[table]} FROM expected_${table} ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN IF EXISTS(SELECT ${columns[table]} FROM expected_${table} EXCEPT SELECT ${columns[table]} FROM public.${table}) THEN RAISE EXCEPTION 'Destination ${table} differs from source; import rolled back'; END IF; END $$;
`;
	}
	sql += `SELECT json_build_object('matched',json_build_object(${tables.map(table => `'${table}',(SELECT count(*) FROM public.${table} t JOIN expected_${table} e USING(id))`).join(',')}),'amount_cents',(SELECT sum(amount_cents) FROM expected_transactions));
${values.apply ? 'COMMIT' : 'ROLLBACK'};`;
	await writeFile(resolve(output, 'import.sql'), sql, { mode: 0o600 });
	if (values.apply) {
		const dump = command('kubectl', ['--context', context, '--request-timeout=60s', '-n', 'db', 'exec', 'svc/postgres', '--',
			'pg_dump', '-U', 'app', '-d', 'tax_time', '--format=custom', '--no-owner', '--no-acl', '--lock-wait-timeout=10s']);
		await writeFile(resolve(output, 'destination.dump'), dump, { mode: 0o600, flag: 'wx' });
	}
	const result = remote('tax_time', sql);
	const report = { destination: 'tax_time', applied: values.apply, owners: users.length,
		sourceCounts: Object.fromEntries(tables.map(table => [table, snapshot[table].length])),
		attachmentsDownloaded: attachments.filter(file => file.hex).length, result: JSON.parse(result), output };
	await writeFile(resolve(output, values.apply ? 'applied.json' : 'preview.json'), JSON.stringify(report, null, 2), { mode: 0o600 });
	console.info(JSON.stringify(report));
}

main().catch(error => {
	console.error(error?.stderr
		? error.stderr.toString().split('\n').filter(line => /^ERROR:|^psql:.*ERROR:|^pg_dump:/.test(line)).join('\n') || 'Database or subprocess failed; no success confirmed'
		: error.message);
	process.exitCode = 1;
});
