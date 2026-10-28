import { createGuiPlugin } from '../../../src/gui';
import pkg from '../package.json';

export default createGuiPlugin({ version: pkg.version, extension: '.eficy', priority: 20, label: 'Eficy' });
