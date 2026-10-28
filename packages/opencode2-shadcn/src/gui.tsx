import { createGuiPlugin } from '../../../src/gui';
import pkg from '../package.json';

export default createGuiPlugin({ version: pkg.version, extension: '.shadcn.eficy', priority: 30, label: 'Eficy · shadcn', theme: 'dark' });
