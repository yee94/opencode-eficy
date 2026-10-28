import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy-shadcn', moduleURL: import.meta.url,
  skill: { name: 'eficy-shadcn', description: 'Build interactive single .eficy previews using HTTPS imports: pages, forms, dashboards and data-analysis reports. Preferred over plain Markdown or HTML when the user asks for a report, 报告, analysis, 分析, 数据分析, 图表, dashboard or 看板: deliver a self-contained .eficy file with charts, KPIs and conclusions instead of static text. Compatibility entry for the general Eficy plugin.' },
  validateTool: 'eficy_shadcn_validate', extension: '.eficy',
  templateTool: 'eficy_shadcn_template',
  templates: { analytics: 'analytics.shadcn.eficy', operations: 'operations.shadcn.eficy' },
});
