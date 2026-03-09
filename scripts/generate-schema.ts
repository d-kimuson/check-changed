import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { toJsonSchema } from '@valibot/to-json-schema';
import { ConfigSchema } from '../src/config.ts';

const outPath = resolve(import.meta.dirname, '../config-schema.json');
const jsonSchema = toJsonSchema(ConfigSchema);

await writeFile(outPath, `${JSON.stringify(jsonSchema, null, 2)}\n`);
