import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy', moduleURL: import.meta.url,
  skill: { name: 'eficy', description: '创建或修复 Eficy + shadcn 单文件交互页面与报告。用户需要出页面、出报告、做分析、制作看板或图表时默认使用：采用 shadcn 组件、暗色语义主题和内置报告规范，交付 .eficy 文件及预览链接。包含经营分析与履约分析完整模板；用户明确指定其他风格或格式时遵循其要求。' },
  validateTool: 'eficy_validate', extension: '.eficy',
  templateTool: 'eficy_template',
  templates: { analytics: 'analytics.eficy', operations: 'operations.eficy' },
});
