import { Contract } from '@opencode/plugin/gui';
import type { ExportPDFAPI, ExportLongImageAPI } from './export-types';

export const ExportPDF = Contract.define<ExportPDFAPI, 'yuri.exportPDF'>('yuri.exportPDF');
export const ExportLongImage = Contract.define<ExportLongImageAPI, 'yuri.exportLongImage'>('yuri.exportLongImage');
