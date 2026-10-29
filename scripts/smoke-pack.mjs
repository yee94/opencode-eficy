import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicPackages } from './workspace-packages.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = resolve(root, 'artifacts');
const tarballs = (await readdir(artifacts)).filter(name => name.endsWith('.tgz'));
const packages = await publicPackages();
assert.deepEqual(tarballs.sort(), packages.map(value => value.tarball).sort(), 'Expected every public package');
const temporary = await mkdtemp(resolve(tmpdir(), 'opencode-pack-smoke-'));
try {
  await writeFile(resolve(temporary, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  for (const name of tarballs) {
    const entries = execFileSync('tar', ['-tzf', resolve(artifacts, name)], { encoding: 'utf8' }).trim().split('\n');
    for (const required of ['dist/index.js', 'dist/gui-experimental.cjs', 'dist/runtime-manifest.json', 'dist/THIRD-PARTY-NOTICES.txt', 'README.md', 'LICENSE']) {
      assert(entries.includes(`package/${required}`), `${name} is missing ${required}`);
    }
    assert(entries.some(entry => entry.startsWith('package/skills/')), 'Missing skills');
    if (name.startsWith('eficy-opencode2-plugin-')) {
      assert(entries.includes('package/skills/eficy/references/shadcn.md'), 'Missing general Eficy shadcn reference');
      for (const file of ['skills/eficy/references/components.md', 'skills/eficy/references/reports.md', 'samples/analytics.eficy', 'samples/operations.eficy']) {
        assert(entries.includes(`package/${file}`), `Missing migrated shadcn content: ${file}`);
      }
    }
    assert(entries.some(entry => entry.startsWith('package/samples/')), 'Missing samples');
    assert(!entries.some(entry => /^package\/(src|node_modules|tests)\//.test(entry)), 'Source or dependencies leaked into tarball');
  }
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', ...tarballs.map(name => resolve(artifacts, name))], { cwd: temporary, stdio: 'inherit' });
  for (const { pkg: sourcePackage } of packages) {
    const directory = resolve(temporary, 'node_modules', sourcePackage.name);
    const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(resolve(directory, 'dist/runtime-manifest.json'), 'utf8'));
    assert.equal(manifest.pluginVersion, pkg.version);
    assert.equal(pkg.exports['.'], './dist/index.js');
    assert.equal(pkg.exports['./gui-experimental'], './dist/gui-experimental.cjs');
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { readFile, readdir } from 'node:fs/promises';
      import { resolve } from 'node:path';
      const {default: plugin} = await import(${JSON.stringify(pkg.name)});
      const skills = [], tools = [];
      await plugin.setup({
        skill: {transform: async callback => callback({add: skill => skills.push(skill)})},
        tool: {transform: async callback => callback({add: tool => tools.push(tool)})},
      });
      assert.equal(skills.length, 1);
      assert(!skills[0].content.includes('{{RUNTIME_VERSIONS}}'));
      assert(skills[0].content.includes(${JSON.stringify(pkg.version)}));
      const validator = tools.find(tool => tool.name.endsWith('_validate'));
      assert(validator, 'Missing validator');
      for (const sample of await readdir(${JSON.stringify(resolve(directory, 'samples'))})) {
        if (!sample.endsWith('.eficy')) continue;
        const source = await readFile(resolve(${JSON.stringify(resolve(directory, 'samples'))}, sample), 'utf8');
        const result = JSON.parse((await validator.execute({path: sample, source})).content);
        assert.equal(result.valid, true, sample);
      }
      const template = tools.find(tool => tool.name.endsWith('_template'));
      assert(template, 'Missing unified report template tool');
      if (template) for (const preset of template.input.properties.preset.enum) {
        const result = JSON.parse((await template.execute({preset})).content);
        assert(result.source && result.path, 'Missing packaged template');
        assert.equal(JSON.parse((await validator.execute(result)).content).valid, true);
      }
    `], { cwd: temporary, stdio: 'inherit' });
    execFileSync(process.execPath, ['--check', resolve(directory, 'dist/gui-experimental.cjs')], { stdio: 'inherit' });
    console.log(`Packed consumer verified: ${pkg.name}@${pkg.version}`);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
