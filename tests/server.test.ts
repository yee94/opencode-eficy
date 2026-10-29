// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import plugin from '../packages/opencode2-plugin/src/index';

it('registers the unified catalog without duplicate registrations', async () => {
  const skills = new Map<string, unknown>();
  const tools = new Map<string, unknown>();
  await plugin.setup({
    skill: { transform: async (callback: (editor: unknown) => void) => callback({ add: (skill: { id: string }) => {
      expect(skills.has(skill.id)).toBe(false);
      skills.set(skill.id, skill);
    } }) },
    tool: { transform: async (callback: (editor: unknown) => void) => callback({ add: (tool: { name: string }) => {
      expect(tools.has(tool.name)).toBe(false);
      tools.set(tool.name, tool);
    } }) },
  } as never);
  expect([...skills.keys()].sort()).toEqual(['eficy']);
  expect([...tools.keys()].sort()).toEqual(['eficy_template', 'eficy_validate']);
});

it('registers and executes the real SDK transforms, injecting built runtime versions', async () => {
  const skills: { id: string; name: string; path: string; content: string }[] = [];
  const tools: { name: string; input: unknown; execute(input: unknown): Promise<{ content: string }> }[] = [];
  await plugin.setup({
    skill: { transform: async (callback: (editor: unknown) => void) => callback({ add: (skill: typeof skills[number]) => skills.push(skill) }) },
    tool: { transform: async (callback: (editor: unknown) => void) => callback({ add: (tool: typeof tools[number]) => tools.push(tool) }) },
  } as never);
  expect(plugin.id).toBe('eficy');
  expect(skills).toHaveLength(1);
  expect(skills[0]).toMatchObject({ id: 'eficy', name: 'eficy' });
  expect(readFileSync(skills[0].path, 'utf8')).toContain('{{RUNTIME_VERSIONS}}');
  expect(skills[0].content).not.toContain('{{RUNTIME_VERSIONS}}');
  const root = join(dirname(fileURLToPath(import.meta.url)), '../packages/opencode2-plugin');
  const manifest = JSON.parse(readFileSync(join(root, 'dist/runtime-manifest.json'), 'utf8'));
  expect(skills[0].content).toContain(`插件版本：${manifest.pluginVersion}`);
  for (const [name, version] of Object.entries(manifest.packages)) expect(skills[0].content).toContain(`${name}: ${version}`);
  expect(tools).toHaveLength(2);
  expect(tools[0].name).toBe('eficy_validate');
  expect(tools[0].input).toMatchObject({ required: ['path', 'source'], additionalProperties: false });

  const validate = async (input: unknown) => JSON.parse((await tools[0].execute(input)).content);
  expect(await validate({ path: '/nonexistent/page.eficy', source: 'export default () => <main />;' })).toMatchObject({ valid: true, imports: [] });
  for (const input of [null, {}, { path: 'a.eficy' }, { path: 1, source: '' }]) {
    expect(await validate(input)).toMatchObject({ valid: false, code: 'missing' });
  }
  expect(await validate({ path: 'page.eficy', source: 'export default () => <main>' })).toMatchObject({ valid: false, code: 'syntax' });
  expect(await validate({ path: 'page.eficy', source: `import './x'; export default () => <main />` })).toMatchObject({ valid: false, code: 'import' });
  expect(await validate({ path: 'page.eficy', source: 'const App = () => <main />;' })).toMatchObject({ valid: false, code: 'default-export' });
  expect(await validate({ path: 'page.eficy', source: 'a'.repeat(128 * 1024 + 1) })).toMatchObject({ valid: false, code: 'oversize' });
});
