import { createEficyPlugin } from '../../../src/index';

export default createEficyPlugin({
  id: 'eficy', moduleURL: import.meta.url,
  skill: { name: 'eficy', description: 'Create or repair single-file .eficy TSX interactive previews with built-in Eficy signals and shadcn components.' },
  validateTool: 'eficy_validate', extension: '.eficy',
});
