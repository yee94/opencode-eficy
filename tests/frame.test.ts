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
    data: { protocol: 'eficy-preview', frameId: options.id ?? frameId, type, ...options.data },
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
    receive('retry');
    frame.update('latest source');
    expect(post).toHaveBeenCalledTimes(1);
    receive('ready');
    expect(post.mock.calls.at(-1)?.[0]).toMatchObject({ type: 'update', source: 'latest source' });
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
