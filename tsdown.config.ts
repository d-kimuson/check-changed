import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
});
