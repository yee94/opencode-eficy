import { afterEach, expect, it, vi } from 'vitest';
import { exportSnapshot, snapshotDimensions } from '../packages/dsh-plugin/src/export';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('bounds browser snapshot dimensions and rejects invalid inputs', () => {
  expect(snapshotDimensions({ html: '<div/>', width: 100, height: 200 })).toEqual({ width: 100, height: 200 });
  for (const size of [{ width: 0, height: 1 }, { width: NaN, height: 1 }, { width: 16385, height: 1 }, { width: 1, height: 32768 }, { width: 8192, height: 8192 }]) {
    expect(() => snapshotDimensions({ html: '', ...size })).toThrow('browser export limits');
  }
});

it('does not allocate or generate files for an already cancelled export', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(exportSnapshot({ html: '', width: 100, height: 200 }, 'png', vi.fn(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

function canvasEnvironment() {
  vi.stubGlobal('Image', class { onload?: () => void; onerror?: () => void; set src(value: string) { if (value) queueMicrotask(() => this.onload?.()); } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn(), fillRect: vi.fn() } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==');
}

it('encodes PNG and generates a real multipage PDF from the captured snapshot', async () => {
  canvasEnvironment();
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['PNG'], { type: 'image/png' })));
  const progress = vi.fn();
  const snapshot = { html: '<div xmlns="http://www.w3.org/1999/xhtml">hello</div>', width: 100, height: 400 };
  const png = await exportSnapshot(snapshot, 'png', progress, new AbortController().signal);
  expect(png.type).toBe('image/png');
  const pdf = await exportSnapshot(snapshot, 'pdf', progress, new AbortController().signal);
  const text = await pdf.text();
  expect(text).toMatch(/^%PDF-/);
  expect(text).toContain('/Count 3');
  expect(progress).toHaveBeenCalledWith({ stage: 'encoding', completed: 3, total: 3 });
});
