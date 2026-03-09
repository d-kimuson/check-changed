import { describe, test, expect } from 'vitest';
import { presets } from './presets.ts';
import type { CheckConfig } from './types.ts';

describe('presets', () => {
  test('all presets have unique names', () => {
    const names = presets.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test('all presets have non-empty checks', () => {
    for (const preset of presets) {
      expect(Object.keys(preset.checks).length).toBeGreaterThan(0);
    }
  });

  test('all check entries conform to CheckConfig shape', () => {
    for (const preset of presets) {
      const checks: Record<string, CheckConfig> = preset.checks;
      for (const check of Object.values(checks)) {
        expect(check.pattern).toBeTruthy();
        expect(check.command).toBeTruthy();
        expect(check.group).toBeTruthy();
      }
    }
  });

  test('all check names across presets are unique', () => {
    const checkNames = presets.flatMap((p) => Object.keys(p.checks));
    expect(new Set(checkNames).size).toBe(checkNames.length);
  });

  test('contains expected preset names', () => {
    const names = presets.map((p) => p.name);
    expect(names).toContain('prettier');
    expect(names).toContain('oxfmt');
    expect(names).toContain('eslint');
    expect(names).toContain('oxlint');
    expect(names).toContain('biome');
    expect(names).toContain('tsc');
    expect(names).toContain('vitest');
    expect(names).toContain('jest');
  });

  test('all patterns are valid regex', () => {
    for (const preset of presets) {
      const checks: Record<string, CheckConfig> = preset.checks;
      for (const check of Object.values(checks)) {
        expect(() => new RegExp(check.pattern)).not.toThrow();
      }
    }
  });
});

describe('preset regex patterns', () => {
  const jstsExtensions = [
    '.js',
    '.jsx',
    '.mjs',
    '.mjsx',
    '.cjs',
    '.cjsx',
    '.ts',
    '.tsx',
    '.mts',
    '.mtsx',
    '.cts',
    '.ctsx',
  ];
  const tsOnlyExtensions = ['.ts', '.tsx', '.mts', '.mtsx', '.cts', '.ctsx'];
  const nonJsTs = ['.css', '.json', '.md', '.html'];

  const getPattern = (presetName: string): string => {
    const preset = presets.find((p) => p.name === presetName);
    if (preset === undefined) throw new Error(`Preset ${presetName} not found`);
    const checks: Record<string, CheckConfig> = preset.checks;
    const firstCheck = Object.values(checks)[0];
    if (firstCheck === undefined) throw new Error(`No checks in preset ${presetName}`);
    return firstCheck.pattern;
  };

  const matchesExt = (pattern: string, ext: string): boolean =>
    new RegExp(pattern).test(`src/file${ext}`);

  test('oxfmt matches all JS/TS extensions', () => {
    const pattern = getPattern('oxfmt');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    for (const ext of nonJsTs) {
      expect(matchesExt(pattern, ext)).toBe(false);
    }
  });

  test('eslint matches all JS/TS extensions', () => {
    const pattern = getPattern('eslint');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    for (const ext of nonJsTs) {
      expect(matchesExt(pattern, ext)).toBe(false);
    }
  });

  test('tsc matches TS-only extensions', () => {
    const pattern = getPattern('tsc');
    for (const ext of tsOnlyExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    const jsOnly = ['.js', '.jsx', '.mjs', '.cjs'];
    for (const ext of jsOnly) {
      expect(matchesExt(pattern, ext)).toBe(false);
    }
  });

  test('prettier matches JS/TS + json, css, scss, less, html, md, yaml, yml', () => {
    const pattern = getPattern('prettier');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    for (const ext of ['.json', '.css', '.scss', '.less', '.html', '.md', '.yaml', '.yml']) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    expect(matchesExt(pattern, '.png')).toBe(false);
  });

  test('biome matches JS/TS + json, jsonc, css', () => {
    const pattern = getPattern('biome');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    for (const ext of ['.json', '.jsonc', '.css']) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
    expect(matchesExt(pattern, '.md')).toBe(false);
  });

  test('vitest matches all JS/TS extensions', () => {
    const pattern = getPattern('vitest');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
  });

  test('jest matches all JS/TS extensions', () => {
    const pattern = getPattern('jest');
    for (const ext of jstsExtensions) {
      expect(matchesExt(pattern, ext)).toBe(true);
    }
  });
});
