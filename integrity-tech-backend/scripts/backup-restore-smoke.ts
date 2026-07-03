import { execFileSync } from 'child_process';

const sourceUrl = process.env.DATABASE_URL;

if (!sourceUrl) {
  throw new Error('DATABASE_URL is required for backup/restore smoke test');
}

const requiredBinaries = ['pg_dump', 'pg_restore', 'psql', 'createdb', 'dropdb'];

type DatabaseConnectionParts = {
  protocol: string;
  host: string;
  port?: string;
  user?: string;
  password?: string;
  database: string;
};

function run(command: string, args: string[], options: { input?: Buffer; env?: NodeJS.ProcessEnv } = {}) {
  return execFileSync(command, args, {
    input: options.input,
    env: { ...process.env, ...(options.env || {}) },
    maxBuffer: 128 * 1024 * 1024,
    stdio: options.input ? ['pipe', 'pipe', 'inherit'] : ['ignore', 'pipe', 'inherit'],
  });
}

function assertBinary(command: string) {
  try {
    run(command, ['--version']);
  } catch {
    throw new Error(`${command} is required for backup/restore smoke test`);
  }
}

function parseDatabaseUrl(value: string): DatabaseConnectionParts {
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL must include a database name');
  return {
    protocol: url.protocol,
    host: url.hostname,
    port: url.port || undefined,
    user: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database,
  };
}

function postgresClientArgs(parts: DatabaseConnectionParts) {
  const args = ['-h', parts.host];
  if (parts.port) args.push('-p', parts.port);
  if (parts.user) args.push('-U', parts.user);
  return args;
}

function postgresClientEnv(parts: DatabaseConnectionParts) {
  return parts.password ? { PGPASSWORD: parts.password } : {};
}

function buildCleanPostgresUrl(parts: DatabaseConnectionParts, databaseName = parts.database) {
  const url = new URL(`${parts.protocol}//${parts.host}`);
  if (parts.user) url.username = parts.user;
  if (parts.port) url.port = parts.port;
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function validateRestoredDatabase(restoredUrl: string) {
  const sql = `
    SELECT
      to_regclass('public.organizations') IS NOT NULL
      AND to_regclass('public.users') IS NOT NULL
      AND to_regclass('public.exam_attempts') IS NOT NULL
      AND to_regclass('public.audit_events') IS NOT NULL
      AND to_regclass('public.assessment_versions') IS NOT NULL
      AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
      AS ok;
  `;
  const output = run('psql', [restoredUrl, '-tAc', sql]).toString().trim();
  if (output !== 't') {
    throw new Error(`Restored database validation failed: ${output || '(empty result)'}`);
  }
}

async function main() {
  for (const binary of requiredBinaries) assertBinary(binary);

  const sourceParts = parseDatabaseUrl(sourceUrl);
  const originalName = sourceParts.database;
  const restoreName = `${originalName}_restore_smoke_${Date.now()}`;
  const sourcePostgresUrl = buildCleanPostgresUrl(sourceParts);
  const restoreUrl = buildCleanPostgresUrl(sourceParts, restoreName);
  const clientArgs = postgresClientArgs(sourceParts);
  const clientEnv = postgresClientEnv(sourceParts);

  console.log(`[backup-restore] Creating temporary database ${restoreName}`);
  run('createdb', [...clientArgs, restoreName], { env: clientEnv });

  try {
    console.log('[backup-restore] Dumping source database');
    const dump = run('pg_dump', ['--format=custom', '--no-owner', '--no-acl', sourcePostgresUrl], { env: clientEnv });

    console.log('[backup-restore] Restoring into temporary database');
    run('pg_restore', ['--no-owner', '--no-acl', '--dbname', restoreUrl], { input: dump, env: clientEnv });

    validateRestoredDatabase(restoreUrl);
    console.log('[backup-restore] Backup and restore smoke validation completed.');
  } finally {
    console.log(`[backup-restore] Dropping temporary database ${restoreName}`);
    try {
      run('dropdb', ['--if-exists', ...clientArgs, restoreName], { env: clientEnv });
    } catch (error) {
      console.error(`[backup-restore] Failed to drop temporary database ${restoreName}: ${String(error)}`);
    }
  }
}

main().catch((error) => {
  console.error(`[backup-restore] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
