import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

it('declares and packages a self-contained image for dsh plugin metadata', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../packages/dsh-plugin');
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  expect(pkg.icon).toBe('./icon.svg');
  expect(pkg.exports['./icon']).toBe(pkg.icon);
  expect(pkg.exports['./package.json']).toBe('./package.json');
  expect(pkg.files).toContain('icon.svg');
  const source = await readFile(resolve(root, pkg.icon), 'utf8');
  expect(Buffer.byteLength(source)).toBeLessThanOrEqual(256 * 1024);
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  const svg = document.documentElement;
  expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(svg.getAttribute('viewBox')).toBe('0 0 128 128');
  expect(svg.getAttribute('width')).toBe(svg.getAttribute('height'));
  expect(document.querySelector('script, foreignObject, image, text, style')).toBeNull();
  expect(source).not.toMatch(/currentColor|\bvar\(|\son\w+=|\shref=/i);
  for (const match of source.matchAll(/url\(([^)]+)\)/g)) {
    expect(match[1]).toMatch(/^#[\w-]+$/);
    expect(document.getElementById(match[1].slice(1))).not.toBeNull();
  }
});
