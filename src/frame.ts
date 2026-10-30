import { isLocalFileLink } from './file-links';
import type { ExportProgress, ViewExportSnapshot } from './export-types';
import { defaultLoadingText, previewDocument } from './frame-document';
import type { defaultErrorText } from './loading';

export type PreviewStatus = { status: 'loading'; title: string; restart?: boolean } | { status: 'committed' } | { status: 'error'; error: string; hasContent: boolean };

/** Each preview owns its opaque-origin document and React runtime. */
export function createPreviewFrame(options: { version?: string; theme?: 'light' | 'dark'; loadingText?: { initial: string; compiling: string; dependencies: string; rendering: string; detail: string }; errorText?: typeof defaultErrorText; onStatus?: (status: PreviewStatus) => void; openLink?: (href: string, background: boolean) => boolean | Promise<boolean>; onReadyChange?: (ready: boolean) => void } = {}): {
  element: HTMLIFrameElement;
  update(source: string): void;
  snapshot(progress: (value: ExportProgress) => void, signal?: AbortSignal): Promise<ViewExportSnapshot>;
  exportHTML(title: string): string;
  dispose(): void;
} {
  const element = document.createElement('iframe');
  if (options.version) element.dataset.eficyVersion = options.version;
  let frameId = crypto.randomUUID();
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
  const loadingText = options.loadingText ?? defaultLoadingText;
  const documentSource = () => previewDocument({ frameId, theme: options.theme, loadingText, errorText: options.errorText });
  element.srcdoc = documentSource();
  return {
    element,
    exportHTML(title) {
      if (disposed || !rendered || source === undefined) throw new Error('Wait for the preview to finish rendering before exporting.');
      return previewDocument({ source, title, theme: options.theme, loadingText, errorText: options.errorText });
    },
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
