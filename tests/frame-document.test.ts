import { expect, it } from 'vitest';
import { previewDocument } from '../src/frame-document';
import runtime from '../src/generated/runtime';

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
