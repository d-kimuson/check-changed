import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as v from 'valibot';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, resolveConfigPath, ConfigSchema } from './config.ts';

describe('resolveConfigPath', () => {
  test('resolves .check-changedrc.json in given directory', () => {
    expect(resolveConfigPath('/foo/bar')).toBe('/foo/bar/.check-changedrc.json');
  });
});

describe('ConfigSchema', () => {
  test('validates a valid config', () => {
    const input = {
      defaults: { changed: 'staged', target: 'all' },
      checks: {
        lint: { pattern: '**/*.ts', command: 'eslint', group: 'lint' },
      },
    };
    expect(() => v.parse(ConfigSchema, input)).not.toThrow();
  });

  test('rejects missing defaults', () => {
    const input = { checks: {} };
    expect(() => v.parse(ConfigSchema, input)).toThrow(/defaults/i);
  });

  test('rejects missing required check fields', () => {
    const input = {
      defaults: { changed: 'staged', target: 'all' },
      checks: {
        lint: { pattern: '**/*.ts' },
      },
    };
    expect(() => v.parse(ConfigSchema, input)).toThrow(/command/i);
  });

  test('accepts optional changedFiles config', () => {
    const input = {
      defaults: { changed: 'staged', target: 'all' },
      checks: {
        lint: {
          pattern: '**/*.ts',
          command: 'eslint {{CHANGED_FILES}}',
          group: 'lint',
          changedFiles: { separator: ',', path: 'relative' },
        },
      },
    };
    const result = v.parse(ConfigSchema, input);
    expect(result.checks['lint']?.changedFiles).toEqual({ separator: ',', path: 'relative' });
  });
});

describe('loadConfig', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'check-changed-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  test('loads and validates a config file', async () => {
    const config = {
      defaults: { changed: 'staged', target: 'all' },
      checks: {
        typecheck: { pattern: '**/*.ts', command: 'tsc --noEmit', group: 'typecheck' },
      },
    };
    await writeFile(join(dir, '.check-changedrc.json'), JSON.stringify(config));

    const result = await loadConfig(dir);
    expect(result).toEqual(config);
  });

  test('throws ConfigNotFoundError on missing file', async () => {
    await expect(loadConfig(dir)).rejects.toThrow(/Config file not found/);
  });

  test('throws on invalid JSON structure', async () => {
    await writeFile(join(dir, '.check-changedrc.json'), '{"invalid": true}');
    await expect(loadConfig(dir)).rejects.toThrow(/defaults/i);
  });
});
