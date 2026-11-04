import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { checkBuild } from './check-build.mjs';
import { packagePath } from './package-path.mjs';

const directory = process.cwd();
const root = fileURLToPath(new URL('../', import.meta.url));
const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
await rm(resolve(directory, 'dist'), { recursive: true, force: true });
for (const asset of ['skills', 'samples']) {
  await rm(resolve(directory, asset), { recursive: true, force: true });
  await cp(resolve(root, 'packages/opencode2-plugin', asset), resolve(directory, asset), { recursive: true });
}
await cp(resolve(root, 'LICENSE'), resolve(directory, 'LICENSE'));
await build({
  entryPoints: [resolve(root, 'scripts/export-html.ts')],
  outfile: resolve(directory, 'skills/eficy/scripts/export-html.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22', minify: true,
  banner: { js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);' },
});
await build({
  entryPoints: [resolve(directory, 'src/index.ts')], outfile: resolve(directory, 'dist/index.js'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22',
  external: ['@deepseek-ai/*', 'sucrase', 'sucrase/*'],
});
await build({
  entryPoints: [resolve(directory, 'src/client.ts')], outfile: resolve(directory, 'dist/client.js'),
  bundle: true, platform: 'browser', format: 'cjs', target: 'es2022', minify: true,
  jsx: 'automatic', jsxImportSource: 'react', define: { 'process.env.NODE_ENV': '"production"' },
  external: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-ui-primitives'],
  loader: { '.css': 'text', '.svg': 'text' },
  plugins: [{ name: 'inline-assets', setup(build) {
    build.onResolve({ filter: /\.(?:css\?inline|svg\?raw)$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace(/\?(?:inline|raw)$/, '')) }));
  } }],
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(pkg.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
await checkBuild(directory, 'client.js');
const notices = resolve(directory, 'dist/THIRD-PARTY-NOTICES.txt');
const additions = await Promise.all(['jspdf', '@deepseek-ai/dsh-util-workspace-path'].map(async name =>
  `--- ${name} ---\n${await readFile(resolve(packagePath(name), 'LICENSE'), 'utf8')}`));
await writeFile(notices, await readFile(notices, 'utf8') + '\n\n' + additions.join('\n\n'));
