import { expect, it } from 'vitest';
import { isLocalFileLink, isPreviewFileLink } from '../src/file-links';

it.each(['/workspace/中文 page.eficy', 'file:///workspace/%E4%B8%AD%E6%96%87%20page.eficy', 'C:\\workspace\\page.eficy', '\\\\server\\share\\page.eficy', '../next.eficy'])('recognizes local reference %s', href => {
  expect(isLocalFileLink(href)).toBe(true);
});

it.each(['', '#section', '?search', 'https://example.com/file.eficy', 'mailto:test@example.com', 'javascript:alert(1)', 'data:text/html,test', 'file://[invalid', '/file\u0000.eficy', undefined])('does not route non-file reference %s', href => {
  expect(isLocalFileLink(href)).toBe(false);
});

it.each(['report.shadcn.eficy', '/workspace/report.shadcn.eficy', 'file:///workspace/a.shadcn.eficy', '../report.shadcn.eficy?view=1#chart'])('allows overlapping suffixes for host priority routing: %s', href => {
  expect(isPreviewFileLink(href, '.shadcn.eficy')).toBe(true);
  expect(isPreviewFileLink(href, '.eficy')).toBe(true);
});

it('keeps ordinary files with the generic plugin and matches validator casing', () => {
  expect(isPreviewFileLink('page.eficy', '.eficy')).toBe(true);
  expect(isPreviewFileLink('page.eficy', '.shadcn.eficy')).toBe(false);
  expect(isPreviewFileLink('page.EFICY', '.eficy')).toBe(false);
  expect(isPreviewFileLink('page.eficy.tsx', '.eficy')).toBe(false);
});

it('never matches non-file references', () => {
  expect(isPreviewFileLink('https://example.com/file.shadcn.eficy', '.shadcn.eficy')).toBe(false);
  expect(isPreviewFileLink('#x.shadcn.eficy', '.shadcn.eficy')).toBe(false);
});
