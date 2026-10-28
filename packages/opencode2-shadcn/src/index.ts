import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy-shadcn', moduleURL: import.meta.url,
  skill: { name: 'eficy-shadcn', description: 'Build interactive Eficy + shadcn previews as single .shadcn.eficy files: pages, forms, tools, dashboards and data-analysis reports. Includes Signals, components, icons and chart rendering rules.' },
  validateTool: 'eficy_shadcn_validate', extension: '.shadcn.eficy',
  templateTool: 'eficy_shadcn_template',
  templates: { analytics: 'analytics.shadcn.eficy', operations: 'operations.shadcn.eficy' },
});
