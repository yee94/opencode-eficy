import { expect, it } from 'vitest';
import { isLocalFileLink } from '../src/file-links';

it.each(['/workspace/中文 page.eficy', 'file:///workspace/%E4%B8%AD%E6%96%87%20page.eficy', 'C:\\workspace\\page.eficy', '\\\\server\\share\\page.eficy', '../next.eficy'])('recognizes local reference %s', href => {
  expect(isLocalFileLink(href)).toBe(true);
});

it.each(['', '#section', '?search', 'https://example.com/file.eficy', 'mailto:test@example.com', 'javascript:alert(1)', 'data:text/html,test', 'file://[invalid', '/file\u0000.eficy', undefined])('does not route non-file reference %s', href => {
  expect(isLocalFileLink(href)).toBe(false);
});
