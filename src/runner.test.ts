import * as v from 'valibot';
import { describe, test, expect } from 'vitest';
import {
  buildCommand,
  runChecks,
  reportResults,
  reportResultsJson,
  reportResultsHooks,
} from './runner.ts';
import type { CheckResult } from './types.ts';

const HooksOutputSchema = v.object({
  decision: v.string(),
  reason: v.string(),
});

describe('buildCommand', () => {
  const cwd = '/project';

  test('returns command as-is when no {{CHANGED_FILES}} and files matched', () => {
    expect(buildCommand('tsc --noEmit', ['/project/src/a.ts'], {}, cwd)).toBe('tsc --noEmit');
  });

  test('returns null when no {{CHANGED_FILES}} and no files matched', () => {
    expect(buildCommand('tsc --noEmit', [], {}, cwd)).toBeNull();
  });

  test('replaces {{CHANGED_FILES}} with relative paths by default', () => {
    const result = buildCommand(
      'eslint {{CHANGED_FILES}}',
      ['/project/src/a.ts', '/project/src/b.ts'],
      {},
      cwd,
    );
    expect(result).toBe("eslint 'src/a.ts' 'src/b.ts'");
  });

  test('replaces {{CHANGED_FILES}} with absolute paths when configured', () => {
    const result = buildCommand(
      'eslint {{CHANGED_FILES}}',
      ['/project/src/a.ts'],
      { path: 'absolute' },
      cwd,
    );
    expect(result).toBe("eslint '/project/src/a.ts'");
  });

  test('uses custom separator', () => {
    const result = buildCommand(
      'cmd {{CHANGED_FILES}}',
      ['/project/a.ts', '/project/b.ts'],
      { separator: ',' },
      cwd,
    );
    expect(result).toBe("cmd 'a.ts','b.ts'");
  });

  test('returns null when {{CHANGED_FILES}} present but no files matched', () => {
    expect(buildCommand('eslint {{CHANGED_FILES}}', [], {}, cwd)).toBeNull();
  });

  test('replaces group placeholders in command', () => {
    const result = buildCommand(
      'tsc --project packages/{{workspace}}/tsconfig.json',
      ['/project/packages/app/src/a.ts'],
      {},
      cwd,
      { workspace: 'app' },
    );
    expect(result).toBe('tsc --project packages/app/tsconfig.json');
  });

  test('quotes paths with spaces', () => {
    const result = buildCommand('eslint {{CHANGED_FILES}}', ['/project/src/my file.ts'], {}, cwd);
    expect(result).toBe("eslint 'src/my file.ts'");
  });

  test('escapes single quotes in paths', () => {
    const result = buildCommand('eslint {{CHANGED_FILES}}', ["/project/src/it's.ts"], {}, cwd);
    expect(result).toBe("eslint 'src/it'\\''s.ts'");
  });

  test('replaces multiple group placeholders', () => {
    const result = buildCommand(
      'cmd --scope {{scope}} --name {{name}} {{CHANGED_FILES}}',
      ['/project/a.ts'],
      {},
      cwd,
      { scope: 'apps', name: 'web' },
    );
    expect(result).toBe("cmd --scope apps --name web 'a.ts'");
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
          command: 'echo {{workspace}}',
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
          command: 'echo {{workspace}}',
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

describe('reportResultsHooks', () => {
  const captureStdout = (fn: () => boolean): { result: boolean; output: string } => {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string) => {
      chunks.push(chunk);
      return true;
    };
    const result = fn();
    process.stdout.write = orig;
    return { result, output: chunks.join('') };
  };

  test('outputs nothing and returns true when all checks pass', () => {
    const results: readonly CheckResult[] = [
      { status: 'passed', name: 'a', group: 'test', command: 'echo a' },
      { status: 'skip', name: 'b', group: 'lint' },
    ];
    const { result, output } = captureStdout(() => reportResultsHooks(results));
    expect(result).toBe(true);
    expect(output).toBe('');
  });

  test('outputs block decision with reason when any check fails', () => {
    const results: readonly CheckResult[] = [
      { status: 'passed', name: 'a', group: 'test', command: 'echo a' },
      {
        status: 'failed',
        name: 'b',
        group: 'lint',
        command: 'eslint src/x.ts',
        exitCode: 1,
        stdout: 'src/x.ts: error',
        stderr: '',
      },
    ];
    const { result, output } = captureStdout(() => reportResultsHooks(results));
    expect(result).toBe(false);
    const parsed = v.parse(HooksOutputSchema, JSON.parse(output));
    expect(parsed.decision).toBe('block');
    expect(parsed.reason).toContain('check-changed');
    expect(parsed.reason).toContain('b');
    expect(parsed.reason).toContain('src/x.ts: error');
  });

  test('includes multiple failed checks in reason', () => {
    const results: readonly CheckResult[] = [
      {
        status: 'failed',
        name: 'lint',
        group: 'lint',
        command: 'eslint x.ts',
        exitCode: 1,
        stdout: 'lint error',
        stderr: '',
      },
      {
        status: 'failed',
        name: 'typecheck',
        group: 'typecheck',
        command: 'tsc --noEmit',
        exitCode: 1,
        stdout: '',
        stderr: 'type error',
      },
    ];
    const { result, output } = captureStdout(() => reportResultsHooks(results));
    expect(result).toBe(false);
    const parsed = v.parse(HooksOutputSchema, JSON.parse(output));
    expect(parsed.reason).toContain('lint');
    expect(parsed.reason).toContain('typecheck');
  });
});
