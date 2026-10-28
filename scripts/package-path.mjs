import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const require = createRequire(new URL('../package.json', import.meta.url));

export function packagePath(name) {
  try {
    return dirname(require.resolve(`${name}/package.json`));
  } catch (error) {
    if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    for (const search of require.resolve.paths(name) ?? []) {
      const manifest = resolve(search, name, 'package.json');
      if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return dirname(realpathSync(manifest));
    }
    let directory = dirname(require.resolve(name));
    while (directory !== dirname(directory)) {
      const manifest = resolve(directory, 'package.json');
      if (existsSync(manifest) && JSON.parse(readFileSync(manifest, 'utf8')).name === name) return directory;
      directory = dirname(directory);
    }
    throw new Error(`Cannot locate package manifest for ${name}`);
  }
}
