import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const lockfiles = [
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'bun.lockb', pm: 'bun' },
  { file: 'bun.lock', pm: 'bun' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
] as const satisfies readonly { file: string; pm: PackageManager }[];

export const detectPackageManager = async (cwd: string): Promise<PackageManager> => {
  for (const { file, pm } of lockfiles) {
    try {
      await access(resolve(cwd, file));
      return pm;
    } catch {
      // not found, try next
    }
  }
  return 'npm';
};

const executors: Record<PackageManager, string> = {
  pnpm: 'pnpm exec',
  npm: 'npx',
  yarn: 'yarn exec',
  bun: 'bunx',
};

export const getExecutor = (pm: PackageManager): string => executors[pm];

const runners: Record<PackageManager, string> = {
  pnpm: 'pnpm',
  npm: 'npx',
  yarn: 'yarn',
  bun: 'bunx',
};

export const getRunner = (pm: PackageManager): string => runners[pm];
