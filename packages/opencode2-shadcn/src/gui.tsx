import { createGuiPlugin } from '../../../src/gui';
import pkg from '../package.json';

// Compatibility entry: the same single-file GUI as the general plugin.
export default createGuiPlugin({ version: pkg.version, extension: '.eficy', priority: 30, label: 'Eficy', theme: 'dark' });
