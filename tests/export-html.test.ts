import { expect, it } from 'vitest';
import { snapshotDocument } from '../src/export-html';

it('opens as a complete HTML document with embedded assets, current controls and the captured theme', () => {
  const root = document.createElement('div');
  root.style.cssText = 'background-color: rgb(10, 20, 30); color-scheme: dark';
  root.innerHTML = '<style>.report > span::before{content:"&"}@font-face{font-family:Report;src:url(data:font/woff2;base64,YQ==)}</style><div></div><p>当前报告 & 数据</p><img src="data:image/png;base64,Yg=="><input value="当前筛选" checked><textarea>当前输入</textarea><svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10"/></svg>';
  const snapshot = { html: new XMLSerializer().serializeToString(root), width: 600, height: 1200 };
  const title = '报告 </title><script>alert(1)</script> & 数据.html';
  const content = snapshotDocument(snapshot, title);
  const doc = new DOMParser().parseFromString(content, 'text/html');
  expect(doc.doctype?.name).toBe('html');
  expect(doc.title).toBe(title);
  expect(doc.querySelector('meta[charset]')?.getAttribute('charset')).toBe('utf-8');
  expect(doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
  expect(doc.body.style.width).toBe('600px');
  expect(doc.documentElement.style.backgroundColor).toBe('rgb(10, 20, 30)');
  expect(doc.documentElement.style.colorScheme).toBe('dark');
  expect(doc.querySelector('style')?.textContent).toBe(root.querySelector('style')!.textContent);
  expect(doc.querySelector('p')?.textContent).toBe('当前报告 & 数据');
  expect(doc.querySelector('p')?.previousElementSibling?.innerHTML).toBe('');
  expect(doc.querySelector('img')?.src).toBe('data:image/png;base64,Yg==');
  expect(doc.querySelector('input')?.value).toBe('当前筛选');
  expect(doc.querySelector('input')?.checked).toBe(true);
  expect(doc.querySelector('textarea')?.value).toBe('当前输入');
  expect(doc.querySelector('svg path')?.getAttribute('d')).toBe('M0 0h10');
  expect(doc.querySelector('script,link')).toBeNull();
});
