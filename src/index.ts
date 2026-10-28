import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Plugin, Skill } from '@opencode/plugin';
import { EficyValidationError, parseEficy } from './parser';

export default Plugin.define({
  id: 'eficy',
  async setup(ctx) {
    const path = fileURLToPath(new URL('../skills/eficy/SKILL.md', import.meta.url));
    const [template, manifestText] = await Promise.all([
      readFile(path, 'utf8'),
      readFile(new URL('../dist/runtime-manifest.json', import.meta.url), 'utf8'),
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
      id: Skill.ID.make('eficy'),
      name: Skill.Name.make('eficy'),
      description: 'Create or repair single-file .eficy TSX interactive previews with built-in Eficy signals and shadcn components.',
      path: Skill.Info.fields.path.make(path),
      content,
    }));
    await ctx.tool.transform((editor) => editor.add({
      name: 'eficy_validate',
      description: 'Validate complete .eficy TSX text before saving. Parses syntax and built-in import boundaries without execution or file access.',
      input: {
        type: 'object',
        properties: { path: { type: 'string' }, source: { type: 'string' } },
        required: ['path', 'source'],
        additionalProperties: false,
      },
      execute: async (input) => {
        try {
          if (!input || typeof input !== 'object' || !('path' in input) || !('source' in input) || typeof input.path !== 'string' || typeof input.source !== 'string') {
            throw new EficyValidationError('missing', 'Expected path and source strings.');
          }
          const result = parseEficy(input.path, input.source);
          return { content: JSON.stringify({ valid: true, bytes: result.bytes, imports: result.imports }) };
        } catch (error) {
          return { content: JSON.stringify({ valid: false, code: error instanceof EficyValidationError ? error.code : 'syntax', error: error instanceof Error ? error.message : String(error) }) };
        }
      },
    }));
  },
});
