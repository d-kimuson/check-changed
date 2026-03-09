// oxlint の no-console 対応: process.stdout/stderr.write を直接使う

export const log = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

export const logError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};
