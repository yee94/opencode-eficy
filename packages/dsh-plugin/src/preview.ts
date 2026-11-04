import { createPreviewFrame } from '../../../src/frame';
import { createExportToolbar } from '../../../src/export-toolbar';
import { downloadBlob, exportSnapshot } from './export';

export function mountPreview(container: HTMLElement, options: {
  source: string;
  filename: string;
  t: (key: string, params?: Record<string, string | number>) => string;
  openLink?: (href: string, background: boolean) => boolean;
}) {
  let disposed = false;
  const frame = createPreviewFrame({ openLink: options.openLink, onReadyChange: ready => toolbar.setReady(ready) });
  const toolbar = createExportToolbar({ t: options.t, run: async (format, progress, signal) => {
    const filename = options.filename.replace(/\.eficy$/i, '') + '.' + format;
    let blob: Blob;
    if (format === 'html') {
      progress({ stage: 'encoding' });
      await new Promise(resolve => setTimeout(resolve, 0));
      signal.throwIfAborted();
      blob = new Blob([frame.exportHTML(filename)], { type: 'text/html;charset=utf-8' });
    } else {
      const snapshot = await frame.snapshot(progress, signal);
      blob = await exportSnapshot(snapshot, format, progress, signal);
    }
    signal.throwIfAborted();
    if (disposed) throw new DOMException('Preview closed.', 'AbortError');
    progress({ stage: 'saving' });
    downloadBlob(blob, filename);
    return { status: 'saved' };
  } });
  for (const format of ['html', 'pdf', 'png'] as const) toolbar.setAvailable(format, true);
  frame.update(options.source);
  container.append(frame.element, toolbar.element);
  return { frame, toolbar, dispose() {
    if (disposed) return;
    disposed = true;
    toolbar.dispose();
    frame.dispose();
    container.replaceChildren();
  } };
}
