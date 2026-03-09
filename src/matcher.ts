import { relative } from 'node:path';

export const matchFiles = (
  files: readonly string[],
  pattern: string,
  cwd: string,
): readonly string[] => {
  const regex = new RegExp(pattern);
  return files.filter((file) => {
    const rel = relative(cwd, file);
    return regex.test(rel);
  });
};

type GroupEntry = {
  readonly groups: Record<string, string>;
  readonly files: string[];
};

const getNamedGroupKeys = (pattern: string): readonly string[] => {
  const namedGroupRegex = /\(\?<([^>]+)>/g;
  const keys: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = namedGroupRegex.exec(pattern)) !== null) {
    const key = m[1];
    if (key !== undefined) {
      keys.push(key);
    }
  }
  return keys;
};

export const matchAndGroupFiles = (
  files: readonly string[],
  pattern: string,
  cwd: string,
): Map<string, GroupEntry> => {
  const regex = new RegExp(pattern);
  const groupKeys = getNamedGroupKeys(pattern);
  const hasNamedGroups = groupKeys.length > 0;
  const result = new Map<string, GroupEntry>();

  for (const file of files) {
    const rel = relative(cwd, file);
    const match = regex.exec(rel);
    if (!match) continue;

    if (!hasNamedGroups) {
      const existing = result.get('');
      if (existing) {
        existing.files.push(file);
      } else {
        result.set('', { groups: {}, files: [file] });
      }
      continue;
    }

    const groups: Record<string, string> = {};
    const keyParts: string[] = [];
    for (const key of groupKeys) {
      const value = match.groups?.[key] ?? '';
      groups[key] = value;
      keyParts.push(value);
    }
    const groupKey = keyParts.join('/');

    const existing = result.get(groupKey);
    if (existing) {
      existing.files.push(file);
    } else {
      result.set(groupKey, { groups, files: [file] });
    }
  }

  return result;
};
