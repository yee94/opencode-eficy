import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Plugin, Skill } from '@opencode/plugin';
import { EficyValidationError, parseEficy } from './parser';

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
    const path = fileURLToPath(new URL(`../skills/${options.skill.name}/SKILL.md`, options.moduleURL));
    const [template, manifestText] = await Promise.all([
      readFile(path, 'utf8'),
      readFile(new URL('../dist/runtime-manifest.json', options.moduleURL), 'utf8'),
    ]);
    const manifest = JSON.parse(manifestText) as { pluginVersion?: unknown; packages?: unknown };
    if (typeof manifest.pluginVersion !== 'string' || !manifest.packages || typeof manifest.packages !== 'object' || Array.isArray(manifest.packages)) {
      throw new Error('Invalid Eficy runtime manifest; rebuild the plugin runtime.');
    }
    const packages = Object.entries(manifest.packages);
    if (!packages.length || packages.some(([, version]) => typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version))) {
      throw new Error('Eficy runtime manifest must contain exact package versions.');
    }
    const content = template.replace('{{RUNTIME_VERSIONS}}', [
      `插件版本：${manifest.pluginVersion}`,
      ...packages.sort(([a], [b]) => a.localeCompare(b)).map(([name, version]) => `- ${name}: ${version}`),
    ].join('\n'));
    await ctx.skill.transform((editor) => editor.add({
      id: Skill.ID.make(options.skill.name),
      name: Skill.Name.make(options.skill.name),
      description: options.skill.description,
      path: Skill.Info.fields.path.make(path),
      content,
    }));
    await ctx.tool.transform((editor) => editor.add({
      name: options.validateTool,
      description: '仅在用户要求校验或排查报错时诊断完整 .eficy TSX。返回 JSON 字符串，valid: true 表示本次静态校验结束；失败按 code/error 修复。不执行源码、不访问网络或文件。',
      input: {
        type: 'object',
        properties: {
          path: { type: 'string', description: '目标 .eficy 文件路径，仅标识文件，不读取其内容。' },
          source: { type: 'string', description: '与交付文件一致的完整 TSX 源码；不是路径、JSON 包装或代码片段。' },
        },
        required: ['path', 'source'],
        additionalProperties: false,
      },
      execute: async (input) => {
        try {
          if (!input || typeof input !== 'object' || !('path' in input) || !('source' in input) || typeof input.path !== 'string' || typeof input.source !== 'string') {
            throw new EficyValidationError('missing', 'Expected path and source strings.');
          }
          if (!input.path.endsWith(options.extension)) throw new EficyValidationError('path', `Expected a ${options.extension} file path.`);
          const result = parseEficy(input.path, input.source);
          return { content: JSON.stringify({ valid: true, bytes: result.bytes, imports: result.imports }) };
        } catch (error) {
          return { content: JSON.stringify({ valid: false, code: error instanceof EficyValidationError ? error.code : 'syntax', error: error instanceof Error ? error.message : String(error) }) };
        }
      },
    }));
    if (options.templateTool && options.templates) {
      const templates = options.templates;
      await ctx.tool.transform((editor) => editor.add({
        name: options.templateTool!,
        description: '返回暗色 shadcn 报告模板的 JSON 字符串，包含 path、source、demoData。先 JSON.parse，取 source 字段作为 TSX，替换演示数据后保存并交付链接；不写文件，无需默认追加校验。',
        input: { type: 'object', properties: { preset: { type: 'string', enum: Object.keys(templates) } }, required: ['preset'], additionalProperties: false },
        execute: async (input) => {
          if (!input || typeof input !== 'object' || !('preset' in input) || typeof input.preset !== 'string' || !Object.hasOwn(templates, input.preset)) {
            return { content: JSON.stringify({ valid: false, error: `Choose a preset: ${Object.keys(templates).join(', ')}` }) };
          }
          const filename = templates[input.preset];
          const source = await readFile(new URL(`../samples/${filename}`, options.moduleURL), 'utf8');
          parseEficy(filename, source);
          return { content: JSON.stringify({ path: `${input.preset}.eficy`, source, validator: options.validateTool, demoData: true }) };
        },
      }));
    }
  },
});
}
