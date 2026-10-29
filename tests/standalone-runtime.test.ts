import { afterEach, expect, it, vi } from 'vitest';
import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { previewDocument } from '../src/frame-document';
import runtime from '../src/generated/runtime';

afterEach(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'React');
  Reflect.deleteProperty(window, 'ReactDOM');
});

it('boots the exported runtime without a host, stays interactive and retries locally', async () => {
  const source = `export default function App() {
    const [count, setCount] = window.React.useState(0);
    return window.React.createElement('button', { onClick: () => setCount(count + 1) }, 'clicks ' + count);
  }`;
  const doc = new DOMParser().parseFromString(previewDocument({ source }), 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  Object.assign(window, { React, ReactDOM: { ...ReactDOM, createRoot } });
  class SourceBlob extends Blob {
    source: string;
    constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); this.source = parts.join(''); }
  }
  vi.stubGlobal('Blob', SourceBlob);
  let sequence = 0;
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => `data:text/javascript;base64,${Buffer.from((blob as SourceBlob).source).toString('base64')}#standalone-${sequence++}`);
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  const post = vi.spyOn(parent, 'postMessage').mockImplementation(() => {});
  const reload = vi.spyOn(window.location, 'reload').mockImplementation(() => {});
  await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(runtime.bootstrap).toString('base64')}#standalone`);
  await vi.waitFor(() => expect(document.querySelector('#eficy-root button')?.textContent).toBe('clicks 0'));
  document.querySelector<HTMLButtonElement>('#eficy-root button')!.click();
  await vi.waitFor(() => expect(document.querySelector('#eficy-root button')?.textContent).toBe('clicks 1'));
  expect(document.getElementById('eficy-loading')!.hidden).toBe(true);
  expect(post).not.toHaveBeenCalled();
  window.dispatchEvent(new MessageEvent('message', { source: parent, data: { protocol: 'eficy-preview', type: 'dispose' } }));
  expect(document.querySelector('#eficy-root button')?.textContent).toBe('clicks 1');
  const anchor = document.createElement('a');
  anchor.href = './other.html'; document.body.append(anchor);
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  anchor.dispatchEvent(click);
  expect(click.defaultPrevented).toBe(false);
  window.dispatchEvent(new ErrorEvent('error', { error: new Error('interaction failed') }));
  expect(document.getElementById('eficy-error')!.textContent).toBe('interaction failed');
  document.querySelector<HTMLButtonElement>('#eficy-error + button')!.click();
  expect(reload).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event('pagehide'));
  expect(revoke).toHaveBeenCalled();
});
