import React, { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { apply } from '../packages/dsh-plugin/src/client';
import { mountPreview } from '../packages/dsh-plugin/src/preview';
import { exportMessages } from '../src/export-toolbar';
import { previewLinkAddress } from '../packages/dsh-plugin/src/links';
import { parseFileAddress, sessionFileAddress } from '@deepseek-ai/dsh-util-workspace-path';

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  classifyFileType: vi.fn((name: string) => name.endsWith('.md') ? 'markdown' : 'other'),
  FileTypeIcon: (props: { kind: string; size: number; className: string }) => createElement('svg', { 'data-host-file-type': props.kind, width: props.size, height: props.size, className: props.className }),
}));

let root: Root | undefined;
const cleanups: (() => void)[] = [];
afterEach(() => { root?.unmount(); root = undefined; for (const cleanup of cleanups.splice(0).reverse()) cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); });

function register() {
  let component: React.ComponentType<any> | undefined;
  const unregister = vi.fn();
  const metadata = vi.fn(() => unregister);
  const slot = vi.fn((definition, body) => {
    if (definition.name === 'sidebar.right.tab.document') component = body;
    return unregister;
  });
  apply({
    effect: (callback: () => (() => void)) => cleanups.push(callback()),
    locale: { register: () => unregister },
    documentPreviews: { register: metadata },
    slots: { inject: (_key: string, callback: () => (() => void)) => callback(), register: slot },
    configForms: { developerTools: { enabled: {} } },
  } as never);
  return { component: component!, metadata, slot, unregister };
}

const t = (key: string) => exportMessages.en[key as keyof typeof exportMessages.en] || key;

it('registers an extension renderer, reversible styles and a keyed body', () => {
  const registration = register();
  expect(registration.metadata).toHaveBeenCalledWith(expect.objectContaining({ extensions: ['eficy'], loading: 'bytes-complete' }));
  expect(registration.slot).toHaveBeenCalledWith(expect.objectContaining({ name: 'sidebar.right.tab.document', key: '@eficy/dsh-plugin' }), expect.any(Function));
  expect(registration.slot).toHaveBeenCalledWith({ name: 'sidebar.right.pane.tab.title', key: '@deepseek-ai/dsh-client-ui-sidebar-documentpreview', priority: -1 }, expect.any(Function));
  expect(document.head.textContent).toContain('.dsh-eficy-preview');
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
  expect(registration.unregister).toHaveBeenCalled();
  expect(document.head.textContent).not.toContain('.dsh-eficy-preview');
});

it('does not execute a preview when Coding Tools is off and retires frames on disable', async () => {
  const { component } = register();
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const props = {
    content: { kind: 'bytes', data: new TextEncoder().encode('export default () => <main />;') },
    resourceAddress: 'dsh-resource://file/session/test/report.eficy',
    useTabInfo: () => ({ tab: { actions: { openResource: vi.fn() } } }), t,
  };
  root.render(createElement(component, { ...props, useInteractivePreview: () => false }));
  await vi.waitFor(() => expect(container.textContent).toContain('disabled'));
  expect(container.querySelector('iframe')).toBeNull();
  root.render(createElement(component, { ...props, useInteractivePreview: () => true }));
  await vi.waitFor(() => expect(container.querySelector('iframe')).not.toBeNull());
  expect(container.querySelector('iframe')!.getAttribute('sandbox')).toBe('allow-scripts allow-forms');
  root.render(createElement(component, { ...props, useInteractivePreview: () => false }));
  await vi.waitFor(() => expect(container.querySelector('iframe')).toBeNull());
  expect(container.textContent).toBe('disabled');
});

it('resolves local links against the source Session and decodes filenames once', () => {
  const source = sessionFileAddress('source-session', 'reports/current.eficy');
  const relative = previewLinkAddress(source, '../next%20report.eficy?preview#section');
  expect(parseFileAddress(relative!)).toMatchObject({ scope: 'session', sessionId: 'source-session', path: 'reports/../next report.eficy' });
  expect(parseFileAddress(previewLinkAddress(source, 'file:///tmp/100%25.eficy')!)).toMatchObject({ path: '/tmp/100%.eficy' });
  expect(parseFileAddress(previewLinkAddress(source, 'file:///C:/reports/result.eficy')!)).toMatchObject({ path: 'C:/reports/result.eficy' });
  for (const href of ['https://example.com/page', 'javascript:alert(1)', '#section']) expect(previewLinkAddress(source, href)).toBeUndefined();
});

it('rejects oversized files before mounting the runtime', async () => {
  const { component } = register();
  const container = document.createElement('div'); document.body.append(container);
  root = createRoot(container);
  root.render(createElement(component, {
    content: { kind: 'bytes', data: new Uint8Array(128 * 1024 + 1) },
    resourceAddress: 'dsh-resource://file/session/test/report.eficy', t,
    useInteractivePreview: () => true, useTabInfo: () => ({ tab: { actions: {} } }),
  }));
  await vi.waitFor(() => expect(container.querySelector('[role="alert"]')?.textContent).toBe('invalid'));
  expect(container.querySelector('iframe')).toBeNull();
});

it('reuses the shared frame and export menu and releases both on disposal', () => {
  const container = document.createElement('div'); document.body.append(container);
  const view = mountPreview(container, { source: 'export default () => <main />;', filename: 'report.eficy', t });
  expect([...container.querySelectorAll('.eficy-export-choices button')].map(node => node.textContent)).toEqual(['Export PDF', 'Export PNG image', 'Export HTML']);
  expect(container.querySelectorAll('iframe')).toHaveLength(1);
  expect(container.querySelector('summary')?.getAttribute('aria-disabled')).toBe('true');
  view.dispose(); view.dispose();
  expect(container.children).toHaveLength(0);
});
