import assert from 'node:assert/strict';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';

const directory = await realpath(process.argv[2]);
const pkg = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
assert.equal(pkg.icon, './icon.svg');
const packageRequire = createRequire(resolve(directory, 'package.json'));
assert.equal(packageRequire.resolve(`${pkg.name}/icon`), resolve(directory, 'icon.svg'));
const icon = await readFile(resolve(directory, pkg.icon));
assert(icon.byteLength > 0 && icon.byteLength <= 256 * 1024, 'dsh icons must not exceed 256 KiB');
const skills = [], tools = [];
const plugin = await import(pathToFileURL(resolve(directory, 'dist/index.js')).href);
await plugin.apply({ skills: { register: skill => skills.push(skill) }, tools: { register: tool => tools.push(tool) } });
assert.equal(skills.length, 1);
assert(!skills[0].content.includes('{{RUNTIME_VERSIONS}}'));
assert.equal(skills[0].resourceBase.path, resolve(directory, 'skills/eficy'));
const validator = tools.find(tool => tool.name === 'eficy_validate');
const template = tools.find(tool => tool.name === 'eficy_template');
assert(validator && template);
for (const file of await readdir(resolve(directory, 'samples'))) {
  if (!file.endsWith('.eficy')) continue;
  const source = await readFile(resolve(directory, 'samples', file), 'utf8');
  assert.equal(JSON.parse(await validator.execute({ path: file, source })).valid, true);
}
for (const preset of ['analytics', 'operations']) {
  const result = JSON.parse(await template.execute({ preset }));
  assert(result.source && result.demoData);
  assert.equal(JSON.parse(await validator.execute({ path: result.path, source: result.source })).valid, true);
}
let registration;
vm.runInNewContext(await readFile(resolve(directory, 'dist/client.js'), 'utf8'), {
  TextEncoder, TextDecoder, Blob, URL, atob, btoa, console,
  navigator: { userAgent: 'dsh-smoke' },
  window: { atob, btoa, console, __ModuleLoader__: { load: value => { registration = value; } } },
});
assert.equal(registration.id, '@eficy/dsh-plugin');
const hostRequire = createRequire(import.meta.url);
const client = registration.factory(request => {
  assert(['react', '@deepseek-ai/dsh-client-ui-primitives'].includes(request), 'Only shared host modules may be external');
  // Browser primitives import CSS; the Node smoke supplies the host face without rendering it.
  if (request === '@deepseek-ai/dsh-client-ui-primitives') return {
    FileTypeIcon() { throw new Error('Browser rendering is covered by client tests.'); },
    classifyFileType() { throw new Error('Browser rendering is covered by client tests.'); },
  };
  return hostRequire(request);
});
assert.equal(typeof client.apply, 'function');
assert(client.inject.includes('documentPreviews'));
console.log('Packed dsh tools, skills, templates and lazy client factory verified.');
