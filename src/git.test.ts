import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { getChangedFiles } from './git.ts';

const execFileAsync = promisify(execFile);

const initGitRepo = async (dir: string): Promise<void> => {
  await execFileAsync('git', ['init', '-q'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 'Codex'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 'codex@example.com'], { cwd: dir });
};

const commitAll = async (dir: string, message: string): Promise<void> => {
  await execFileAsync('git', ['add', '.'], { cwd: dir });
  await execFileAsync('git', ['commit', '-qm', message], { cwd: dir });
};

describe('getChangedFiles', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-changed-git-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('reports untracked source errors with a descriptive label', async () => {
    await expect(getChangedFiles([{ type: 'untracked' }], dir)).rejects.toThrow(
      /^Failed to get changed files for untracked files:/,
    );
  });

  test('excludes deleted files from unstaged changes', async () => {
    await initGitRepo(dir);
    const file = join(dir, 'tracked.ts');

    await writeFile(file, 'export const value = 1;\n');
    await commitAll(dir, 'init');

    await rm(file);

    await expect(getChangedFiles([{ type: 'unstaged' }], dir)).resolves.toEqual([]);
  });

  test('excludes deleted files from staged changes', async () => {
    await initGitRepo(dir);
    const file = join(dir, 'tracked.ts');

    await writeFile(file, 'export const value = 1;\n');
    await commitAll(dir, 'init');

    await rm(file);
    await execFileAsync('git', ['add', '-A'], { cwd: dir });

    await expect(getChangedFiles([{ type: 'staged' }], dir)).resolves.toEqual([]);
  });
});
