import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/bin.ts'],
  format: 'esm',
  target: 'node22',
  clean: true,
  sourcemap: false,
  minify: 'dce-only',
  treeshake: true,
  unused: true,
  publint: true,
  nodeProtocol: true,
  inlineOnly: false,
});
