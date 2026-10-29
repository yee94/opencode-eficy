import { describe, expect, it, vi } from 'vitest';
import { LinkHandler, Panel, type Registry } from '@opencode/plugin/gui';
import generic from '../packages/opencode2-plugin/src/gui';

vi.mock('@opencode/plugin/gui', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@opencode/plugin/gui')>();
  return { ...sdk, bindPlugin: (component: unknown) => component };
});

const plugins = { eficy: generic };
type PluginID = keyof typeof plugins;

function host(ids: PluginID[]) {
  const entries: { plugin: string; registry: string; value: unknown }[] = [];
  const stored = new Set<string>();
  const open = vi.fn((key: string) => { stored.add(key); });
  for (const id of ids) {
    plugins[id].setup!({
      id,
      add: (registry: Registry<unknown>, value: unknown) => {
        if (registry.id === 'yuri.file-icon') {
          // Yuri indexes the final extension, not a compound preview suffix.
          for (const extension of (value as { extensions: string[] }).extensions) {
            if (!/^[a-z0-9][a-z0-9_+-]{0,63}$/.test(extension)) throw new Error('Invalid GUI file icon extension');
          }
        }
        entries.push({ plugin: id, registry: registry.id, value });
        return () => {};
      },
      screen: { current: () => ({ file: { resolve: (path: string) => path, exists: () => true } }) },
      sessions: { current: () => ({ id: 'session' }) },
      layout: { open },
    } as never);
  }
  const items = <T>(registry: Registry<T>) => entries.filter(entry => entry.registry === registry.id)
    .map(entry => ({ plugin: entry.plugin, value: entry.value as T }));
  // OpenCode host.tsx selects one handler; panels.tsx passes each panel only its plugin's stored ids.
  const click = (href: string) => {
    const handler = items(LinkHandler).map(entry => entry.value).filter(item => item.match({ href }))
      .reduce<LinkHandler | undefined>((best, item) => !best || (item.priority ?? 0) > (best.priority ?? 0) ? item : best, undefined);
    handler?.open({ href });
  };
  const tabs = () => items(Panel).flatMap(({ plugin, value }) => value.list({
    open: [...stored].filter(key => key.startsWith(`${plugin}:`)).map(key => key.slice(plugin.length + 1)),
  } as never).map(tab => `${plugin}:${tab.id}`));
  return { click, open, tabs, items, stored, entries };
}

describe('GUI plugin routing and panel contracts', () => {
  it('ships without a plugin main entry', () => {
    expect(generic.main).toBeUndefined();
  });
  it('registers the final file extension for compound shadcn preview names', () => {
    const app = host(['eficy']);
    const icon = app.entries.find(entry => entry.registry === 'yuri.file-icon')!.value as { extensions: string[] };
    expect(icon.extensions).toEqual(['eficy']);
    app.click('report.shadcn.eficy');
    expect(app.tabs()).toEqual(['eficy:report.shadcn.eficy']);
  });
  it('routes each file once and reuses its existing tab', () => {
    const app = host(['eficy']);
    app.click('report.shadcn.eficy');
    expect(app.open).toHaveBeenCalledTimes(1);
    expect(app.tabs()).toEqual(['eficy:report.shadcn.eficy']);
    app.click('page.eficy');
    expect(app.open).toHaveBeenCalledTimes(2);
    expect(app.tabs().sort()).toEqual(['eficy:page.eficy', 'eficy:report.shadcn.eficy']);
    app.click('report.shadcn.eficy');
    expect(app.tabs()).toHaveLength(2);
    expect(app.items(Panel).map(entry => entry.value.mobile?.title).sort()).toEqual(['Eficy']);
    expect(app.entries.filter(entry => entry.registry === 'yuri.file-icon').map(entry => (entry.value as { id: string }).id).sort())
      .toEqual(['eficy']);
  });

  it('lets the generic plugin preview both suffixes on its own', () => {
    const app = host(['eficy']);
    app.click('page.eficy');
    app.click('report.shadcn.eficy');
    expect(app.tabs()).toEqual(['eficy:page.eficy', 'eficy:report.shadcn.eficy']);
  });

  it('leaves remote URLs and fragment links to the host', () => {
    const app = host(['eficy']);
    for (const href of ['https://example.com/report.shadcn.eficy', '#report.shadcn.eficy', '?page.eficy']) app.click(href);
    expect(app.open).not.toHaveBeenCalled();
  });

  it('reuses stored generic tabs', () => {
    const app = host(['eficy']);
    app.stored.add('eficy:report.shadcn.eficy');
    app.click('report.shadcn.eficy');
    expect(app.tabs()).toEqual(['eficy:report.shadcn.eficy']);
  });
});
