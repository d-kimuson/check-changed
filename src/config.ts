import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as v from 'valibot';

// -- Schema --

const ChangedFilesConfigSchema = v.object({
  separator: v.optional(v.string()),
  path: v.optional(v.picklist(['relative', 'absolute'])),
});

const CheckConfigSchema = v.object({
  pattern: v.string(),
  command: v.string(),
  group: v.string(),
  changedFiles: v.optional(ChangedFilesConfigSchema),
});

export const ConfigSchema = v.object({
  defaults: v.object({
    changed: v.string(),
    target: v.string(),
  }),
  checks: v.record(v.string(), CheckConfigSchema),
});

// -- Config file path --

const CONFIG_FILENAME = '.check-changedrc.json';

export const resolveConfigPath = (cwd: string): string => resolve(cwd, CONFIG_FILENAME);

// -- Load & validate --

export class ConfigNotFoundError extends Error {
  constructor(configPath: string) {
    super(`Config file not found: ${configPath}\nRun \`check-changed setup\` to create one.`);
    this.name = 'ConfigNotFoundError';
  }
}

export const loadConfig = async (cwd: string): Promise<v.InferOutput<typeof ConfigSchema>> => {
  const configPath = resolveConfigPath(cwd);
  let raw: string;
  try {
    raw = await readFile(configPath, 'utf-8');
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      throw new ConfigNotFoundError(configPath);
    }
    throw err;
  }
  const json: unknown = JSON.parse(raw);
  return v.parse(ConfigSchema, json);
};
