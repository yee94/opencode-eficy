import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { FileTypeIcon, classifyFileType } from '@deepseek-ai/dsh-client-ui-primitives';
import { DocumentTitle } from '../packages/dsh-plugin/src/title';
import { sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import fileIcon from '../src/file-icon.svg?raw';

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  classifyFileType: vi.fn((name: string) => name.endsWith('.md') ? 'markdown' : 'other'),
  FileTypeIcon: (props: { kind: string; size: number; className: string }) => createElement('svg', { 'data-host-file-type': props.kind, width: props.size, height: props.size, className: props.className }),
}));

function render(path: string, title = path.split('/').at(-1)!) {
  return new DOMParser().parseFromString(renderToStaticMarkup(createElement(DocumentTitle, {
    useTabInfo: () => ({ tab: { title, contentId: sessionFileAddress('session', path) } }),
  } as never)), 'text/html').body;
}

it('uses the exact shared OpenCode artwork for Eficy tabs and preserves the title', () => {
  for (const path of ['reports/cards.eficy', 'report.shadcn.eficy', 'UPPER.EFICY']) {
    const title = '<report & filters>';
    const body = render(path, title);
    const image = body.querySelector('img')!;
    expect(image).not.toBeNull();
    expect(decodeURIComponent(image.getAttribute('src')!.split(',')[1])).toBe(fileIcon);
    expect(image.getAttribute('width')).toBe('16');
    expect(image.getAttribute('height')).toBe('16');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('aria-hidden')).toBe('true');
    expect(body.textContent).toBe(title);
    expect(body.querySelector('report')).toBeNull();
  }
});

it('keeps the host classification and artwork for every other document', () => {
  for (const path of ['readme.md', 'page.html', 'data.json', 'report.pdf', 'image.png', 'backup.eficy.bak']) {
    const body = render(path);
    expect(body.querySelector('img')).toBeNull();
    const original = new DOMParser().parseFromString(renderToStaticMarkup(createElement(FileTypeIcon, {
      kind: classifyFileType(path), size: 16, className: 'dsh-eficy-tab-icon',
    })), 'text/html');
    expect(body.querySelector('svg')?.outerHTML).toBe(original.querySelector('svg')?.outerHTML);
    expect(body.textContent).toBe(path);
  }
});
