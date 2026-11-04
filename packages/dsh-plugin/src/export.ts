import { jsPDF } from 'jspdf';
import type { ExportProgress, ViewExportSnapshot } from '../../../src/export-types';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

export function snapshotDimensions(snapshot: ViewExportSnapshot) {
  const { width, height } = snapshot;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || width > 16384 || height > 32767 || width * height > 16_777_216
    || new TextEncoder().encode(snapshot.html).byteLength > 32 * 1024 * 1024) {
    throw new Error('The report exceeds browser export limits (16 megapixels / 32 MiB).');
  }
  return { width: Math.ceil(width), height: Math.ceil(height) };
}

async function snapshotCanvas(snapshot: ViewExportSnapshot, signal: AbortSignal) {
  signal.throwIfAborted();
  const { width, height } = snapshotDimensions(snapshot);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas export is unavailable.');
  const image = new Image();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${snapshot.html}</foreignObject></svg>`;
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
      const abort = () => { cleanup(); image.src = ''; reject(signal.reason); };
      const timer = setTimeout(() => { cleanup(); image.src = ''; reject(new Error('Snapshot rendering timed out.')); }, 30000);
      signal.addEventListener('abort', abort, { once: true });
      image.onload = () => { cleanup(); resolve(); };
      image.onerror = () => { cleanup(); reject(new Error('This browser could not render the report snapshot. Try HTML export.')); };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
    signal.throwIfAborted();
    context.drawImage(image, 0, 0);
    return canvas;
  } catch (error) { canvas.width = canvas.height = 0; throw error; }
}

export async function exportSnapshot(snapshot: ViewExportSnapshot, format: 'pdf' | 'png', progress: (value: ExportProgress) => void, signal: AbortSignal): Promise<Blob> {
  progress({ stage: 'rendering' });
  const canvas = await snapshotCanvas(snapshot, signal);
  try {
    signal.throwIfAborted();
    progress({ stage: 'encoding' });
    if (format === 'png') {
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
      signal.throwIfAborted();
      return blob;
    }
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const width = pdf.internal.pageSize.getWidth();
    const height = pdf.internal.pageSize.getHeight();
    const pagePixels = Math.max(1, Math.floor(canvas.width * height / width));
    const pages = Math.ceil(canvas.height / pagePixels);
    const page = document.createElement('canvas');
    page.width = canvas.width;
    try {
      for (let index = 0; index < pages; index++) {
        await new Promise(resolve => setTimeout(resolve, 0));
        signal.throwIfAborted();
        page.height = Math.min(pagePixels, canvas.height - index * pagePixels);
        const context = page.getContext('2d');
        if (!context) throw new Error('Canvas export is unavailable.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, page.width, page.height);
        context.drawImage(canvas, 0, index * pagePixels, page.width, page.height, 0, 0, page.width, page.height);
        if (index) pdf.addPage();
        pdf.addImage(page, 'JPEG', 0, 0, width, page.height * width / page.width);
        progress({ stage: 'encoding', completed: index + 1, total: pages });
      }
      signal.throwIfAborted();
      return pdf.output('blob');
    } finally { page.width = page.height = 0; }
  } finally { canvas.width = canvas.height = 0; }
}
