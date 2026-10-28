import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import assets from '../src/generated/runtime';

let revision = 0;
let blobSequence = 0;
const NativeBlob = Blob;
const revoked = vi.fn();
const notices: unknown[] = [];
const frameId = 'runtime-boundary-test';
const send = (source: string) => {
  window.dispatchEvent(new MessageEvent('message', { source: parent, data: { protocol: 'eficy-preview', frameId, type: 'update', source, revision: ++revision } }));
};
const content = () => document.getElementById('eficy-root')!.textContent;
const error = () => document.getElementById('eficy-error')!;

beforeAll(async () => {
  document.body.innerHTML = '<pre id="eficy-error" hidden></pre><div id="eficy-root"></div><script id="eficy-payload" type="application/json"></script>';
  document.getElementById('eficy-payload')!.textContent = JSON.stringify({ frameId, nonce: 'test', theme: 'dark', eficy: assets.eficy, shadcn: assets.shadcn, shadcnCSS: assets.shadcnCSS });
  Object.assign(window, { React, ReactDOM: { ...ReactDOM, createRoot, hydrateRoot } });
  class SourceBlob extends NativeBlob {
    source: string;
    constructor(parts: BlobPart[], options?: BlobPropertyBag) { super(parts, options); this.source = parts.join(''); }
  }
  vi.stubGlobal('Blob', SourceBlob);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => `data:text/javascript;base64,${Buffer.from((blob as SourceBlob).source).toString('base64')}#${blobSequence++}`);
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revoked);
  vi.spyOn(parent, 'postMessage').mockImplementation(message => { notices.push(message); });
  await import('../src/frame-runtime');
  await vi.waitFor(() => expect(notices).toContainEqual({ protocol: 'eficy-preview', frameId, type: 'ready' }));
});
afterAll(() => {
  window.dispatchEvent(new Event('pagehide'));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'React');
  Reflect.deleteProperty(window, 'ReactDOM');
});

describe('iframe execution boundary', () => {
  it('applies dark theme to the document so portal components inherit it', () => {
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
  it('intercepts nested local anchors without navigating the iframe and preserves raw paths', () => {
    for (const href of ['/workspace/中文 page.eficy', 'file:///workspace/%E4%B8%AD%E6%96%87%20page.eficy', 'C:\\workspace\\page.eficy']) {
      const anchor = document.createElement('a');
      anchor.setAttribute('href', href);
      anchor.innerHTML = '<span>Open file</span>';
      document.body.append(anchor);
      const event = new MouseEvent('click', { bubbles: true, composed: true, cancelable: true, ctrlKey: true });
      anchor.firstChild!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(notices.at(-1)).toEqual({ protocol: 'eficy-preview', frameId, type: 'open-link', href, background: true });
      anchor.remove();
    }
    const before = notices.length;
    const anchor = document.createElement('a');
    anchor.href = '#section';
    document.body.append(anchor);
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(notices).toHaveLength(before);
    anchor.remove();
  });

  it('validates with the shared parser before compiling or evaluating, retaining the previous render', async () => {
    send('export default function App() { return "previous content"; }');
    await vi.waitFor(() => expect(content()).toBe('previous content'));
    send('import unsafe from "https://example.invalid/module.js"; window.executed = true; export default function App() { return unsafe; }');
    await vi.waitFor(() => expect(error().hidden).toBe(false));
    expect(error().textContent).toContain('Only static imports');
    expect(content()).toBe('previous content');
    expect(Reflect.get(window, 'executed')).toBeUndefined();
  });

  it('ignores an older async module completing after a newer revision', async () => {
    send('await new Promise(resolve => setTimeout(resolve, 40)); export default function App() { return "stale"; }');
    await new Promise(resolve => setTimeout(resolve, 5));
    send('export default function App() { return "newest"; }');
    await vi.waitFor(() => expect(content()).toBe('newest'));
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(content()).toBe('newest');
    expect(error().hidden).toBe(true);
  });

  it('captures component render errors and can recover on the same root', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    send('export default function App() { throw new Error("render broke"); }');
    await vi.waitFor(() => expect(error().textContent).toContain('render broke'));
    send('export default function App() { return "recovered"; }');
    await vi.waitFor(() => expect(content()).toBe('recovered'));
    expect(error().hidden).toBe(true);
    consoleError.mockRestore();
  });

  it('skips identical source and revokes runtime and compiled URLs on disposal', async () => {
    const source = 'window.executionCount = (window.executionCount || 0) + 1; export default function App() { return "once"; }';
    send(source);
    await vi.waitFor(() => expect(content()).toBe('once'));
    const count = blobSequence;
    send(source);
    expect(blobSequence).toBe(count);
    expect(Reflect.get(window, 'executionCount')).toBe(1);
    window.dispatchEvent(new MessageEvent('message', { source: parent, data: { protocol: 'eficy-preview', frameId, type: 'dispose' } }));
    expect(content()).toBe('');
    expect(notices).toContainEqual({ protocol: 'eficy-preview', frameId, type: 'disposed' });
    expect(revoked.mock.calls.length).toBe(blobSequence);
    send('export default function App() { return "ignored"; }');
    expect(content()).toBe('');
  });
});
