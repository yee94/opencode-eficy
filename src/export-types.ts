export type ExportFormat = 'pdf' | 'png';

/** Structural copy of the public Yuri GSAPI v1 contract; no host runtime import. */
export interface ViewExportSnapshot {
  html: string;
  width: number;
  height: number;
}

export interface ViewExportLimits {
  maxHTMLBytes: number;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
}

export interface ExportPDFInput {
  snapshot: ViewExportSnapshot;
  filename: string;
  pageSize?: 'a4' | 'letter';
}

export interface ExportLongImageInput {
  snapshot: ViewExportSnapshot;
  filename: string;
}

export interface ViewExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'saving';
  completed?: number;
  total?: number;
}

export interface ViewExportOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ViewExportProgress) => void;
}

export type ViewExportResult = { status: 'saved' | 'cancelled' };

export interface ExportPDFAPI {
  version: 1;
  limits: ViewExportLimits;
  exportPDF(input: ExportPDFInput, options?: ViewExportOptions): Promise<ViewExportResult>;
}

export interface ExportLongImageAPI {
  version: 1;
  limits: ViewExportLimits;
  exportLongImage(input: ExportLongImageInput, options?: ViewExportOptions): Promise<ViewExportResult>;
}

export type ViewExportErrorCode = 'EXPORT_UNSUPPORTED' | 'EXPORT_INVALID_INPUT' | 'EXPORT_TOO_LARGE'
  | 'EXPORT_BUSY' | 'EXPORT_ABORTED' | 'EXPORT_RENDER_FAILED' | 'EXPORT_SAVE_FAILED' | 'EXPORT_FORBIDDEN';

/** The iframe's capture stage precedes native rendering/encoding/saving. */
export type ExportProgress = Omit<ViewExportProgress, 'stage'> & { stage: ViewExportProgress['stage'] | 'capturing' };
