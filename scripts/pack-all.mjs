import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { publicPackages } from './workspace-packages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, 'artifacts');
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const { directory } of await publicPackages()) {
  execFileSync('pnpm', ['pack', '--pack-destination', destination], { cwd: directory, stdio: 'inherit' });
}
