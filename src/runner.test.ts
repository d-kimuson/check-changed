import { describe, test, expect } from 'vitest';
import { buildCommand, runChecks, reportResults, reportResultsJson } from './runner.ts';
import type { CheckResult } from './types.ts';

describe('buildCommand', () => {
  const cwd = '/project';

  test('returns command as-is when no {FILES} and files matched', () => {
    expect(buildCommand('tsc --noEmit', ['/project/src/a.ts'], undefined, cwd)).toBe(
      'tsc --noEmit',
    );
  });

  test('returns null when no {FILES} and no files matched', () => {
    expect(buildCommand('tsc --noEmit', [], undefined, cwd)).toBeNull();
  });

  test('replaces {FILES} with absolute paths by default', () => {
    const result = buildCommand(
      'eslint {FILES}',
      ['/project/src/a.ts', '/project/src/b.ts'],
      undefined,
      cwd,
    );
    expect(result).toBe('eslint /project/src/a.ts /project/src/b.ts');
  });

  test('replaces {FILES} with relative paths when config.relative is true', () => {
    const result = buildCommand('eslint {FILES}', ['/project/src/a.ts'], { relative: true }, cwd);
    expect(result).toBe('eslint src/a.ts');
  });

  test('uses custom separator', () => {
    const result = buildCommand(
      'cmd {FILES}',
      ['/project/a.ts', '/project/b.ts'],
      { 'files-sep': ',' },
      cwd,
    );
    expect(result).toBe('cmd /project/a.ts,/project/b.ts');
  });

  test('returns null when {FILES} present but no files matched', () => {
    expect(buildCommand('eslint {FILES}', [], undefined, cwd)).toBeNull();
  });

  test('replaces group placeholders in command', () => {
    const result = buildCommand(
      'tsc --project packages/{workspace}/tsconfig.json',
      ['/project/packages/app/src/a.ts'],
      undefined,
      cwd,
      { workspace: 'app' },
    );
    expect(result).toBe('tsc --project packages/app/tsconfig.json');
  });

  test('replaces multiple group placeholders', () => {
    const result = buildCommand(
      'cmd --scope {scope} --name {name} {FILES}',
      ['/project/a.ts'],
      undefined,
      cwd,
      { scope: 'apps', name: 'web' },
    );
    expect(result).toBe('cmd --scope apps --name web /project/a.ts');
  });
});

describe('runChecks', () => {
  const cwd = '/tmp';

  test('returns passed for successful command', async () => {
    const checks = new Map([
      ['echo-test', { pattern: '.*', command: 'echo hello', group: 'test' }],
    ]);
    const results = await runChecks(checks, ['/tmp/file.ts'], cwd);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('passed');
  });

  test('returns failed with output for failing command', async () => {
    const checks = new Map([
      ['fail-test', { pattern: '.*', command: 'echo oops >&2; exit 1', group: 'test' }],
    ]);
    const results = await runChecks(checks, ['/tmp/file.ts'], cwd);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ status: 'failed', exitCode: 1 });
  });

  test('returns skip when no files match pattern', async () => {
    const checks = new Map([
      ['skip-test', { pattern: '\\.css$', command: 'exit 1', group: 'test' }],
    ]);
    const results = await runChecks(checks, ['/tmp/file.ts'], cwd);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('skip');
  });

  test('runs multiple checks in parallel', async () => {
    const checks = new Map([
      ['a', { pattern: '.*', command: 'echo a', group: 'test' }],
      ['b', { pattern: '.*', command: 'echo b', group: 'test' }],
    ]);
    const results = await runChecks(checks, ['/tmp/file.ts'], cwd);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'passed')).toBe(true);
  });

  test('runs grouped checks when pattern has named capture groups', async () => {
    const checks = new Map([
      [
        'echo-group',
        {
          pattern: '^(?<workspace>app|lib)/.*\\.ts$',
          command: 'echo {workspace}',
          group: 'test',
        },
      ],
    ]);
    const results = await runChecks(checks, ['/tmp/app/index.ts', '/tmp/lib/utils.ts'], cwd);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.name);
    expect(names).toContain('echo-group[app]');
    expect(names).toContain('echo-group[lib]');
    expect(results.every((r) => r.status === 'passed')).toBe(true);
  });

  test('skips when no files match grouped pattern', async () => {
    const checks = new Map([
      [
        'skip-group',
        {
          pattern: '^(?<workspace>app)/.*\\.css$',
          command: 'echo {workspace}',
          group: 'test',
        },
      ],
    ]);
    const results = await runChecks(checks, ['/tmp/app/index.ts'], cwd);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('skip');
  });
});

describe('reportResults', () => {
  test('returns true when all checks pass', () => {
    const results: readonly CheckResult[] = [
      { status: 'passed', name: 'a', group: 'test', command: 'echo a' },
    ];
    expect(reportResults(results)).toBe(true);
  });

  test('returns false when any check fails', () => {
    const results: readonly CheckResult[] = [
      { status: 'passed', name: 'a', group: 'test', command: 'echo a' },
      {
        status: 'failed',
        name: 'b',
        group: 'test',
        command: 'exit 1',
        exitCode: 1,
        stdout: 'out',
        stderr: 'err',
      },
    ];
    expect(reportResults(results)).toBe(false);
  });

  test('returns true when all skipped', () => {
    const results: readonly CheckResult[] = [{ status: 'skip', name: 'a', group: 'test' }];
    expect(reportResults(results)).toBe(true);
  });
});

describe('reportResultsJson', () => {
  test('outputs valid JSON with passed status', () => {
    const results: readonly CheckResult[] = [
      { status: 'passed', name: 'a', group: 'test', command: 'echo a' },
      { status: 'skip', name: 'b', group: 'lint' },
    ];
    // Capture stdout
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => {
      chunks.push(chunk);
      return true;
    };
    const result = reportResultsJson(results);
    process.stdout.write = orig;

    expect(result).toBe(true);
    const parsed: unknown = JSON.parse(chunks.join(''));
    expect(parsed).toEqual({
      status: 'passed',
      summary: { passed: 1, failed: 0, skipped: 1 },
      checks: [
        { name: 'a', group: 'test', status: 'passed', command: 'echo a' },
        { name: 'b', group: 'lint', status: 'skip' },
      ],
    });
  });

  test('outputs failed status when any check fails', () => {
    const results: readonly CheckResult[] = [
      {
        status: 'failed',
        name: 'a',
        group: 'test',
        command: 'exit 1',
        exitCode: 1,
        stdout: '',
        stderr: 'err',
      },
    ];
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => {
      chunks.push(chunk);
      return true;
    };
    const result = reportResultsJson(results);
    process.stdout.write = orig;

    expect(result).toBe(false);
    const parsed: unknown = JSON.parse(chunks.join(''));
    expect(parsed).toEqual({
      status: 'failed',
      summary: { passed: 0, failed: 1, skipped: 0 },
      checks: [
        {
          name: 'a',
          group: 'test',
          status: 'failed',
          command: 'exit 1',
          exitCode: 1,
          stdout: '',
          stderr: 'err',
        },
      ],
    });
  });
});
