// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import plugin from '../packages/opencode2-plugin/src/index';
import { parseEficy } from '../src/parser';

const root = join(dirname(fileURLToPath(import.meta.url)), '../packages/opencode2-plugin');

it('includes the shadcn report templates and validator in the base package', async () => {
  const skills: { name: string; content: string }[] = [];
  const tools: { name: string; execute(input: unknown): Promise<{ content: string }> }[] = [];
  await plugin.setup({
    skill: { transform: async (fn: (editor: unknown) => void) => fn({ add: (value: typeof skills[number]) => skills.push(value) }) },
    tool: { transform: async (fn: (editor: unknown) => void) => fn({ add: (value: typeof tools[number]) => tools.push(value) }) },
  } as never);
  expect(plugin.id).toBe('eficy');
  expect(skills).toHaveLength(1);
  expect(skills[0].name).toBe('eficy');
  expect(skills[0].content).not.toContain('{{RUNTIME_VERSIONS}}');
  const manifest = JSON.parse(readFileSync(join(root, 'dist/runtime-manifest.json'), 'utf8'));
  expect(skills[0].content).toContain(`插件版本：${manifest.pluginVersion}`);
  expect(manifest.packages.recharts).toBe('2.15.4');
  expect(tools.map(tool => tool.name)).toEqual(['eficy_validate', 'eficy_template']);
  const validate = async (input: unknown) => JSON.parse((await tools[0].execute(input)).content);
  const template = async (input: unknown) => JSON.parse((await tools[1].execute(input)).content);
  for (const preset of ['analytics', 'operations']) {
    const result = await template({ preset });
    expect(result.path).toBe(`${preset}.eficy`);
    expect(result.demoData).toBe(true);
    expect(result.source).toBe(readFileSync(join(root, 'samples', `${preset}.eficy`), 'utf8'));
    expect(await validate({ path: result.path, source: result.source })).toMatchObject({ valid: true, imports: expect.arrayContaining(['eficy', 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js', 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.css']) });
    expect(result.source).toContain('ChartContainer');
    expect(result.source).toContain('https://cdn.jsdelivr.net/npm/@eficy/charts@0.1.0/dist/index.js');
    expect(parseEficy(result.path, result.source).bytes).toBeLessThan(128 * 1024);
  }
  expect(await template({ preset: '../../package.json' })).toMatchObject({ valid: false });
  expect(await template({ preset: '__proto__' })).toMatchObject({ valid: false });
  expect(await validate({ path: 'generic.eficy', source: 'export default () => <div />' })).toMatchObject({ valid: true });
  expect(await validate({ path: 'site.shadcn.eficy', source: 'import {Area} from "recharts"; export default () => <Area />' })).toMatchObject({ valid: false, code: 'import' });
});

it('keeps skill examples within the same static import boundary', () => {
  const skill = readFileSync(join(root, 'skills/eficy/references/components.md'), 'utf8');
  for (const [, snippet] of skill.matchAll(/```tsx\n([\s\S]*?)```/g)) {
    expect(() => parseEficy('skill.shadcn.eficy', `${snippet}\nexport default () => <main />;`)).not.toThrow();
  }
});
