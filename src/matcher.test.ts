import { describe, test, expect } from 'vitest';
import { matchFiles, matchAndGroupFiles } from './matcher.ts';

const cwd = '/project';
const files = ['/project/src/index.ts', '/project/src/utils.js', '/project/README.md'];

describe('matchFiles', () => {
  test('matches TypeScript files with regex', () => {
    expect(matchFiles(files, '\\.ts$', cwd)).toEqual(['/project/src/index.ts']);
  });

  test('matches multiple extensions with alternation', () => {
    expect(matchFiles(files, '\\.(ts|js)$', cwd)).toEqual([
      '/project/src/index.ts',
      '/project/src/utils.js',
    ]);
  });

  test('matches markdown files', () => {
    expect(matchFiles(files, '\\.md$', cwd)).toEqual(['/project/README.md']);
  });

  test('returns empty for no matches', () => {
    expect(matchFiles(files, '\\.css$', cwd)).toEqual([]);
  });

  test('matches files in specific directory', () => {
    expect(matchFiles(files, '^src/.*\\.ts$', cwd)).toEqual(['/project/src/index.ts']);
  });

  test('matches all JS/TS variants with concise regex', () => {
    const allFiles = [
      '/project/a.js',
      '/project/a.jsx',
      '/project/a.mjs',
      '/project/a.cjs',
      '/project/a.ts',
      '/project/a.tsx',
      '/project/a.mts',
      '/project/a.cts',
      '/project/a.css',
    ];
    const matched = matchFiles(allFiles, '\\.(m|c)?(j|t)sx?$', cwd);
    expect(matched).toEqual([
      '/project/a.js',
      '/project/a.jsx',
      '/project/a.mjs',
      '/project/a.cjs',
      '/project/a.ts',
      '/project/a.tsx',
      '/project/a.mts',
      '/project/a.cts',
    ]);
  });
});

describe('matchAndGroupFiles', () => {
  test('returns single group when no named capture groups', () => {
    const result = matchAndGroupFiles(files, '\\.ts$', cwd);
    expect(result.size).toBe(1);
    const entry = result.get('');
    expect(entry).toBeDefined();
    expect(entry?.groups).toEqual({});
    expect(entry?.files).toEqual(['/project/src/index.ts']);
  });

  test('groups files by named capture group', () => {
    const wsFiles = [
      '/project/packages/app/src/index.ts',
      '/project/packages/app/src/utils.ts',
      '/project/packages/lib/src/helper.ts',
      '/project/standalone.ts',
    ];
    const result = matchAndGroupFiles(wsFiles, '^packages/(?<workspace>[^/]+)/.*\\.ts$', cwd);
    expect(result.size).toBe(2);

    const appGroup = result.get('app');
    expect(appGroup).toBeDefined();
    expect(appGroup?.groups).toEqual({ workspace: 'app' });
    expect(appGroup?.files).toEqual([
      '/project/packages/app/src/index.ts',
      '/project/packages/app/src/utils.ts',
    ]);

    const libGroup = result.get('lib');
    expect(libGroup).toBeDefined();
    expect(libGroup?.groups).toEqual({ workspace: 'lib' });
    expect(libGroup?.files).toEqual(['/project/packages/lib/src/helper.ts']);
  });

  test('groups by multiple capture groups', () => {
    const wsFiles = [
      '/project/apps/web/src/a.ts',
      '/project/apps/web/src/b.ts',
      '/project/apps/api/src/c.ts',
      '/project/libs/core/src/d.ts',
    ];
    const result = matchAndGroupFiles(wsFiles, '^(?<scope>apps|libs)/(?<name>[^/]+)/.*\\.ts$', cwd);
    expect(result.size).toBe(3);

    const webGroup = result.get('apps/web');
    expect(webGroup?.groups).toEqual({ scope: 'apps', name: 'web' });
    expect(webGroup?.files).toEqual(['/project/apps/web/src/a.ts', '/project/apps/web/src/b.ts']);

    const apiGroup = result.get('apps/api');
    expect(apiGroup?.groups).toEqual({ scope: 'apps', name: 'api' });

    const coreGroup = result.get('libs/core');
    expect(coreGroup?.groups).toEqual({ scope: 'libs', name: 'core' });
  });

  test('returns empty map when no files match', () => {
    const result = matchAndGroupFiles(files, '\\.css$', cwd);
    expect(result.size).toBe(0);
  });
});
