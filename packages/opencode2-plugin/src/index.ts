import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy', moduleURL: import.meta.url,
  skill: { name: 'eficy', description: '创建或修复 .eficy 交互页面、分析报告、看板和图表，默认 shadcn 暗色主题，保存后交付预览链接。简单查找、列举、问答直接回复；用户指定格式时遵循要求。' },
  validateTool: 'eficy_validate', extension: '.eficy',
  templateTool: 'eficy_template',
  templates: { analytics: 'analytics.eficy', operations: 'operations.eficy' },
});
