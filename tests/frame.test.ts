import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPreviewFrame } from '../src/frame';

const frames: ReturnType<typeof createPreviewFrame>[] = [];
function setup(options?: Parameters<typeof createPreviewFrame>[0]) {
  const frame = createPreviewFrame(options);
  frames.push(frame);
  document.body.append(frame.element);
  const html = new DOMParser().parseFromString(frame.element.srcdoc, 'text/html');
  const { frameId } = JSON.parse(html.querySelector('#eficy-payload')!.textContent!);
  const post = vi.spyOn(frame.element.contentWindow!, 'postMessage').mockImplementation(() => {});
  const receive = (type: string, options: { source?: Window; id?: string; data?: Record<string, unknown> } = {}) => window.dispatchEvent(new MessageEvent('message', {
    source: options.source ?? frame.element.contentWindow,
    data: { protocol: 'eficy-preview', frameId: options.id ?? /"frameId":"([^"]+)"/.exec(frame.element.srcdoc)?.[1] ?? frameId, type, ...options.data },
  }));
  return { frame, post, receive, html };
}
afterEach(() => {
  for (const frame of frames.splice(0)) frame.dispose();
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
describe('opaque preview frame lifecycle', () => {
  it('snapshots only the current rendered revision and authenticates progress and HTML responses', async () => {
    vi.useFakeTimers();
    const onReadyChange = vi.fn();
    const { frame, post, receive } = setup({ onReadyChange });
    frame.update('report');
    receive('ready');
    await expect(frame.snapshot(vi.fn())).rejects.toThrow('finish rendering');
    receive('status', { data: { revision: 0, status: 'committed' } });
    expect(onReadyChange).not.toHaveBeenCalledWith(true);
    receive('status', { data: { revision: 1, status: 'committed' } });
    const progress = vi.fn();
    const result = frame.snapshot(progress);
    const { requestId } = post.mock.calls.at(-1)![0];
    await expect(frame.snapshot(vi.fn())).rejects.toThrow('already running');
    receive('snapshot-progress', { source: window, data: { requestId, stage: 'capturing' } });
    receive('snapshot-progress', { data: { requestId: 'wrong', stage: 'capturing' } });
    expect(progress).not.toHaveBeenCalled();
    receive('snapshot-progress', { data: { requestId, stage: 'capturing' } });
    expect(progress).toHaveBeenCalledWith({ stage: 'capturing' });
    const snapshot = { html: '<div>current report</div>', width: 600, height: 1200 };
    receive('snapshot-result', { source: window, data: { requestId, snapshot: { ...snapshot, html: 'foreign' } } });
    receive('snapshot-result', { data: { requestId, snapshot } });
    expect(await result).toEqual(snapshot);
  });

  it.each(['abort', 'update', 'retry', 'dispose', 'timeout'] as const)('cancels exports on %s and ignores a late result', async action => {
    vi.useFakeTimers();
    const { frame, post, receive } = setup();
    frame.update('report');
    receive('ready');
    receive('status', { data: { revision: 1, status: 'committed' } });
    const abort = new AbortController();
    const result = frame.snapshot(vi.fn(), abort.signal);
    const assertion = expect(result).rejects.toThrow(action === 'timeout' ? 'timed out' : 'cancelled');
    const { requestId } = post.mock.calls.at(-1)![0];
    if (action === 'abort') abort.abort();
    if (action === 'update') frame.update('new report');
    if (action === 'retry') receive('retry');
    if (action === 'dispose') frame.dispose();
    if (action === 'timeout') vi.advanceTimersByTime(120000);
    await assertion;
    expect(post.mock.calls.some(([message]) => message.type === 'snapshot-cancel' && message.requestId === requestId)).toBe(true);
    receive('snapshot-result', { data: { requestId, snapshot: { html: '<div />', width: 1, height: 1 } } });
  });

  it('reports only current content commit/error, never iframe load or runtime readiness', () => {
    vi.useFakeTimers();
    const onStatus = vi.fn();
    const { frame, receive } = setup({ onStatus });
    frame.update('first');
    frame.element.dispatchEvent(new Event('load'));
    receive('ready');
    expect(onStatus).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'committed' }));
    receive('status', { data: { revision: 1, status: 'loading', title: 'dependencies' } });
    expect(onStatus).toHaveBeenLastCalledWith({ status: 'loading', title: 'dependencies' });
    frame.update('second');
    receive('status', { data: { revision: 1, status: 'committed' } });
    receive('status', { data: { revision: 1, status: 'error', error: 'stale' } });
    expect(onStatus).toHaveBeenLastCalledWith({ status: 'loading', title: 'dependencies' });
    receive('status', { data: { revision: 2, status: 'committed' } });
    expect(onStatus).toHaveBeenLastCalledWith({ status: 'committed' });
    frame.dispose();
    receive('status', { data: { revision: 2, status: 'error', error: 'late' } });
    expect(onStatus).toHaveBeenLastCalledWith({ status: 'committed' });
  });
  it('ships a centered accessible loading illustration before any runtime script executes', () => {
    vi.useFakeTimers();
    const { frame, html } = setup();
    const loading = html.querySelector<HTMLElement>('#eficy-loading')!;
    expect(loading.hidden).toBe(false);
    expect(loading.getAttribute('role')).toBe('status');
    expect(loading.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(loading.textContent).toContain('正在准备预览');
    expect(html.querySelector<HTMLElement>('#eficy-root')!.hidden).toBe(true);
    expect(frame.element.srcdoc.indexOf('id="eficy-loading"')).toBeLessThan(frame.element.srcdoc.indexOf('<script'));
    expect(html.querySelector('style')!.textContent).toContain('prefers-reduced-motion:reduce');
    expect(html.querySelector('style')!.textContent).toContain('animation:none');
    expect(html.querySelector('style')!.textContent).toContain('#eficy-loading{position:fixed;inset:0;');
    expect(html.documentElement.style.colorScheme).toBe('dark');
  });

  it('routes authenticated local links to the host and ignores foreign, external and disposed requests', async () => {
    vi.useFakeTimers();
    const openLink = vi.fn(() => true);
    const { frame, receive } = setup({ openLink });
    receive('ready');
    const data = { href: 'file:///workspace/%E4%B8%AD%E6%96%87%20page.eficy', background: true };
    receive('open-link', { source: window, data });
    receive('open-link', { id: 'foreign', data });
    receive('open-link', { data: { ...data, href: 'https://example.com/file.eficy' } });
    receive('open-link', { data });
    await Promise.resolve();
    expect(openLink).toHaveBeenCalledExactlyOnceWith(data.href, true);
    frame.dispose();
    receive('open-link', { data });
    await Promise.resolve();
    expect(openLink).toHaveBeenCalledTimes(1);
  });

  it('uses host loading translations in both the initial document and runtime payload as plain text', () => {
    vi.useFakeTimers();
    const loadingText = { initial: 'Preparing preview', compiling: 'Preparing page', dependencies: 'Loading components and styles', rendering: 'Rendering preview', detail: 'Wait <a moment> & keep this tab open.' };
    const { html } = setup({ theme: 'light', loadingText });
    expect(html.querySelector('#eficy-loading-title')!.textContent).toBe(loadingText.initial);
    expect(html.querySelector('#eficy-loading-detail')!.textContent).toBe(loadingText.detail);
    expect(html.querySelector('#eficy-loading-detail a')).toBeNull();
    expect(JSON.parse(html.querySelector('#eficy-payload')!.textContent!).loadingText).toEqual(loadingText);
    expect(html.documentElement.style.colorScheme).toBe('light');
  });

  it('reports a rejected file navigation in the existing frame', async () => {
    vi.useFakeTimers();
    const { receive, post } = setup({ openLink: () => false });
    receive('ready');
    receive('open-link', { data: { href: '/workspace/page.eficy', background: false } });
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'link-error', error: 'This host could not open the file link.' });
  });

  it('keeps only the latest pre-ready source and skips identical updates without reloading', () => {
    vi.useFakeTimers();
    const { frame, post, receive } = setup();
    const initial = frame.element.srcdoc;
    frame.update('first');
    frame.update('latest');
    expect(post).not.toHaveBeenCalled();
    receive('ready');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'update', source: 'latest', revision: 2 });
    frame.update('latest');
    receive('ready');
    expect(post).toHaveBeenCalledTimes(1);
    frame.update('next');
    expect(post).toHaveBeenCalledTimes(2);
    expect(frame.element.srcdoc).toBe(initial);
  });
  it('rejects foreign windows and other frame identifiers', () => {
    vi.useFakeTimers();
    const { frame, post, receive } = setup();
    frame.update('source');
    receive('ready', { source: window });
    receive('ready', { id: 'another-frame' });
    expect(post).not.toHaveBeenCalled();
    receive('ready');
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('restarts the isolated document on retry and resends the latest source after ready', () => {
    vi.useFakeTimers();
    const { frame, post, receive } = setup();
    frame.update('current source');
    receive('ready');
    const oldDocument = frame.element.srcdoc;
    receive('retry');
    expect(frame.element.srcdoc === oldDocument).toBe(true);
    vi.advanceTimersByTime(40);
    expect(frame.element.srcdoc === oldDocument).toBe(false);
    const restartedPost = vi.spyOn(frame.element.contentWindow!, 'postMessage').mockImplementation(() => {});
    const restarted = new DOMParser().parseFromString(frame.element.srcdoc, 'text/html');
    expect(restarted.querySelector<HTMLElement>('#eficy-loading')!.hidden).toBe(false);
    expect(restarted.querySelector<HTMLElement>('#eficy-root')!.hidden).toBe(true);
    frame.update('latest source');
    expect(post).toHaveBeenCalledTimes(1);
    receive('ready');
    expect(restartedPost.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'update', source: 'latest source' });
  });
  it('requests unmount then removes the frame on disposal acknowledgement and ignores updates', () => {
    vi.useFakeTimers();
    const { frame, post, receive } = setup();
    receive('ready');
    frame.dispose();
    frame.update('ignored');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toMatchObject({ type: 'dispose' });
    receive('disposed');
    expect(frame.element.isConnected).toBe(false);
    expect(frame.element.srcdoc).toBe('');
    receive('ready');
    expect(post).toHaveBeenCalledTimes(1);
  });
  it('bounds cleanup when the frame never acknowledges disposal', () => {
    vi.useFakeTimers();
    const { frame, receive } = setup();
    receive('ready');
    frame.dispose();
    vi.advanceTimersByTime(1000);
    expect(frame.element.isConnected).toBe(false);
  });
  it('ships opaque origin, restrictive network CSP and the actual pinned runtime texts', () => {
    vi.useFakeTimers();
    const { frame, html } = setup();
    expect(frame.element.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
    expect(frame.element.srcdoc).toContain("form-action 'none'");
    const csp = html.querySelector('meta[http-equiv]')!.getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain('connect-src blob:');
    const payload = JSON.parse(html.querySelector('#eficy-payload')!.textContent!);
    expect(payload.theme).toBe('dark');
    expect(payload.eficy).toContain('compileJSXWithCSS');
    expect(payload.shadcn).toContain('https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js');
    expect(frame.element.srcdoc).not.toContain('src="http');
  });
});
