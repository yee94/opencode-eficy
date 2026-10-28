import { createComponent, createEffect, createMemo, createSignal, mergeProps, onCleanup, untrack } from 'solid-js';
import { bindPlugin, LinkHandler, Panel, Plugin, Registry, Style, usePlugin, type PanelProps, type PanelTab } from '@opencode/plugin/gui';
import { createPreviewFrame } from './frame';
import { isPreviewFileLink } from './file-links';
import fileIcon from './file-icon.svg?raw';
import { createExportToolbar, exportMessages } from './export-toolbar';
import exportStyles from './export-toolbar.css?inline';
import { ExportPDF, ExportLongImage } from './export-contract';
import type { ExportFormat } from './export-types';
import { loadingStyles, loadingSVG } from './loading';

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
  const loading = document.createElement('section');
  loading.className = 'eficy-file-loading';
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  loading.setAttribute('aria-atomic', 'true');
  loading.innerHTML = loadingSVG;
  const title = document.createElement('p');
  title.className = 'eficy-loading-title';
  title.textContent = ctx.t('loading');
  const detail = document.createElement('p');
  detail.className = 'eficy-loading-detail';
  detail.textContent = ctx.t('loadingDetail');
  loading.append(title, detail);
  const status = document.createElement('p');
  status.className = 'eficy-file-status';
  status.setAttribute('role', 'alert');
  status.hidden = true;
  const retry = document.createElement('button');
  retry.className = 'eficy-file-retry';
  retry.type = 'button';
  retry.hidden = true;
  const surface = document.createElement('div');
  surface.className = 'eficy-file-surface';
  root.append(loading, status, retry, surface);
  const [attempt, setAttempt] = createSignal(0);
  retry.onclick = () => setAttempt(value => value + 1);
  onCleanup(() => { retry.onclick = null; });
  const path = createMemo(() => props.tab.file ?? '');
  const identity = createMemo(() => JSON.stringify([props.session.id, props.screen.file.root, path()]));
  const state = createMemo(() => props.screen.file.get(path()));
  const pdf = ctx.use(ExportPDF);
  const longImage = ctx.use(ExportLongImage);

  createEffect(() => {
    identity();
    const retrying = attempt() > 0;
    const file = props.screen.file;
    const target = path();
    const initialState = untrack(state);
    let active = true;
    let hasContent = false;
    let runtimeError = false;
    let fileError = '';
    let busy = true;
    const [failure, setFailure] = createSignal('');
    const [readSettled, setReadSettled] = createSignal(false);
    const [mounted, setMounted] = createSignal<ReturnType<typeof createPreviewFrame>>();
    const [renderReady, setRenderReady] = createSignal(false);
    let frame: ReturnType<typeof createPreviewFrame> | undefined;
    title.textContent = ctx.t('loading');
    detail.textContent = ctx.t('loadingDetail');
    const refresh = () => {
      loading.hidden = hasContent || runtimeError || !!fileError;
      root.setAttribute('aria-busy', String(busy && !fileError));
      if (frame) frame.element.style.visibility = hasContent || runtimeError ? 'visible' : 'hidden';
      status.textContent = fileError;
      status.hidden = !fileError;
      retry.hidden = !fileError;
    };
    refresh();
    void file.sync(target).then(() => {
      if (active) setReadSettled(true);
    }).catch((error: unknown) => {
      if (active) { setFailure(error instanceof Error ? error.message : String(error)); setReadSettled(true); }
    });
    // Let the real outer DOM paint before serializing and starting the inline runtime.
    let paint = requestAnimationFrame(() => {
      if (!active) return;
      paint = requestAnimationFrame(() => {
        if (!active) return;
        frame = createPreviewFrame({
          version: props.version,
          theme: props.theme,
          loadingText: {
            initial: ctx.t('preparing'), compiling: ctx.t('compiling'), dependencies: ctx.t('dependencies'),
            rendering: ctx.t('rendering'), detail: ctx.t('loadingDetail'),
          },
          onReadyChange: setRenderReady,
          onStatus: value => {
            if (!active) return;
            if (value.status === 'loading') {
              if (value.restart) hasContent = false;
              title.textContent = value.title;
              runtimeError = false;
              busy = true;
            } else {
              hasContent = value.status === 'committed' || value.hasContent;
              runtimeError = value.status === 'error';
              busy = false;
            }
            refresh();
          },
          openLink: (href, background) => {
            const file = props.screen.file;
            const current = file.resolve(path());
            const absolute = file.absolute(current) ? current : `${file.root}/${current}`;
            const base = absolute.slice(0, Math.max(absolute.lastIndexOf('/'), absolute.lastIndexOf('\\')) + 1);
            return ctx.links.open({ href, base, session: props.session, background });
          },
        });
        refresh();
        surface.append(frame.element);
        setMounted(frame);
      });
    });
    onCleanup(() => {
      active = false;
      cancelAnimationFrame(paint);
      file.unwatch(target);
      frame?.dispose();
      frame?.element.remove();
    });
    createEffect(() => {
      const current = mounted();
      if (current) current.element.title = ctx.t('preview');
      retry.textContent = ctx.t('retry');
    });
    createEffect(() => {
      const current = mounted();
      if (!current) return;
      const toolbar = createExportToolbar({ t: (key, params) => ctx.t(key, params), run: async (format, progress, signal) => {
        const read = format === 'pdf' ? pdf : longImage;
        const capability = read();
        if (capability.status !== 'active' || capability.value.version !== 1) {
          throw Object.assign(new Error('Export is no longer available.'), { code: 'EXPORT_UNSUPPORTED' });
        }
        const snapshot = await current.snapshot(progress, signal);
        signal.throwIfAborted();
        const latest = read();
        if (latest.status !== 'active' || latest.generation !== capability.generation || latest.value !== capability.value) {
          throw new DOMException('Export is no longer available.', 'AbortError');
        }
        const client = latest.value;
        const limits = client.limits;
        if (snapshot.width > limits.maxWidth || snapshot.height > limits.maxHeight || snapshot.width * snapshot.height > limits.maxPixels
          || new TextEncoder().encode(snapshot.html).byteLength > limits.maxHTMLBytes) {
          throw Object.assign(new Error('The report exceeds this device’s export limits.'), { code: 'EXPORT_TOO_LARGE' });
        }
        const filename = (path().split(/[\\/]/).at(-1) || 'report').replace(/\.eficy$/i, '') + '.' + format;
        const options = { signal, onProgress: progress };
        if (format === 'pdf' && 'exportPDF' in client) return client.exportPDF({ snapshot, filename, pageSize: 'a4' }, options);
        if (format === 'png' && 'exportLongImage' in client) return client.exportLongImage({ snapshot, filename }, options);
        throw Object.assign(new Error('This export format is unavailable.'), { code: 'EXPORT_UNSUPPORTED' });
      } });
      onCleanup(() => toolbar.dispose());
      const availability = (format: ExportFormat, active: boolean) => {
        if (toolbar.setAvailable(format, active)) root.insertBefore(toolbar.element, surface);
        else toolbar.element.remove();
        onCleanup(() => toolbar.cancel(format));
      };
      createEffect(() => { const live = pdf(); availability('pdf', live.status === 'active' && live.value.version === 1); });
      createEffect(() => { const live = longImage(); availability('png', live.status === 'active' && live.value.version === 1); });
      createEffect(() => toolbar.setReady(renderReady()));
      createEffect(() => toolbar.refresh());
    });
    const source = createMemo(() => {
      const current = state();
      return current?.loaded && !current.error && !current.notFound ? current.content?.content : undefined;
    });
    createEffect(() => {
      const value = source();
      const current = mounted();
      if (value !== undefined) {
        if (!hasContent && !runtimeError) title.textContent = ctx.t('preparing');
        current?.update(value);
      }
    });
    createEffect(() => {
      const current = state();
      const staleError = retrying && !readSettled() && current === initialState;
      fileError = failure() || (staleError ? '' : current?.error || (current?.notFound ? ctx.t('missing') : ''));
      if (!current?.loaded && !hasContent) title.textContent = ctx.t('loading');
      refresh();
    });
  });
  return root;
}

