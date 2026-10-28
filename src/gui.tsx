import { createComponent, createEffect, createMemo, createSignal, mergeProps, onCleanup } from 'solid-js';
import { bindPlugin, LinkHandler, Panel, Plugin, Registry, Style, usePlugin, type PanelProps, type PanelTab } from '@opencode/plugin/gui';
import { createPreviewFrame } from './frame';
import { isPreviewFileLink } from './file-links';
import fileIcon from './file-icon.svg?raw';

const FileIcon = Registry.define<{ id: string; extensions: readonly string[]; svg: string; lightSvg?: string }>('yuri.file-icon');

function linkPath(link: { href: string; base?: string }) {
  const href = link.href.split(/[?#]/, 1)[0];
  return link.base && !/^(?:[a-z]+:|\/)/i.test(href) ? `${link.base}/${href}` : href;
}

function Preview(props: PanelProps & { version: string; theme: 'light' | 'dark' }): HTMLElement {
  const ctx = usePlugin();
  const root = document.createElement('section');
  root.className = 'eficy-file-preview';
  root.dataset.eficyPreview = '';
  const status = document.createElement('p');
  status.className = 'eficy-file-status';
  const surface = document.createElement('div');
  surface.className = 'eficy-file-surface';
  root.append(status, surface);
  const [failure, setFailure] = createSignal('');
  const path = createMemo(() => props.tab.file ?? '');
  const identity = createMemo(() => JSON.stringify([props.session.id, props.screen.file.root, path()]));
  const state = createMemo(() => props.screen.file.get(path()));

  createEffect(() => {
    identity();
    const file = props.screen.file;
    const target = path();
    let active = true;
    setFailure('');
    void file.sync(target).catch((error: unknown) => {
      if (active) setFailure(error instanceof Error ? error.message : String(error));
    });
    onCleanup(() => { active = false; file.unwatch(target); });
  });

  createEffect(() => {
    identity();
    const frame = createPreviewFrame({
      version: props.version,
      theme: props.theme,
      openLink: (href, background) => {
        const file = props.screen.file;
        const current = file.resolve(path());
        const absolute = file.absolute(current) ? current : `${file.root}/${current}`;
        const base = absolute.slice(0, Math.max(absolute.lastIndexOf('/'), absolute.lastIndexOf('\\')) + 1);
        return ctx.links.open({ href, base, session: props.session, background });
      },
    });
    createEffect(() => { frame.element.title = ctx.t('preview'); });
    surface.append(frame.element);
    onCleanup(() => { frame.dispose(); frame.element.remove(); });
    const source = createMemo(() => {
      const current = state();
      return current?.loaded && !current.error && !current.notFound ? current.content?.content : undefined;
    });
    createEffect(() => {
      const value = source();
      if (value !== undefined) frame.update(value);
    });
  });

  createEffect(() => {
    const current = state();
    const error = current?.error || (current?.notFound ? ctx.t('missing') : '')
      || (current?.loaded ? '' : failure());
    const message = error || (!current?.loaded ? ctx.t('loading') : '');
    if (status.textContent !== message) status.textContent = message;
    status.hidden = !message;
    if (error) status.setAttribute('role', 'alert');
    else status.removeAttribute('role');
  });
  return root;
}

export function createGuiPlugin(options: { version: string; extension: string; priority: number; label: string; theme?: 'light' | 'dark' }) {
return Plugin.define({
  i18n: {
    en: { preview: `${options.label} preview`, loading: 'Loading Eficy file…', missing: 'Eficy file not found' },
    zh: { preview: `${options.label} 预览`, loading: '正在加载 Eficy 文件…', missing: '找不到 Eficy 文件' },
  },
  setup(ctx) {
    ctx.add(FileIcon, { id: ctx.id, extensions: [options.extension.slice(1)], svg: fileIcon });
    const View = bindPlugin((props: PanelProps) => createComponent(Preview, mergeProps(props, { version: options.version, theme: options.theme ?? 'light' })));
    const tabs = new Map<string, PanelTab>();
    ctx.add(Style, '.eficy-file-preview{height:100%;min-height:0;display:flex;flex-direction:column;color:inherit}.eficy-file-status{padding:8px 16px;white-space:pre-wrap;overflow-wrap:anywhere}.eficy-file-status[role=alert]{color:var(--status-error,currentColor)}.eficy-file-surface{flex:1;min-height:0;display:flex}.eficy-file-surface>iframe{width:100%;height:100%;min-height:240px;border:0;flex:1}');
    ctx.add(LinkHandler, {
      priority: options.priority,
      match: (link) => isPreviewFileLink(link.href, options.extension),
      exists: (link) => {
        const file = ctx.screen.current()?.file;
        return file ? file.exists(file.resolve(linkPath(link))) : false;
      },
      open: (link) => {
        const screen = ctx.screen.current();
        const session = link.session ?? ctx.sessions.current();
        if (!screen || !session) return;
        ctx.layout.open(`${ctx.id}:${screen.file.resolve(linkPath(link))}`, session, { background: link.background });
      },
    });
    ctx.add(Panel, {
      id: 'preview', region: 'side', mobile: { title: options.label, order: 46, kind: 'menu' },
      list: ({ open }) => {
        const wanted = new Set(open.filter((path) => path.endsWith(options.extension)));
        for (const path of tabs.keys()) if (!wanted.has(path)) tabs.delete(path);
        return [...wanted].map((path) => {
          let tab = tabs.get(path);
          if (!tab) {
            tab = { id: path, title: path.split('/').at(-1) ?? path, file: path, closable: 'compact' };
            tabs.set(path, tab);
          }
          return tab;
        });
      },
      render: (props) => createComponent(View, props),
    });
  },
});
}
