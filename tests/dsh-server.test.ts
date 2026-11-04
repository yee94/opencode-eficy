// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';
import { Context } from '@deepseek-ai/cordis';
import ToolsService, { type ToolDefinition } from '@deepseek-ai/dsh-tools';
import SkillRegistry, { type SkillRegistration } from '@deepseek-ai/dsh-skill';
import * as plugin from '../packages/dsh-plugin/src/index';
import { apply, inject } from '../packages/dsh-plugin/src/index';
import { validateSource } from '../src/catalog';

it('registers the same skill and tool contracts through the real dsh defineTool', async () => {
  const skills: SkillRegistration[] = [];
  const tools: ToolDefinition[] = [];
  await apply({ skills: { register: (value: SkillRegistration) => skills.push(value) }, tools: { register: (value: ToolDefinition) => tools.push(value) } } as never);
  expect(inject).toEqual(['tools', 'skills']);
  expect(skills).toHaveLength(1);
  expect(skills[0]).toMatchObject({ name: 'eficy', source: 'bundled', resourceBase: { kind: 'directory' } });
  expect(skills[0].content).not.toContain('{{RUNTIME_VERSIONS}}');
  expect(skills[0].content).not.toMatch(/^---/);
  expect(skills[0].content).toContain('默认不调用校验工具或浏览器');
  const resourceBase = skills[0].resourceBase;
  if (resourceBase?.kind !== 'directory') throw new Error('Missing skill directory');
  expect(await readFile(`${resourceBase.path}/references/export.md`, 'utf8')).toContain('scripts/export-html.mjs');
  expect(tools.map(tool => tool.name)).toEqual(['eficy_validate', 'eficy_template']);
  const [validator, template] = tools;
  const execute = (tool: ToolDefinition, args: unknown) => tool.execute(args as never, {} as never);
  for (const source of ['export default () => <main />;', 'export default () => <main>', "import './x'; export default () => <main />;"]) {
    const args = { path: '/nonexistent/report.eficy', source };
    expect(await execute(validator, args)).toBe(validateSource(args));
  }
  expect(validator.parameters.required).toEqual(['path', 'source']);
  await expect(execute(validator, { path: 'a.eficy' })).rejects.toThrow();
  await expect(execute(template, { preset: 'unknown' })).rejects.toThrow();
  for (const preset of ['analytics', 'operations']) {
    const text = await execute(template, { preset }) as string;
    const result = JSON.parse(text);
    expect(result).toMatchObject({ path: `${preset}.eficy`, demoData: true, validator: 'eficy_validate' });
    expect(JSON.parse(await execute(validator, { path: result.path, source: result.source }) as string).valid).toBe(true);
    expect(template.output.render({ preset }, text)).toEqual([{ type: 'text', text }]);
  }
});

it('mounts and unregisters through real Cordis tools and skill services', async () => {
  const ctx = new Context();
  ctx.reflect.provide('systemPrompt', { tools() {} } as never);
  await ctx.plugin(ToolsService);
  await ctx.plugin(SkillRegistry);
  const fork = ctx.plugin(plugin);
  try {
    await fork;
    expect(ctx.tools.get('eficy_validate')?.name).toBe('eficy_validate');
    expect((await ctx.skills.get('eficy'))?.content).toContain('JSON.parse');
    await fork.dispose();
    expect(ctx.tools.get('eficy_validate')).toBeUndefined();
    expect(ctx.tools.get('eficy_template')).toBeUndefined();
    expect(await ctx.skills.get('eficy')).toBeUndefined();
  } finally { await ctx.fiber.dispose(); }
});
