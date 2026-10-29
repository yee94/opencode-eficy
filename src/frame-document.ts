import runtime from './generated/runtime';
import { loadingStyles, loadingSVG } from './loading';

export const defaultLoadingText = {
  initial: '正在准备预览', compiling: '正在准备页面', dependencies: '正在加载组件与样式', rendering: '正在呈现预览',
  detail: '首次加载可能需要一些时间，准备完成后会自动显示。',
};

export function previewDocument(options: {
  theme?: 'light' | 'dark';
  loadingText?: typeof defaultLoadingText;
  title?: string;
} & ({ frameId: string; source?: never } | { source: string; frameId?: never })): string {
  const theme = options.theme ?? 'dark';
  const loadingText = options.loadingText ?? defaultLoadingText;
  const nonce = crypto.randomUUID();
  const payload = JSON.stringify({
    frameId: options.frameId, source: options.source, nonce, theme, loadingText,
    eficy: runtime.eficy, shadcn: runtime.shadcn, shadcnCSS: runtime.shadcnCSS,
    snapshot: options.source === undefined ? runtime.snapshot : undefined,
  }).replace(/</g, '\\u003c');
  const text = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (value: string) => value.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html><html style="color-scheme:${theme}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${text(options.title ?? 'Eficy preview')}</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' blob: https:; style-src 'unsafe-inline' blob: https:; img-src data: blob: https:; font-src data: blob: https:; connect-src blob: https:; base-uri 'none'; form-action 'none'; frame-src 'none'; worker-src 'none'"><style>
html,body{margin:0;min-height:100%;font-family:system-ui,sans-serif}
body{background:Canvas;color:CanvasText}
#eficy-error{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--status-error,CanvasText);background:var(--surface-background,Canvas);border-bottom:1px solid currentColor;padding:12px;margin:0;font:13px/1.5 monospace}
${loadingStyles('#eficy-loading')}
#eficy-error[hidden],#eficy-loading[hidden],#eficy-root[hidden]{display:none!important}
</style></head><body><section id="eficy-loading" role="status" aria-live="polite" aria-atomic="true">${loadingSVG}<p id="eficy-loading-title" class="eficy-loading-title">${text(loadingText.initial)}</p><p id="eficy-loading-detail" class="eficy-loading-detail">${text(loadingText.detail)}</p></section><pre id="eficy-error" role="alert" hidden></pre><div id="eficy-root" aria-busy="true" hidden></div><script id="eficy-payload" type="application/json">${payload}</script><script nonce="${nonce}">${inline(runtime.react)}</script><script nonce="${nonce}">${inline(runtime.bootstrap)}</script></body></html>`;
}
