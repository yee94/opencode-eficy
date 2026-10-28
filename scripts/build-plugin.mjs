import { cp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import { build as vite } from 'vite';
import { gui } from '@opencode/plugin/gui/vite';
import { checkBuild } from './check-build.mjs';

const directory = process.cwd();
const root = fileURLToPath(new URL('../', import.meta.url));
await rm(resolve(directory, 'dist'), { recursive: true, force: true });
await esbuild({
  entryPoints: [resolve(directory, 'src/index.ts')],
  outfile: resolve(directory, 'dist/index.js'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['@opencode/plugin', '@opencode/plugin/*', 'sucrase', 'sucrase/*'],
});
await vite({
  root: directory, configFile: false,
  plugins: [gui({ entry: resolve(directory, 'src/gui.tsx'), outFile: resolve(directory, 'dist/gui-experimental.cjs') })],
});
for (const asset of ['LICENSE']) {
  await rm(resolve(directory, asset), { recursive: true, force: true });
  await cp(resolve(root, asset), resolve(directory, asset), { recursive: true });
}
await checkBuild(directory);
