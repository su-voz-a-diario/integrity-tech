import { execFileSync } from 'child_process';

import { runBackupRestoreSmoke } from '../../../scripts/backup-restore-smoke';

jest.mock('child_process', () => ({
  execFileSync: jest.fn(),
}));

describe('backup-restore-smoke script', () => {
  const execFileSyncMock = execFileSync as jest.MockedFunction<typeof execFileSync>;

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(12345);
    execFileSyncMock.mockImplementation((command: string) => {
      if (command === 'pg_dump') return Buffer.from('dump');
      if (command === 'psql') return Buffer.from('t\n');
      return Buffer.from('');
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    execFileSyncMock.mockReset();
  });

  it('passes the same PostgreSQL environment to psql and pg_dump', async () => {
    await runBackupRestoreSmoke('postgresql://postgres:secret@127.0.0.1:5432/integrity_tech_e2e?schema=public');

    const calls = execFileSyncMock.mock.calls;
    const pgDumpCall = calls.find(([command, args]) => command === 'pg_dump' && !(args as string[]).includes('--version'));
    const psqlCall = calls.find(([command, args]) => command === 'psql' && !(args as string[]).includes('--version'));

    expect(pgDumpCall).toBeDefined();
    expect(psqlCall).toBeDefined();
    expect(pgDumpCall?.[2]?.env).toBe(psqlCall?.[2]?.env);
    expect(psqlCall?.[2]?.env?.PGPASSWORD).toBe('secret');
  });

  it('uses the same PostgreSQL environment for all database commands', async () => {
    await runBackupRestoreSmoke('postgresql://postgres:secret@127.0.0.1:5432/integrity_tech_e2e?schema=public');

    const calls = execFileSyncMock.mock.calls;
    const postgresCommandCalls = ['createdb', 'pg_dump', 'pg_restore', 'psql', 'dropdb'].map((command) =>
      calls.find(([calledCommand, args]) => calledCommand === command && !(args as string[]).includes('--version')),
    );
    const pgDumpEnv = postgresCommandCalls.find((call) => call?.[0] === 'pg_dump')?.[2]?.env;

    expect(pgDumpEnv).toBeDefined();
    for (const call of postgresCommandCalls) {
      expect(call?.[2]?.env).toBe(pgDumpEnv);
    }
  });
});
