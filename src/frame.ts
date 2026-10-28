import runtime from './generated/runtime';
import { isLocalFileLink } from './file-links';
import type { ExportProgress, ViewExportSnapshot } from './export-types';
import { loadingStyles, loadingSVG } from './loading';

export type PreviewStatus = { status: 'loading'; title: string; restart?: boolean } | { status: 'committed' } | { status: 'error'; error: string; hasContent: boolean };

/** Each preview owns its opaque-origin document and React runtime. */
export function createPreviewFrame(options: { version?: string; theme?: 'light' | 'dark'; loadingText?: { initial: string; compiling: string; dependencies: string; rendering: string; detail: string }; onStatus?: (status: PreviewStatus) => void; openLink?: (href: string, background: boolean) => boolean | Promise<boolean>; onReadyChange?: (ready: boolean) => void } = {}): {
  element: HTMLIFrameElement;
  update(source: string): void;
  snapshot(progress: (value: ExportProgress) => void, signal?: AbortSignal): Promise<ViewExportSnapshot>;
  dispose(): void;
} {
  const element = document.createElement('iframe');
  if (options.version) element.dataset.eficyVersion = options.version;
  let frameId = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  let ready = false;
  let rendered = false;
  let disposed = false;
  let source: string | undefined;
  let revision = 0;
  let disposalTimer: ReturnType<typeof setTimeout> | undefined;
  let restartPaint: number | undefined;
  let pending: { id: string; progress: (value: ExportProgress) => void; resolve: (snapshot: ViewExportSnapshot) => void; reject: (error: Error) => void } | undefined;
  const cancelSnapshot = (error: Error = new DOMException('Export cancelled.', 'AbortError')) => {
    if (!pending) return;
    element.contentWindow?.postMessage({ protocol: 'eficy-preview', frameId, type: 'snapshot-cancel', requestId: pending.id }, '*');
    pending.reject(error);
  };
  const setRendered = (value: boolean) => { rendered = value; options.onReadyChange?.(value); };
  const send = (type: string) => element.contentWindow?.postMessage({ protocol: 'eficy-preview', frameId, type, revision, source }, '*');
  const remove = () => {
    clearTimeout(disposalTimer);
    if (restartPaint !== undefined) cancelAnimationFrame(restartPaint);
    window.removeEventListener('message', receive);
    element.remove();
    element.srcdoc = '';
  };
  const receive = (event: MessageEvent) => {
    if (!element.contentWindow || event.source !== element.contentWindow) return;
    const message = event.data;
    if (!message || message.protocol !== 'eficy-preview' || message.frameId !== frameId) return;
    if (disposed) {
      if (message.type === 'disposed') remove();
      return;
    }
    if (message.type === 'retry') {
      cancelSnapshot();
      setRendered(false);
      ready = false;
      frameId = crypto.randomUUID();
      options.onStatus?.({ status: 'loading', title: loadingText.initial, restart: true });
      restartPaint = requestAnimationFrame(() => {
        if (disposed) return;
        restartPaint = requestAnimationFrame(() => {
          if (!disposed) element.srcdoc = documentSource();
        });
      });
      return;
    }
    if (message.type === 'status') {
      // Bootstrap may fail before a source revision can be delivered.
      if (message.revision !== revision && !(message.revision === 0 && !ready && message.status === 'error')) return;
      if (message.status === 'loading' && typeof message.title === 'string') {
        setRendered(false);
        options.onStatus?.({ status: 'loading', title: message.title });
      }
      if (message.status === 'committed' && ready && source !== undefined) {
        setRendered(true);
        options.onStatus?.({ status: 'committed' });
      }
      if (message.status === 'error' && typeof message.error === 'string') {
        setRendered(false);
        options.onStatus?.({ status: 'error', error: message.error, hasContent: message.hasContent === true });
      }
      return;
    }
    if (pending && message.requestId === pending.id) {
      if (message.type === 'snapshot-progress' && ['preparing', 'capturing'].includes(message.stage)) {
        pending.progress({ stage: message.stage });
      }
      if (message.type === 'snapshot-result') {
        const snapshot = message.snapshot;
        if (snapshot && typeof snapshot.html === 'string' && snapshot.html.length > 0
          && Number.isFinite(snapshot.width) && snapshot.width > 0 && Number.isFinite(snapshot.height) && snapshot.height > 0) {
          pending.resolve({ html: snapshot.html, width: snapshot.width, height: snapshot.height });
        } else pending.reject(new Error('Invalid report snapshot.'));
      }
      if (message.type === 'snapshot-error' && typeof message.error === 'string') pending.reject(new Error(message.error));
      return;
    }
    if (message.type === 'open-link' && ready && isLocalFileLink(message.href) && typeof message.background === 'boolean') {
      void Promise.resolve().then(() => {
        if (disposed) return;
        return options.openLink?.(message.href, message.background);
      }).then((opened) => {
        if (!disposed && !opened) throw new Error('This host could not open the file link.');
      }).catch((error: unknown) => {
        if (!disposed) element.contentWindow?.postMessage({ protocol: 'eficy-preview', frameId, type: 'link-error', error: error instanceof Error ? error.message : String(error) }, '*');
      });
      return;
    }
    if (message.type !== 'ready' || ready) return;
    ready = true;
    if (source !== undefined) send('update');
  };
  window.addEventListener('message', receive);
  element.setAttribute('sandbox', 'allow-scripts allow-forms');
  element.setAttribute('title', 'Eficy preview');
  element.style.cssText = 'width:100%;height:100%;border:0;display:block';
  const loadingText = options.loadingText ?? {
    initial: '正在准备预览', compiling: '正在准备页面', dependencies: '正在加载组件与样式', rendering: '正在呈现预览',
    detail: '首次加载可能需要一些时间，准备完成后会自动显示。',
  };
  const payload = () => JSON.stringify({ frameId, nonce, theme: options.theme ?? 'dark', loadingText, eficy: runtime.eficy, shadcn: runtime.shadcn, shadcnCSS: runtime.shadcnCSS, snapshot: runtime.snapshot }).replace(/</g, '\\u003c');
  const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (text: string) => text.replace(/<\/script/gi, '<\\/script');
  const documentSource = () => `<!doctype html><html style="color-scheme:${options.theme === 'light' ? 'light' : 'dark'}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob: https:; style-src 'unsafe-inline' blob: https:; img-src data: blob: https:; font-src data: blob: https:; connect-src blob: https:; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'"><style>
html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}
body{background:Canvas;color:CanvasText}
#eficy-error{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--status-error,CanvasText);background:var(--surface-background,Canvas);border-bottom:1px solid currentColor;padding:12px;margin:0;font:13px/1.5 monospace}
${loadingStyles('#eficy-loading')}
#eficy-error[hidden],#eficy-loading[hidden],#eficy-root[hidden]{display:none!important}
</style></head><body><section id="eficy-loading" role="status" aria-live="polite" aria-atomic="true">${loadingSVG}<p id="eficy-loading-title" class="eficy-loading-title">${text(loadingText.initial)}</p><p id="eficy-loading-detail" class="eficy-loading-detail">${text(loadingText.detail)}</p></section><pre id="eficy-error" role="alert" hidden></pre><div id="eficy-root" aria-busy="true" hidden></div><script id="eficy-payload" type="application/json">${payload()}</script><script nonce="${nonce}">${inline(runtime.react)}</script><script nonce="${nonce}">${inline(runtime.bootstrap)}</script></body></html>`;
  element.srcdoc = documentSource();
  return {
    element,
    update(nextSource) {
      if (disposed || nextSource === source) return;
      cancelSnapshot();
      setRendered(false);
      source = nextSource;
      revision++;
      if (ready) send('update');
    },
    snapshot(progress, signal) {
      if (disposed || !rendered) return Promise.reject(new Error('Wait for the preview to finish rendering before exporting.'));
      if (pending) return Promise.reject(new Error('An export is already running.'));
      if (signal?.aborted) return Promise.reject(signal.reason);
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const abort = () => cancelSnapshot();
        const timer = setTimeout(() => cancelSnapshot(new Error('Export timed out. Check external images and fonts, then retry.')), 120000);
        const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending = undefined; };
        pending = {
          id, progress,
          resolve: snapshot => { cleanup(); resolve(snapshot); },
          reject: error => { cleanup(); reject(error); },
        };
        signal?.addEventListener('abort', abort, { once: true });
        element.contentWindow?.postMessage({ protocol: 'eficy-preview', frameId, type: 'snapshot', requestId: id, revision }, '*');
      });
    },
    dispose() {
      if (disposed) return;
      cancelSnapshot();
      setRendered(false);
      disposed = true;
      if (!ready) return remove();
      send('dispose');
      // Give the isolated runtime a turn to unmount and revoke its URLs.
      disposalTimer = setTimeout(remove, 1000);
    },
  };
}
