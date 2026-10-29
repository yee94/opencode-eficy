import { Contract } from '@opencode/plugin/gui';
import type { ExportProgress, ViewExportSnapshot } from './export-types';

/** Structural host contract: registration is scoped to the current mounted Panel owner. */
export interface PreviewSnapshotOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExportProgress) => void;
}

export interface PreviewActionSurface {
  readonly element: HTMLElement;
  readonly signal: AbortSignal;
  snapshot(options?: PreviewSnapshotOptions): Promise<ViewExportSnapshot>;
}

export interface PreviewActionsAPI {
  readonly version: 1;
  register(input: {
    element: HTMLElement;
    capture(options: PreviewSnapshotOptions): Promise<ViewExportSnapshot>;
    render(surface: PreviewActionSurface): HTMLElement;
  }): () => void;
}

export const PreviewActions = Contract.define<PreviewActionsAPI, 'yuri.previewActions'>('yuri.previewActions');
