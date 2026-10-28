import type * as ReactTypes from 'react';
import type { Root } from 'react-dom/client';
import { parseEficy } from './parser';
import { isLocalFileLink } from './file-links';

interface EficyRuntime {
  initEficy(options: { components: Record<string, unknown> }): Promise<unknown>;
  compileJSXWithCSS(source: string): Promise<{ compiledCode: string; css: string }>;
  EficyProvider: ReactTypes.ComponentType<{ core: unknown; children?: ReactTypes.ReactNode }>;
}

// This entry is built separately into inert text; it executes only inside srcdoc.
const payload = JSON.parse(document.getElementById('eficy-payload')!.textContent!) as {
  frameId: string; nonce: string; eficy: string; shadcn: string; shadcnCSS: string;
};
document.getElementById('eficy-payload')!.remove();
const React = (window as unknown as { React: typeof ReactTypes }).React;
const ReactDOM = (window as unknown as { ReactDOM: { createRoot(element: HTMLElement): Root; flushSync(callback: () => void): void } }).ReactDOM;
const errorElement = document.getElementById('eficy-error')!;
const urls = new Set<string>();
let root: Root | undefined;
let disposed = false;
let revision = 0;
let previousSource: string | undefined;
let Eficy: EficyRuntime;
let core: unknown;
const css = document.createElement('style');
const shadcnCSS = document.createElement('style');
shadcnCSS.textContent = payload.shadcnCSS;
document.head.append(shadcnCSS);
document.head.append(css);
const notify = (type: string) => parent.postMessage({ protocol: 'eficy-preview', frameId: payload.frameId, type }, '*');
const showError = (error: unknown) => {
  errorElement.textContent = error instanceof Error ? error.message : String(error);
  errorElement.hidden = false;
};
const onError = (event: ErrorEvent) => showError(event.error ?? event.message);
const onRejection = (event: PromiseRejectionEvent) => showError(event.reason);
const onFileLink = (event: MouseEvent) => {
  if (event.defaultPrevented || event.button !== 0) return;
  const anchor = event.composedPath().find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement && node.hasAttribute('href'));
  const href = anchor?.getAttribute('href');
  if (!isLocalFileLink(href)) return;
  event.preventDefault();
  parent.postMessage({ protocol: 'eficy-preview', frameId: payload.frameId, type: 'open-link', href, background: event.metaKey || event.ctrlKey }, '*');
};
const blob = (text: string) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  urls.add(url);
  return url;
};
const revoke = (url: string) => { URL.revokeObjectURL(url); urls.delete(url); };
class RenderBoundary extends React.Component<{ children?: ReactTypes.ReactNode; revision: number }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { if (this.props.revision === revision) showError(error); }
  render() { return this.state.failed ? null : this.props.children; }
}
async function update(source: string, current: number) {
  try {
    parseEficy('preview.eficy', source);
    const compiled = await Eficy.compileJSXWithCSS(source);
    if (disposed || current !== revision) return;
    const url = blob(compiled.compiledCode);
    try {
      const module = await import(/* @vite-ignore */ url);
      if (disposed || current !== revision) return;
      const Component = module.default;
      if (typeof Component !== 'function' && !(Component && typeof Component === 'object' && '$$typeof' in Component)) {
        throw new Error('The .eficy module must default-export a React component.');
      }
      errorElement.hidden = true;
      errorElement.textContent = '';
      css.textContent = compiled.css;
      ReactDOM.flushSync(() => root!.render(
        React.createElement(RenderBoundary, { key: current, revision: current },
          React.createElement(Eficy.EficyProvider, { core }, React.createElement(Component))),
      ));
    } finally { revoke(url); }
  } catch (error) {
    if (!disposed && current === revision) showError(error);
  }
}
function cleanup() {
  if (disposed) return;
  disposed = true;
  revision++;
  window.removeEventListener('message', receive);
  window.removeEventListener('error', onError);
  window.removeEventListener('unhandledrejection', onRejection);
  window.removeEventListener('pagehide', cleanup);
  document.removeEventListener('click', onFileLink);
  try { root?.unmount(); } finally { for (const url of urls) revoke(url); }
}
function receive(event: MessageEvent) {
  if (event.source !== parent || disposed) return;
  const data = event.data;
  if (!data || data.protocol !== 'eficy-preview' || data.frameId !== payload.frameId) return;
  if (data.type === 'dispose') { cleanup(); notify('disposed'); return; }
  if (data.type === 'link-error' && typeof data.error === 'string') { showError(data.error); return; }
  if (data.type !== 'update' || typeof data.source !== 'string' || !Number.isSafeInteger(data.revision) || data.revision <= revision) return;
  revision = data.revision;
  if (data.source === previousSource) return;
  previousSource = data.source;
  void update(data.source, revision);
}
window.addEventListener('error', onError);
window.addEventListener('unhandledrejection', onRejection);
window.addEventListener('pagehide', cleanup);
document.addEventListener('click', onFileLink);
void (async () => {
  try {
    const eficyURL = blob(payload.eficy);
    const shadcnURL = blob(payload.shadcn);
    const reactURL = blob('export default window.React; export const {useState,useEffect,useMemo,useRef,useReducer,useContext,useLayoutEffect,useCallback,createContext,createElement,Fragment,memo,forwardRef,useId,useSyncExternalStore}=window.React;');
    const map = document.createElement('script');
    map.type = 'importmap';
    map.nonce = payload.nonce;
    map.textContent = JSON.stringify({ imports: { eficy: eficyURL, 'eficy/jsx-runtime': eficyURL, shadcn: shadcnURL, react: reactURL } });
    document.head.append(map);
    Eficy = await import(/* @vite-ignore */ eficyURL);
    if (disposed) return;
    const shadcn = await import(/* @vite-ignore */ shadcnURL);
    if (disposed) return;
    core = await Eficy.initEficy({ components: shadcn });
    if (disposed) return;
    root = ReactDOM.createRoot(document.getElementById('eficy-root')!);
    window.addEventListener('message', receive);
    notify('ready');
  } catch (error) { if (!disposed) showError(error); }
})();
