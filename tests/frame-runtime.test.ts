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
const loading = () => document.getElementById('eficy-loading')!;
const busy = () => document.getElementById('eficy-root')!.getAttribute('aria-busy');
const gate = (name: string) => {
  let resolve!: () => void;
  Reflect.set(window, name, new Promise<void>(done => { resolve = done; }));
  return resolve;
};

beforeAll(async () => {
  document.body.innerHTML = '<section id="eficy-loading"><p id="eficy-loading-title"></p><p id="eficy-loading-detail"></p></section><pre id="eficy-error" hidden></pre><div id="eficy-root" aria-busy="true" hidden></div><script id="eficy-payload" type="application/json"></script>';
  document.getElementById('eficy-payload')!.textContent = JSON.stringify({ frameId, nonce: 'test', theme: 'dark', eficy: assets.eficy, shadcn: assets.shadcn, shadcnCSS: assets.shadcnCSS, loadingText: { initial: '正在准备预览', compiling: '正在准备页面', dependencies: '正在加载组件与样式', rendering: '正在呈现预览', detail: '准备完成后会自动显示。' } });
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
  it('keeps the bootstrap loading surface until source and its actual content commit', async () => {
    expect(loading().hidden).toBe(false);
    expect(busy()).toBe('true');
    const releaseModule = gate('initialModuleGate');
    const releaseRender = gate('initialRenderGate');
    send('await window.initialModuleGate; export default function App() { window.initialRenderAttempted = true; if (!window.initialRenderReady) throw window.initialRenderGate; return "stale initial content"; }');
    expect(loading().hidden).toBe(false);
    await vi.waitFor(() => expect(document.getElementById('eficy-loading-title')!.textContent).toBe('正在加载组件与样式'));
    expect(notices).toContainEqual({ protocol: 'eficy-preview', frameId, type: 'status', revision, status: 'loading', title: '正在加载组件与样式' });
    expect(notices).not.toContainEqual(expect.objectContaining({ type: 'status', status: 'committed' }));
    releaseModule();
    await vi.waitFor(() => expect(Reflect.get(window, 'initialRenderAttempted')).toBe(true));
    expect(loading().hidden).toBe(false);
    expect(document.getElementById('eficy-root')!.hidden).toBe(true);
    const releaseNewest = gate('newestInitialModuleGate');
    send(`await window.newestInitialModuleGate;
      export default function App() {
        window.React.useLayoutEffect(() => {
          window.initialLayout = {
            rootHidden: document.getElementById('eficy-root').hidden,
            loadingHidden: document.getElementById('eficy-loading').hidden,
          };
        }, []);
        return "first committed content";
      }`);
    Reflect.set(window, 'initialRenderReady', true);
    releaseRender();
    await vi.waitFor(() => expect(content()).toBe('stale initial content'));
    expect(loading().hidden).toBe(false);
    expect(document.getElementById('eficy-root')!.hidden).toBe(true);
    expect(busy()).toBe('true');
    releaseNewest();
    await vi.waitFor(() => expect(loading().hidden).toBe(true));
    await vi.waitFor(() => expect(content()).toBe('first committed content'));
    expect(loading().hidden).toBe(true);
    expect(document.getElementById('eficy-root')!.hidden).toBe(false);
    expect(busy()).toBe('false');
    expect(Reflect.get(window, 'initialLayout')).toEqual({ rootHidden: false, loadingHidden: false });
    expect(notices).toContainEqual({ protocol: 'eficy-preview', frameId, type: 'status', revision, status: 'committed' });
  });

  it('keeps existing interactive content visible while compiling, importing and suspending an update', async () => {
    send('export default function App() { const [count, setCount] = window.React.useState(0); return window.React.createElement("button", { onClick: () => setCount(count + 1) }, "clicks " + count); }');
    await vi.waitFor(() => expect(content()).toBe('clicks 0'));
    const releaseModule = gate('updateModuleGate');
    const releaseRender = gate('updateRenderGate');
    send('await window.updateModuleGate; export default function App() { window.updateRenderAttempted = true; if (!window.updateRenderReady) throw window.updateRenderGate; return "updated content"; }');
    expect(loading().hidden).toBe(true);
    expect(busy()).toBe('true');
    document.querySelector<HTMLButtonElement>('#eficy-root button')!.click();
    await vi.waitFor(() => expect(content()).toBe('clicks 1'));
    releaseModule();
    await vi.waitFor(() => expect(Reflect.get(window, 'updateRenderAttempted')).toBe(true));
    expect(content()).toBe('clicks 1');
    expect(loading().hidden).toBe(true);
    Reflect.set(window, 'updateRenderReady', true);
    releaseRender();
    await vi.waitFor(() => expect(content()).toBe('updated content'));
    expect(busy()).toBe('false');
  });

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
    send('import unsafe from "./module.js"; window.executed = true; export default function App() { return unsafe; }');
    await vi.waitFor(() => expect(error().hidden).toBe(false));
    expect(error().textContent).toContain('Only static imports');
    expect(notices).toContainEqual(expect.objectContaining({ type: 'status', revision, status: 'error', hasContent: true }));
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
    expect(notices).toContainEqual(expect.objectContaining({ type: 'status', revision, status: 'error', error: 'render broke', hasContent: false }));
    expect(loading().hidden).toBe(true);
    expect(busy()).toBe('false');
    send('export default function App() { return "recovered"; }');
    expect(loading().hidden).toBe(false);
    await vi.waitFor(() => expect(content()).toBe('recovered'));
    expect(error().hidden).toBe(true);
    consoleError.mockRestore();
  });

  it('ignores stale completion and errors while a newer revision is still loading, then retries failed source', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    send('export default () => { throw new Error("reset content"); };');
    await vi.waitFor(() => expect(error().textContent).toContain('reset content'));
    const releaseStale = gate('staleLoadingGate');
    const releaseLatest = gate('latestLoadingGate');
    send('await window.staleLoadingGate; window.staleLoadingFinished = true; throw new Error("stale failure"); export default () => "stale";');
    await vi.waitFor(() => expect(document.getElementById('eficy-loading-title')!.textContent).toBe('正在加载组件与样式'));
    const latest = 'await window.latestLoadingGate; if (!window.latestLoadingReady) throw new Error("dependency failed"); export default () => "retry recovered";';
    send(latest);
    releaseStale();
    await vi.waitFor(() => expect(Reflect.get(window, 'staleLoadingFinished')).toBe(true));
    expect(loading().hidden).toBe(false);
    expect(busy()).toBe('true');
    expect(error().hidden).toBe(true);
    releaseLatest();
    await vi.waitFor(() => expect(error().textContent).toContain('dependency failed'));
    expect(loading().hidden).toBe(true);
    expect(busy()).toBe('false');
    document.querySelector<HTMLButtonElement>('#eficy-error + button')!.click();
    expect(notices.at(-1)).toEqual({ protocol: 'eficy-preview', frameId, type: 'retry' });
    Reflect.set(window, 'latestLoadingReady', true);
    send(latest);
    expect(loading().hidden).toBe(false);
    await vi.waitFor(() => expect(content()).toBe('retry recovered'));
    expect(loading().hidden).toBe(true);
    expect(error().hidden).toBe(true);
    consoleError.mockRestore();
  });

  it('shows CSS failures, retries the same source and removes stale styles before committing the latest update', async () => {
    // Drive load/error deterministically rather than making network requests in happy-dom.
    const stylesheet = vi.spyOn(HTMLLinkElement.prototype, 'rel', 'set').mockImplementation(() => {});
    const source = `import "https://example.invalid/retry.css";
      export default function App() {
        window.React.useLayoutEffect(() => {
          window.measuredStylesheetMedia = document.querySelector('link[href="https://example.invalid/retry.css"]').media;
        }, []);
        return "styled";
      }`;
    send(source);
    await vi.waitFor(() => expect(document.querySelector('link[href="https://example.invalid/retry.css"]')).toBeTruthy());
    const failed = document.querySelector<HTMLLinkElement>('link[href="https://example.invalid/retry.css"]')!;
    failed.dispatchEvent(new Event('error'));
    await vi.waitFor(() => expect(error().textContent).toContain('Unable to load stylesheet'));
    expect(failed.isConnected).toBe(false);
    expect(content()).toBe('retry recovered');
    send(source);
    await vi.waitFor(() => expect(document.querySelector('link[href="https://example.invalid/retry.css"]')).toBeTruthy());
    const loaded = document.querySelector<HTMLLinkElement>('link[href="https://example.invalid/retry.css"]')!;
    loaded.dispatchEvent(new Event('load'));
    await vi.waitFor(() => expect(content()).toBe('styled'));
    expect(loaded.media).toBe('all');
    expect(Reflect.get(window, 'measuredStylesheetMedia')).toBe('all');
    send('import "https://example.invalid/stale.css"; export default () => "stale CSS";');
    await vi.waitFor(() => expect(document.querySelector('link[href="https://example.invalid/stale.css"]')).toBeTruthy());
    const stale = document.querySelector<HTMLLinkElement>('link[href="https://example.invalid/stale.css"]')!;
    send('export default () => "fresh CSS";');
    await vi.waitFor(() => expect(content()).toBe('fresh CSS'));
    expect(stale.isConnected).toBe(false);
    expect(loaded.isConnected).toBe(false);
    stale.dispatchEvent(new Event('load'));
    expect(content()).toBe('fresh CSS');
    expect(error().hidden).toBe(true);
    stylesheet.mockRestore();
  });

  it('skips identical source and revokes runtime and compiled URLs on disposal', async () => {
    const source = 'window.executionCount = (window.executionCount || 0) + 1; export default function App() { return "once"; }';
    send(source);
    await vi.waitFor(() => expect(content()).toBe('once'));
    const count = blobSequence;
    send(source);
    expect(blobSequence).toBe(count);
    expect(Reflect.get(window, 'executionCount')).toBe(1);
    const release = gate('disposedModuleGate');
    send('await window.disposedModuleGate; throw new Error("late after dispose"); export default () => "late";');
    await vi.waitFor(() => expect(document.getElementById('eficy-loading-title')!.textContent).toBe('正在加载组件与样式'));
    window.dispatchEvent(new MessageEvent('message', { source: parent, data: { protocol: 'eficy-preview', frameId, type: 'dispose' } }));
    expect(content()).toBe('');
    expect(notices).toContainEqual({ protocol: 'eficy-preview', frameId, type: 'disposed' });
    expect(revoked.mock.calls.length).toBe(blobSequence);
    const before = notices.length;
    release();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(notices).toHaveLength(before);
    send('export default function App() { return "ignored"; }');
    expect(content()).toBe('');
  });
});
