import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function publicPackages() {
  const root = fileURLToPath(new URL('../packages/', import.meta.url));
  const packages = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(root, entry.name);
    const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
    if (pkg.private) continue;
    packages.push({ directory, pkg, tarball: `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz` });
  }
  return packages.sort((a, b) => a.pkg.name.localeCompare(b.pkg.name));
}
