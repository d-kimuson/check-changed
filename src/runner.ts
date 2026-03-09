import { spawn } from 'node:child_process';
import { relative } from 'node:path';
import { log, logError } from './logger.ts';
import { matchAndGroupFiles, matchFiles } from './matcher.ts';
import type { CheckConfig, CheckResult } from './types.ts';

const hasNamedGroups = (pattern: string): boolean => /\(\?<[^>]+>/.test(pattern);

export const buildCommand = (
  command: string,
  matchedFiles: readonly string[],
  config: CheckConfig['config'],
  cwd: string,
  groups?: Record<string, string>,
): string | null => {
  let cmd = command;

  if (groups) {
    for (const [key, value] of Object.entries(groups)) {
      cmd = cmd.replaceAll(`{${key}}`, value);
    }
  }

  if (!cmd.includes('{FILES}')) {
    return matchedFiles.length > 0 ? cmd : null;
  }

  if (matchedFiles.length === 0) {
    return null;
  }

  const sep = config?.['files-sep'] ?? ' ';
  const paths =
    config?.relative === true ? matchedFiles.map((f) => relative(cwd, f)) : matchedFiles;

  return cmd.replace('{FILES}', paths.join(sep));
};

const runCommand = (
  command: string,
  cwd: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> =>
  new Promise((res) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));

    child.on('close', (code) => {
      res({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks).toString(),
        stderr: Buffer.concat(stderrChunks).toString(),
      });
    });
  });

const runSingleCheck = async (
  name: string,
  check: CheckConfig,
  changedFiles: readonly string[],
  cwd: string,
): Promise<readonly CheckResult[]> => {
  if (hasNamedGroups(check.pattern)) {
    return runGroupedCheck(name, check, changedFiles, cwd);
  }

  const matched = matchFiles(changedFiles, check.pattern, cwd);
  const command = buildCommand(check.command, matched, check.config, cwd);

  if (command === null) {
    return [{ status: 'skip', name, group: check.group }];
  }

  const { exitCode, stdout, stderr } = await runCommand(command, cwd);
  if (exitCode === 0) {
    return [{ status: 'passed', name, group: check.group, command }];
  }
  return [{ status: 'failed', name, group: check.group, command, exitCode, stdout, stderr }];
};

const runGroupedCheck = async (
  name: string,
  check: CheckConfig,
  changedFiles: readonly string[],
  cwd: string,
): Promise<readonly CheckResult[]> => {
  const grouped = matchAndGroupFiles(changedFiles, check.pattern, cwd);

  if (grouped.size === 0) {
    return [{ status: 'skip', name, group: check.group }];
  }

  const results = await Promise.all(
    [...grouped.entries()].map(async ([groupKey, entry]): Promise<CheckResult> => {
      const checkName = `${name}[${groupKey}]`;
      const command = buildCommand(check.command, entry.files, check.config, cwd, entry.groups);

      if (command === null) {
        return { status: 'skip', name: checkName, group: check.group };
      }

      const { exitCode, stdout, stderr } = await runCommand(command, cwd);
      if (exitCode === 0) {
        return { status: 'passed', name: checkName, group: check.group, command };
      }
      return {
        status: 'failed',
        name: checkName,
        group: check.group,
        command,
        exitCode,
        stdout,
        stderr,
      };
    }),
  );

  return results;
};

export const runChecks = async (
  checks: ReadonlyMap<string, CheckConfig>,
  changedFiles: readonly string[],
  cwd: string,
): Promise<readonly CheckResult[]> => {
  const entries = [...checks.entries()];

  const results = await Promise.allSettled(
    entries.map(([name, check]) => runSingleCheck(name, check, changedFiles, cwd)),
  );

  return results.flatMap((result, i) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    const entry = entries[i];
    if (!entry) {
      throw new Error(`Unexpected missing entry at index ${i}`);
    }
    return [
      {
        status: 'failed',
        name: entry[0],
        group: entry[1].group,
        command: entry[1].command,
        exitCode: 1,
        stdout: '',
        stderr: result.reason instanceof Error ? result.reason.message : String(result.reason),
      } satisfies CheckResult,
    ];
  });
};

// -- Dry run --

export const dryRunChecks = (
  checks: ReadonlyMap<string, CheckConfig>,
  changedFiles: readonly string[],
  cwd: string,
): void => {
  for (const [name, check] of checks) {
    if (hasNamedGroups(check.pattern)) {
      const grouped = matchAndGroupFiles(changedFiles, check.pattern, cwd);
      if (grouped.size === 0) {
        log(`  [skip] ${name} (no matching files)`);
        continue;
      }
      for (const [groupKey, entry] of grouped) {
        const checkName = `${name}[${groupKey}]`;
        const command = buildCommand(check.command, entry.files, check.config, cwd, entry.groups);
        if (command === null) {
          log(`  [skip] ${checkName} (no matching files)`);
        } else {
          log(`  [run]  ${checkName}`);
          log(`         $ ${command}`);
        }
      }
    } else {
      const matched = matchFiles(changedFiles, check.pattern, cwd);
      const command = buildCommand(check.command, matched, check.config, cwd);

      if (command === null) {
        log(`  [skip] ${name} (no matching files)`);
      } else {
        log(`  [run]  ${name}`);
        log(`         $ ${command}`);
      }
    }
  }
};

// -- Report (text) --

export const reportResults = (results: readonly CheckResult[]): boolean => {
  const skipped = results.filter((r) => r.status === 'skip');
  const passed = results.filter((r) => r.status === 'passed');
  const failed = results.filter((r) => r.status === 'failed');

  log('');

  for (const r of skipped) {
    log(`  - ${r.name} [skipped]`);
  }
  for (const r of passed) {
    log(`  ✓ ${r.name} [passed]`);
  }
  for (const r of failed) {
    log(`  ✗ ${r.name} [failed]`);
  }

  if (failed.length > 0) {
    for (const r of failed) {
      logError(`\n── ${r.name} ──`);
      if (r.stdout) logError(r.stdout.trimEnd());
      if (r.stderr) logError(r.stderr.trimEnd());
    }
    log(`\n${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped`);
    return false;
  }

  log(`\n${passed.length} passed, ${skipped.length} skipped`);
  return true;
};

// -- Report (JSON) --

export const reportResultsJson = (results: readonly CheckResult[]): boolean => {
  const checks = results.map((r) => {
    switch (r.status) {
      case 'skip':
        return { name: r.name, group: r.group, status: r.status };
      case 'passed':
        return { name: r.name, group: r.group, status: r.status, command: r.command };
      case 'failed':
        return {
          name: r.name,
          group: r.group,
          status: r.status,
          command: r.command,
          exitCode: r.exitCode,
          stdout: r.stdout,
          stderr: r.stderr,
        };
      default: {
        const _exhaustive: never = r;
        throw new Error(`Unexpected status: ${JSON.stringify(_exhaustive)}`);
      }
    }
  });

  const hasFailed = results.some((r) => r.status === 'failed');

  const output = {
    status: hasFailed ? 'failed' : 'passed',
    summary: {
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skip').length,
    },
    checks,
  };

  log(JSON.stringify(output, null, 2));
  return !hasFailed;
};
