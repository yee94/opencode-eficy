import { Plugin, Skill } from '@opencode/plugin';
import { loadSkill, loadTemplate, templateDescription, validateDescription, validateSource } from './catalog';

export function createEficyPlugin(options: {
  id: string;
  moduleURL: string;
  skill: { name: string; description: string };
  validateTool: string;
  extension: string;
  templateTool?: string;
  templates?: Record<string, string>;
}) {
return Plugin.define({
  id: options.id,
  async setup(ctx) {
    const { path, content } = await loadSkill(options.moduleURL, options.skill.name);
    await ctx.skill.transform((editor) => editor.add({
      id: Skill.ID.make(options.skill.name),
      name: Skill.Name.make(options.skill.name),
      description: options.skill.description,
      path: Skill.Info.fields.path.make(path),
      content,
    }));
    await ctx.tool.transform((editor) => editor.add({
      name: options.validateTool,
      description: validateDescription,
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标 .eficy 文件路径，仅标识文件，不读取其内容。' },
          source: { type: 'string', description: '与交付文件一致的完整 TSX 源码；不是路径、JSON 包装或代码片段。' },
        },
        required: ['path', 'source'],
        additionalProperties: false,
      },
      execute: async (input) => ({ content: validateSource(input, options.extension) }),
    }));
    if (options.templateTool && options.templates) {
      const templates = options.templates;
      await ctx.tool.transform((editor) => editor.add({
        name: options.templateTool!,
        description: templateDescription,
        input: { type: 'object', properties: { preset: { type: 'string', enum: Object.keys(templates) } }, required: ['preset'], additionalProperties: false },
        execute: async (input) => ({ content: await loadTemplate(options.moduleURL, input, templates, options.validateTool) }),
      }));
    }
  },
});
}
