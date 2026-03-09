import type { CheckConfig } from './types.ts';

type Preset = {
  readonly name: string;
  readonly description: string;
  readonly checks: Record<string, CheckConfig>;
};

export const presets = [
  {
    name: 'prettier',
    description: 'Format with Prettier',
    checks: {
      prettier: {
        pattern: '\\.((m|c)?(j|t)sx?|json|css|scss|less|html|md|ya?ml)$',
        command: 'prettier --write --no-error-on-unmatched-pattern {{CHANGED_FILES}}',
        group: 'format',
      },
    },
  },
  {
    name: 'oxfmt',
    description: 'Format with oxfmt',
    checks: {
      oxfmt: {
        pattern: '\\.(m|c)?(j|t)sx?$',
        command: 'oxfmt --write --no-error-on-unmatched-pattern {{CHANGED_FILES}}',
        group: 'format',
      },
    },
  },
  {
    name: 'eslint',
    description: 'Lint with ESLint',
    checks: {
      eslint: {
        pattern: '\\.(m|c)?(j|t)sx?$',
        command: 'eslint {{CHANGED_FILES}}',
        group: 'lint',
      },
    },
  },
  {
    name: 'oxlint',
    description: 'Lint with oxlint',
    checks: {
      oxlint: {
        pattern: '\\.(m|c)?(j|t)sx?$',
        command: 'oxlint --type-aware --fix {{CHANGED_FILES}}',
        group: 'lint',
      },
    },
  },
  {
    name: 'biome',
    description: 'Lint & format with Biome',
    checks: {
      'biome-format': {
        pattern: '\\.((m|c)?(j|t)sx?|json|jsonc|css)$',
        command: 'biome format --write {{CHANGED_FILES}}',
        group: 'format',
      },
      'biome-check': {
        pattern: '\\.((m|c)?(j|t)sx?|json|jsonc|css)$',
        command: 'biome check --write {{CHANGED_FILES}}',
        group: 'lint',
      },
    },
  },
  {
    name: 'tsc',
    description: 'Type-check with TypeScript compiler',
    checks: {
      typecheck: {
        pattern: '\\.(m|c)?tsx?$',
        command: 'tsc --noEmit',
        group: 'typecheck',
      },
    },
  },
  {
    name: 'tsgo',
    description: 'Type-check with tsgo (native TypeScript)',
    checks: {
      'typecheck-tsgo': {
        pattern: '\\.(m|c)?tsx?$',
        command: 'tsgo --noEmit',
        group: 'typecheck',
      },
    },
  },
  {
    name: 'vitest',
    description: 'Run related tests with Vitest',
    checks: {
      vitest: {
        pattern: '\\.(m|c)?(j|t)sx?$',
        command: 'vitest related --run --passWithNoTests {{CHANGED_FILES}}',
        group: 'test',
      },
    },
  },
  {
    name: 'jest',
    description: 'Run related tests with Jest',
    checks: {
      jest: {
        pattern: '\\.(m|c)?(j|t)sx?$',
        command: 'jest --findRelatedTests --passWithNoTests {{CHANGED_FILES}}',
        group: 'test',
      },
    },
  },
] as const satisfies readonly Preset[];

export type PresetName = (typeof presets)[number]['name'];
