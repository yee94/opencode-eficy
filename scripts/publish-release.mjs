import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
if (process.env.GITHUB_REF_TYPE !== 'tag' || process.env.GITHUB_REF_NAME !== 'v0.2.0') throw new Error('This bootstrap release requires tag v0.2.0; subsequent releases use Changesets.');
for (const [name, version] of [['opencode2-plugin', '0.2.0'], ['opencode2-shadcn', '0.1.0']]) {
  const pkg = JSON.parse(await readFile(resolve(root, 'packages', name, 'package.json'), 'utf8'));
  if (pkg.version !== version) throw new Error(`Unexpected bootstrap version: ${pkg.name}@${pkg.version}`);
  const result = spawnSync('npm', ['view', `${pkg.name}@${version}`, 'version', '--json', '--registry=https://registry.npmjs.org'], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status === 0) {
    if (JSON.parse(result.stdout) !== version) throw new Error(`Unexpected registry result: ${result.stdout}`);
    console.log(`Already published: ${pkg.name}@${version}`);
    continue;
  }
  let code;
  try { code = JSON.parse(result.stdout).error?.code; } catch {}
  if (code !== 'E404') throw new Error(`Registry check failed: ${result.stderr || result.stdout}`);
  execFileSync('npm', ['publish', resolve(root, 'artifacts', `eficy-${name}-${version}.tgz`), '--access', 'public', '--registry=https://registry.npmjs.org'], { stdio: 'inherit' });
}
