import { afterEach, expect, it, vi } from 'vitest';
import React from 'react';
import assets from '../src/generated/runtime';
import { previewDocument } from '../src/frame-document';

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'React');
  Reflect.deleteProperty(window, 'ReactDOM');
});

it('reports bootstrap failure before ready/revision delivery and exposes a working retry instead of loading', async () => {
  document.body.innerHTML = new DOMParser().parseFromString(previewDocument({ frameId: 'bootstrap-error' }), 'text/html').body.innerHTML;
  document.getElementById('eficy-payload')!.textContent = JSON.stringify({
    frameId: 'bootstrap-error', nonce: 'test', eficy: 'throw new Error("bootstrap failed");', shadcn: '',
    loadingText: { initial: 'Preparing', detail: 'Please wait' },
  });
  Object.assign(window, { React, ReactDOM: {} });
  class SourceBlob extends Blob {
    source: string;
    constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); this.source = parts.join(''); }
  }
  vi.stubGlobal('Blob', SourceBlob);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => `data:text/javascript;base64,${Buffer.from((blob as SourceBlob).source).toString('base64')}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const post = vi.spyOn(parent, 'postMessage').mockImplementation(() => {});
  // Verify the shipped inline bootstrap, not only the separately imported source.
  await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(assets.bootstrap).toString('base64')}`);
  await vi.waitFor(() => expect(post).toHaveBeenCalledWith({ protocol: 'eficy-preview', frameId: 'bootstrap-error', type: 'status', revision: 0, status: 'error', error: 'bootstrap failed', hasContent: false }, '*'));
  expect(document.getElementById('eficy-loading')!.hidden).toBe(true);
  expect(document.getElementById('eficy-error')!.hidden).toBe(false);
  expect(post).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ready' }), '*');
  document.querySelector<HTMLButtonElement>('#eficy-error + button')!.click();
  expect(document.getElementById('eficy-loading')!.hidden).toBe(false);
  expect(document.getElementById('eficy-error')!.hidden).toBe(true);
  expect(post).toHaveBeenLastCalledWith({ protocol: 'eficy-preview', frameId: 'bootstrap-error', type: 'retry' }, '*');
});