export function createGuiPlugin(options: { version: string; extension: string; priority: number; label: string; theme?: 'light' | 'dark' }) {
return Plugin.define({
  i18n: {
    en: { ...exportMessages.en, retry: 'Retry', preview: `${options.label} preview`, loading: 'Loading Eficy file…', missing: 'Eficy file not found', preparing: 'Preparing preview', compiling: 'Preparing page', dependencies: 'Loading components and styles', rendering: 'Rendering preview', loadingDetail: 'The first load may take a moment. Your preview will appear when ready.' },
    zh: { ...exportMessages.zh, retry: '重试', preview: `${options.label} 预览`, loading: '正在加载 Eficy 文件…', missing: '找不到 Eficy 文件', preparing: '正在准备预览', compiling: '正在准备页面', dependencies: '正在加载组件与样式', rendering: '正在呈现预览', loadingDetail: '首次加载可能需要一些时间，准备完成后会自动显示。' },
  },
  setup(ctx) {
    ctx.add(FileIcon, { id: ctx.id, extensions: [options.extension.split('.').at(-1)!], svg: fileIcon });
    ctx.add(Style, exportStyles);
    const View = bindPlugin((props: PanelProps) => createComponent(Preview, mergeProps(props, { version: options.version, theme: options.theme ?? 'dark' })));
    const tabs = new Map<string, PanelTab>();
    ctx.add(Style, `${loadingStyles('.eficy-file-loading')}.eficy-file-loading{position:absolute;min-height:100%}.eficy-file-preview{position:relative;height:100%;min-height:0;display:flex;flex-direction:column;color:inherit}.eficy-file-status{padding:8px 16px;white-space:pre-wrap;overflow-wrap:anywhere}.eficy-file-status[role=alert]{color:var(--status-error,currentColor)}.eficy-file-surface{flex:1;min-height:0;display:flex}.eficy-file-surface>iframe{width:100%;height:100%;min-height:240px;border:0;flex:1}`);
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
