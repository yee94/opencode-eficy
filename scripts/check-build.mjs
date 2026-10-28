import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runtimeManifest } from './runtime-manifest.mjs';
import { packagePath } from './package-path.mjs';

export async function checkBuild(directory) {
  const root = new URL('../', import.meta.url);
  const tooling = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
  const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  const dist = resolve(directory, 'dist');
  const size = (await stat(resolve(dist, 'gui-experimental.cjs'))).size;
  if (size > 16 * 1024 * 1024) throw new Error(`GUI bundle exceeds 16 MiB: ${size}`);
  const chunks = (await readdir(dist)).filter(name => /\.(?:c?js|mjs)$/.test(name)).sort();
  if (JSON.stringify(chunks) !== JSON.stringify(['gui-experimental.cjs', 'index.js'])) throw new Error(`Unexpected bundles: ${chunks}`);
  const manifest = runtimeManifest(tooling);
  const generated = await readFile(new URL('src/generated/runtime.ts', root), 'utf8');
  const embedded = JSON.parse(generated.slice(generated.indexOf('export default ') + 'export default '.length).trim().replace(/;$/, ''));
  if (JSON.stringify(embedded.manifest.packages) !== JSON.stringify(manifest.packages)) throw new Error('Stale runtime assets; rebuild after changing package versions.');
  await writeFile(resolve(dist, 'runtime-manifest.json'), JSON.stringify({ pluginVersion: pkg.version, ...manifest }, null, 2) + '\n');
  const notices = await Promise.all([
    ['react', 'LICENSE'], ['react-dom', 'LICENSE'], ['sucrase', 'LICENSE'],
    ['recharts', 'LICENSE'],
    ['@eficy/browser', 'dist/standalone.js.LICENSE.txt'],
    ['@eficy/shadcn-ui', 'dist/index.js.LICENSE.txt'],
  ].map(async ([name, file]) => `--- ${name}/${file} ---\n${await readFile(resolve(packagePath(name), file), 'utf8')}`));
  await writeFile(resolve(dist, 'THIRD-PARTY-NOTICES.txt'), notices.join('\n\n'));
  console.log(`${pkg.name}: GUI bundle verified (${size} bytes)`);
}
