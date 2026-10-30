import { expect, it } from 'vitest';
import { previewDocument } from '../src/frame-document';
import runtime from '../src/generated/runtime';

it('places loading and error illustrations in the same fixed slot above independently scrollable explanations', () => {
  const doc = new DOMParser().parseFromString(previewDocument({ frameId: 'error-layout' }), 'text/html');
  for (const id of ['eficy-loading', 'eficy-error-state']) {
    const state = doc.getElementById(id)!;
    expect(state, id).not.toBeNull();
    expect(state.querySelector('.eficy-state-illustration svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(state.querySelector('.eficy-state-copy')).not.toBeNull();
  }
  const error = doc.getElementById('eficy-error-state')!;
  expect(error.hidden).toBe(true);
  expect(error.getAttribute('role')).toBe('alert');
  expect(error.querySelector('#eficy-error-title')?.textContent).toBe('无法显示预览');
  expect(error.querySelector('#eficy-error')).not.toBeNull();
  expect(error.querySelector<HTMLButtonElement>('#eficy-retry')?.textContent).toBe('重试');
  const css = doc.querySelector('style')!.textContent!;
  expect(css).toContain('top:calc(50% - 64px)');
  expect(css).toContain('top:calc(50% - 4px)');
  expect(css).toContain('overflow:auto');
});

it('escapes localized error copy and passes it to the runtime without interpreting HTML', () => {
  const errorText = { title: 'Preview <unavailable>', retry: 'Retry & reload', frameBoundary: 'Remove <script> and keep export default.' };
  const doc = new DOMParser().parseFromString(previewDocument({ frameId: 'translated-error', errorText }), 'text/html');
  expect(doc.getElementById('eficy-error-title')!.textContent).toBe(errorText.title);
  expect(doc.getElementById('eficy-retry')!.textContent).toBe(errorText.retry);
  expect(doc.querySelector('#eficy-error-state unavailable')).toBeNull();
  expect(JSON.parse(doc.getElementById('eficy-payload')!.textContent!).errorText).toEqual(errorText);
});

it('embeds source and the shared runtime without letting source or titles escape the document', () => {
  const source = `import { signal } from 'eficy';
import 'https://example.com/theme.css';
const text = signal('</script><script>window.injected = true</script> & 中文');
export default () => <p>{text}</p>;`;
  const title = '报告 </title><script>alert(1)</script> & 数据.html';
  const doc = new DOMParser().parseFromString(previewDocument({ source, title, theme: 'light' }), 'text/html');
  expect(doc.doctype?.name).toBe('html');
  expect(doc.title).toBe(title);
  expect(doc.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8');
  expect(doc.querySelector('meta[name=viewport]')).not.toBeNull();
  expect(doc.documentElement.style.colorScheme).toBe('light');
  const payload = JSON.parse(doc.querySelector('#eficy-payload')!.textContent!);
  expect(payload.source).toBe(source);
  expect(payload.eficy).toBe(runtime.eficy);
  expect(payload.frameId).toBeUndefined();
  expect(payload.snapshot).toBeUndefined();
  expect(doc.scripts).toHaveLength(3);
  expect(doc.querySelector('script[src]')).toBeNull();
  expect(doc.scripts[1].textContent).toBe(runtime.react.replace(/<\/script/gi, '<\\/script'));
  expect(doc.scripts[2].textContent).toBe(runtime.bootstrap.replace(/<\/script/gi, '<\\/script'));
});
