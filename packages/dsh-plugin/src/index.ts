import { dirname } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-skill';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { loadSkill, loadTemplate, reportTemplates, templateDescription, validateDescription, validateSource } from '../../../src/catalog';

export const name = 'eficy';
export const inject = ['tools', 'skills'];

export async function apply(ctx: Context) {
  const skill = await loadSkill(import.meta.url, 'eficy');
  ctx.skills.register({
    name: 'eficy', description: skill.content.match(/^description: (.+)$/m)![1],
    path: skill.path, source: 'bundled',
    resourceBase: { kind: 'directory', path: dirname(skill.path) },
    content: skill.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, ''),
  });
  ctx.tools.register(defineTool({
    name: 'eficy_validate', description: validateDescription,
    parameters: {
      path: { type: 'string', required: true, description: '目标 .eficy 路径，仅标识文件，不读取文件。' },
      source: { type: 'string', required: true, description: '与交付文件一致的完整 TSX 源码。' },
    },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute(args) { return validateSource(args); },
  }));
  ctx.tools.register(defineTool({
    name: 'eficy_template', description: templateDescription,
    parameters: { preset: { type: 'string', enum: ['analytics', 'operations'], required: true } },
    output: { schema: { type: 'string' }, render: (_args, text) => [{ type: 'text', text }] },
    async execute(args) { return loadTemplate(import.meta.url, args, reportTemplates); },
  }));
}
