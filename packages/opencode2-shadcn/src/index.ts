import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy-shadcn', moduleURL: import.meta.url,
  skill: { name: 'eficy-shadcn', description: 'Create compact dark data-analysis reports as one .shadcn.eficy preview, with evidence-backed conclusions, interactive charts and a 400–600px reading layout.' },
  validateTool: 'eficy_shadcn_validate', extension: '.shadcn.eficy',
  templateTool: 'eficy_shadcn_template',
  templates: { analytics: 'analytics.shadcn.eficy', operations: 'operations.shadcn.eficy' },
});
