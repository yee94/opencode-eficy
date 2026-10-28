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
  frameId: string; nonce: string; theme?: 'light' | 'dark'; eficy: string; shadcn: string; shadcnCSS: string;
};
document.getElementById('eficy-payload')!.remove();
document.documentElement.classList.toggle('dark', payload.theme === 'dark');
document.documentElement.style.colorScheme = payload.theme === 'dark' ? 'dark' : 'light';
const React = (window as unknown as { React: typeof ReactTypes }).React;
const ReactDOM = (window as unknown as { ReactDOM: { createRoot(element: HTMLElement): Root; flushSync(callback: () => void): void } }).ReactDOM;
const errorElement = document.getElementById('eficy-error')!;
const retry = document.createElement('button');
retry.textContent = 'Retry / 重试';
retry.hidden = true;
errorElement.after(retry);
retry.onclick = () => notify('retry');
const urls = new Set<string>();
let root: Root | undefined;
let disposed = false;
let revision = 0;
let previousSource: string | undefined;
let successfulSource: string | undefined;
let activeStyles: HTMLLinkElement[] = [];
const pendingStyles = new Set<() => void>();
const pendingSheets = new Set<HTMLLinkElement>();
let Eficy: EficyRuntime;
let core: unknown;
const css = document.createElement('style');
document.head.append(css);
const notify = (type: string) => parent.postMessage({ protocol: 'eficy-preview', frameId: payload.frameId, type }, '*');
const showError = (error: unknown) => {
  errorElement.textContent = error instanceof Error ? error.message : String(error);
  errorElement.hidden = false;
  retry.hidden = false;
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
  const links: HTMLLinkElement[] = [];
  const cancellations = new Set<() => void>();
  let committed = false;
  try {
    const parsed = parseEficy('preview.eficy', source);
    let compileSource = source;
    for (const style of [...parsed.styles].reverse()) compileSource = compileSource.slice(0, style.start) + compileSource.slice(style.end);
    const compiled = await Eficy.compileJSXWithCSS(compileSource);
    if (disposed || current !== revision) return;
    const styles = [...new Set([...parsed.styles.map(style => style.url), ...(parsed.imports.includes('shadcn') ? [payload.shadcnCSS] : [])])];
    await Promise.all(styles.map(href => new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      links.push(link);
      pendingSheets.add(link);
      link.rel = 'stylesheet';
      link.media = 'not all';
      link.href = href;
      const finish = (error?: Error) => {
        clearTimeout(timer);
        pendingStyles.delete(cancel);
        cancellations.delete(cancel);
        link.onload = link.onerror = null;
        error ? reject(error) : resolve();
      };
      const cancel = () => { link.remove(); finish(new Error('Stylesheet load cancelled.')); };
      const timer = setTimeout(() => finish(new Error(`Stylesheet timed out: ${href}`)), 30000);
      pendingStyles.add(cancel);
      cancellations.add(cancel);
      link.onload = () => finish();
      link.onerror = () => finish(new Error(`Unable to load stylesheet: ${href}`));
      document.head.append(link);
    })));
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
      retry.hidden = true;
      activeStyles.forEach(link => link.remove());
      activeStyles = links;
      links.forEach(link => { pendingSheets.delete(link); link.media = 'all'; });
      committed = true;
      successfulSource = source;
      css.textContent = compiled.css;
      document.head.append(css);
      ReactDOM.flushSync(() => root!.render(
        React.createElement(RenderBoundary, { key: current, revision: current },
          React.createElement(Eficy.EficyProvider, { core }, React.createElement(Component))),
      ));
    } finally { revoke(url); }
  } catch (error) {
    if (!disposed && current === revision) showError(error);
  } finally {
    for (const cancel of cancellations) cancel();
    if (!committed) links.forEach(link => { pendingSheets.delete(link); link.remove(); });
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
  for (const cancel of pendingStyles) cancel();
  for (const link of pendingSheets) link.remove();
  pendingSheets.clear();
  activeStyles.forEach(link => link.remove());
  css.remove();
  retry.onclick = null;
  try { root?.unmount(); } finally { for (const url of urls) revoke(url); }
}
function receive(event: MessageEvent) {
  if (event.source !== parent || disposed) return;
  const data = event.data;
  if (!data || data.protocol !== 'eficy-preview' || data.frameId !== payload.frameId) return;
  if (data.type === 'dispose') { cleanup(); notify('disposed'); return; }
  if (data.type === 'link-error' && typeof data.error === 'string') { showError(data.error); return; }
  if (data.type !== 'update' || typeof data.source !== 'string' || !Number.isSafeInteger(data.revision) || data.revision <= revision) return;
  if (data.source === previousSource && data.source === successfulSource && errorElement.hidden) return;
  revision = data.revision;
  for (const cancel of pendingStyles) cancel();
  for (const link of pendingSheets) link.remove();
  pendingSheets.clear();
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
    const shared = (name: 'React' | 'ReactDOM', value: object) => blob(`export default window.${name}; export const {${Object.keys(value).filter(key => /^[a-zA-Z_$][\w$]*$/.test(key) && key !== 'default').join(',')}}=window.${name};`);
    const reactURL = shared('React', React);
    const domURL = shared('ReactDOM', ReactDOM);
    const jsxURL = blob('export const Fragment = window.React.Fragment; export const jsx = (type, props, key) => window.React.createElement(type, key === undefined ? props : {...props, key}); export const jsxs = jsx; export const jsxDEV = jsx;');
    const map = document.createElement('script');
    map.type = 'importmap';
    map.nonce = payload.nonce;
    map.textContent = JSON.stringify({ imports: { eficy: eficyURL, 'eficy/jsx-runtime': eficyURL, shadcn: shadcnURL, react: reactURL, 'react-dom': domURL, 'react-dom/client': domURL, 'react/jsx-runtime': jsxURL, 'react/jsx-dev-runtime': jsxURL } });
    document.head.append(map);
    Eficy = await import(/* @vite-ignore */ eficyURL);
    if (disposed) return;
    core = await Eficy.initEficy({ components: {} });
    if (disposed) return;
    root = ReactDOM.createRoot(document.getElementById('eficy-root')!);
    window.addEventListener('message', receive);
    notify('ready');
  } catch (error) { if (!disposed) showError(error); }
})();
