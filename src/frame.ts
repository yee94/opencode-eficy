import runtime from './generated/runtime';
import { isLocalFileLink } from './file-links';

/** Each preview owns its opaque-origin document and React runtime. */
export function createPreviewFrame(options: { version?: string; theme?: 'light' | 'dark'; openLink?: (href: string, background: boolean) => boolean | Promise<boolean> } = {}): {
  element: HTMLIFrameElement;
  update(source: string): void;
  dispose(): void;
} {
  const element = document.createElement('iframe');
  if (options.version) element.dataset.eficyVersion = options.version;
  const frameId = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  let ready = false;
  let disposed = false;
  let source: string | undefined;
  let revision = 0;
  let disposalTimer: ReturnType<typeof setTimeout> | undefined;
  const send = (type: string) => element.contentWindow?.postMessage({ protocol: 'eficy-preview', frameId, type, revision, source }, '*');
  const remove = () => {
    clearTimeout(disposalTimer);
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
  const payload = JSON.stringify({ frameId, nonce, theme: options.theme ?? 'light', eficy: runtime.eficy, shadcn: runtime.shadcn, shadcnCSS: runtime.shadcnCSS }).replace(/</g, '\\u003c');
  const inline = (text: string) => text.replace(/<\/script/gi, '<\\/script');
  element.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline' blob:; img-src data: blob:; font-src data: blob:; connect-src blob:; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'"><style>html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}#eficy-error{white-space:pre-wrap;color:var(--status-error,CanvasText);background:var(--surface-background,Canvas);border-bottom:1px solid currentColor;padding:12px;margin:0;font:13px/1.5 monospace}#eficy-error[hidden]{display:none}</style></head><body><pre id="eficy-error" role="alert" hidden></pre><div id="eficy-root"></div><script id="eficy-payload" type="application/json">${payload}</script><script nonce="${nonce}">${inline(runtime.react)}</script><script nonce="${nonce}">${inline(runtime.bootstrap)}</script></body></html>`;
  return {
    element,
    update(nextSource) {
      if (disposed || nextSource === source) return;
      source = nextSource;
      revision++;
      if (ready) send('update');
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (!ready) return remove();
      send('dispose');
      // Give the isolated runtime a turn to unmount and revoke its URLs.
      disposalTimer = setTimeout(remove, 1000);
    },
  };
}
