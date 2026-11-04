import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { EficyValidationError, parseEficy } from './parser';

export const validateDescription = '仅在用户要求校验或排查报错时诊断完整 .eficy TSX。返回 JSON 字符串，valid: true 表示本次静态校验结束；失败按 code/error 修复。不执行源码、不访问网络或文件。';
export const templateDescription = '返回暗色 shadcn 报告模板的 JSON 字符串，包含 path、source、demoData。先 JSON.parse，取 source 字段作为 TSX，替换演示数据后保存并交付链接；不写文件，无需默认追加校验。';
export const reportTemplates = { analytics: 'analytics.eficy', operations: 'operations.eficy' };

export async function loadSkill(moduleURL: string, name: string) {
  const path = fileURLToPath(new URL(`../skills/${name}/SKILL.md`, moduleURL));
  const [template, manifestText] = await Promise.all([
    readFile(path, 'utf8'), readFile(new URL('../dist/runtime-manifest.json', moduleURL), 'utf8'),
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
  return { path, content };
}

export function validateSource(input: unknown, extension = '.eficy'): string {
  try {
    if (!input || typeof input !== 'object' || !('path' in input) || !('source' in input) || typeof input.path !== 'string' || typeof input.source !== 'string') {
      throw new EficyValidationError('missing', 'Expected path and source strings.');
    }
    if (!input.path.endsWith(extension)) throw new EficyValidationError('path', `Expected a ${extension} file path.`);
    const result = parseEficy(input.path, input.source);
    return JSON.stringify({ valid: true, bytes: result.bytes, imports: result.imports });
  } catch (error) {
    return JSON.stringify({ valid: false, code: error instanceof EficyValidationError ? error.code : 'syntax', error: error instanceof Error ? error.message : String(error) });
  }
}

export async function loadTemplate(moduleURL: string, input: unknown, templates: Record<string, string>, validator = 'eficy_validate'): Promise<string> {
  if (!input || typeof input !== 'object' || !('preset' in input) || typeof input.preset !== 'string' || !Object.hasOwn(templates, input.preset)) {
    return JSON.stringify({ valid: false, error: `Choose a preset: ${Object.keys(templates).join(', ')}` });
  }
  const filename = templates[input.preset];
  const source = await readFile(new URL(`../samples/${filename}`, moduleURL), 'utf8');
  parseEficy(filename, source);
  return JSON.stringify({ path: `${input.preset}.eficy`, source, validator, demoData: true });
}
