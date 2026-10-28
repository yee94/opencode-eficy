import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { runtimeManifest } from './runtime-manifest.mjs';
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const bundle = new URL('dist/gui-experimental.cjs', root);
const size = (await stat(bundle)).size;
if (size > 16 * 1024 * 1024) throw new Error(`GUI bundle exceeds 16 MiB: ${size}`);
const chunks = (await readdir(new URL('dist/', root))).filter(name => /\.(?:c?js|mjs)$/.test(name));
if (chunks.length !== 1 || chunks[0] !== 'gui-experimental.cjs') throw new Error(`Expected single CJS bundle: ${chunks}`);
const manifest = runtimeManifest(pkg);
const generated = await readFile(new URL('src/generated/runtime.ts', root), 'utf8');
const embedded = JSON.parse(generated.slice(generated.indexOf('export default ') + 'export default '.length).trim().replace(/;$/, ''));
if (JSON.stringify(embedded.manifest) !== JSON.stringify(manifest)) throw new Error('Stale runtime assets; rebuild after changing package versions.');
await writeFile(new URL('dist/runtime-manifest.json', root), JSON.stringify(manifest, null, 2) + '\n');
console.log(`GUI bundle verified: ${size} bytes`);
const notices = await Promise.all([
  'react/LICENSE', 'react-dom/LICENSE', 'sucrase/LICENSE',
  '@eficy/browser/dist/standalone.js.LICENSE.txt',
  '@eficy/shadcn-ui/dist/index.js.LICENSE.txt',
].map(async path => `--- ${path} ---\n${await readFile(new URL(`node_modules/${path}`, root), 'utf8')}`));
await writeFile(new URL('dist/THIRD-PARTY-NOTICES.txt', root), notices.join('\n\n'));
