import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

const execFileAsync = promisify(execFile);

const tsxPath = join(process.cwd(), 'node_modules', '.bin', 'tsx');
const cliPath = join(process.cwd(), 'src', 'bin.ts');

const runCli = async (
  cwd: string,
  args: readonly string[],
): Promise<{ readonly code: number; readonly stdout: string; readonly stderr: string }> => {
  try {
    const { stdout, stderr } = await execFileAsync(tsxPath, [cliPath, ...args], { cwd });
    return { code: 0, stdout, stderr };
  } catch (error) {
    if (error instanceof Error && 'code' in error && 'stdout' in error && 'stderr' in error) {
      return {
        code: typeof error.code === 'number' ? error.code : 1,
        stdout: typeof error.stdout === 'string' ? error.stdout : '',
        stderr: typeof error.stderr === 'string' ? error.stderr : '',
      };
    }

    throw error;
  }
};

describe('check-changed CLI', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-changed-bin-'));
    await writeFile(
      join(dir, '.check-changedrc.json'),
      JSON.stringify({
        defaults: { changed: 'untracked', target: 'all' },
        checks: {
          echo: {
            pattern: '.*',
            command: 'echo {{CHANGED_FILES}}',
            group: 'test',
          },
        },
      }),
    );
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('rejects non-text formats in dry-run mode', async () => {
    const result = await runCli(dir, ['run', '--dry-run', '--format', 'json']);

    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('--dry-run can only be used with --format text');
  });
});
