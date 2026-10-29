import { toSvg } from 'html-to-image';
import type { ExportProgress, ViewExportSnapshot } from './export-types';

function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function yieldToUI(signal: AbortSignal) {
  await new Promise(resolve => setTimeout(resolve, 0));
  signal.throwIfAborted();
}

function shareComputedStyles(content: HTMLElement) {
  const groups = new Map<string, Element[]>();
  for (const node of content.querySelectorAll('[style]')) {
    const style = node.getAttribute('style')!;
    // XML escaping inside HTML's raw-text style element would change these values.
    if (/[&<>]/.test(style)) continue;
    const nodes = groups.get(style);
    if (nodes) nodes.push(node);
    else groups.set(style, [node]);
  }
  let prefix = 'eficy-snapshot-';
  while ([content, ...content.querySelectorAll('[class], [id]')].some(node =>
    [...node.classList, node.id].some(value => value.startsWith(prefix)))
    || [...content.querySelectorAll('style')].some(node => node.textContent?.includes(prefix))) prefix += 'x';
  const rules: string[] = [];
  const declaration = document.createElement('span').style;
  for (const [style, nodes] of groups) {
    if (nodes.length < 2) continue;
    const name = `${prefix}${rules.length}`;
    declaration.cssText = style;
    // Captured computed values remain authoritative over embedded author CSS.
    for (const property of Array.from(declaration)) {
      declaration.setProperty(property, declaration.getPropertyValue(property), 'important');
    }
    const rule = `:is(#${name},.${name}){${declaration.cssText}}`;
    if (rule.length + nodes.length * (name.length + 10) >= style.length * nodes.length) continue;
    rules.push(rule);
    for (const node of nodes) {
      node.classList.add(name);
      node.removeAttribute('style');
    }
  }
  if (rules.length) {
    const sheet = content.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'style');
    sheet.textContent = rules.join('\n');
    content.append(sheet);
  }
}

/** Capture the live DOM and embedded resources for the native exporter. */
export async function captureSnapshot(root: HTMLElement, progress: (value: ExportProgress) => void, signal: AbortSignal): Promise<ViewExportSnapshot> {
  progress({ stage: 'preparing' });
  await yieldToUI(signal);
  await abortable(document.fonts.ready, signal);
  await abortable(Promise.all([...root.querySelectorAll('img')].map(image => image.decode())), signal);
  const width = Math.ceil(Math.max(root.scrollWidth, root.getBoundingClientRect().width));
  const height = Math.ceil(Math.max(root.scrollHeight, root.getBoundingClientRect().height));
  if (!width || !height) throw new Error('The preview has no visible content to export.');

  progress({ stage: 'capturing' });
  await yieldToUI(signal);
  const controls = [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select')].map(node => ({
    value: node.value,
    checked: node instanceof HTMLInputElement && node.checked,
    selected: node instanceof HTMLSelectElement ? [...node.options].map(option => option.selected) : [],
  }));
  const missingResource = 'data:application/x-eficy-missing;base64,';
  const svgURL = await abortable(toSvg(root, {
    width, height, preferredFontFormat: 'woff2', includeQueryParams: true,
    fetchRequestInit: { signal }, imagePlaceholder: missingResource,
    onImageErrorHandler: () => { throw new Error('An image could not be embedded. Check its URL and CORS permissions.'); },
    style: { margin: '0', overflow: 'visible', maxHeight: 'none' },
    filter: node => !['SCRIPT', 'IFRAME'].includes(node.nodeName),
  }), signal);
  const text = decodeURIComponent(svgURL.slice(svgURL.indexOf(',') + 1));
  if (text.includes(missingResource)) throw new Error('An image or font could not be embedded. Check its URL and CORS permissions.');
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
  const content = svg.querySelector('foreignObject')?.firstElementChild as HTMLElement | undefined;
  if (!content || svg.querySelector('parsererror')) throw new Error('The report snapshot could not be decoded.');
  // DOM properties do not all survive XML serialization (checkboxes and multi-selects in particular).
  content.querySelectorAll('input,textarea,select').forEach((node, index) => {
    const state = controls[index];
    if (!state) return;
    if (node.localName === 'textarea') node.textContent = state.value;
    if (node.localName === 'input') {
      node.setAttribute('value', state.value);
      node.toggleAttribute('checked', state.checked);
    }
    if (node.localName === 'select') node.querySelectorAll('option').forEach((option, i) => option.toggleAttribute('selected', state.selected[i]));
  });
  content.querySelectorAll('script,iframe,object,embed,link,meta,base').forEach(node => node.remove());
  for (const node of [content, ...content.querySelectorAll('*')]) {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || ['srcset', 'action', 'formaction', 'autofocus'].includes(attribute.name)
        || (node.localName === 'a' && ['href', 'xlink:href'].includes(attribute.name))) node.removeAttribute(attribute.name);
    }
  }
  content.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
  content.style.colorScheme = getComputedStyle(document.documentElement).colorScheme;
  shareComputedStyles(content);
  return { html: new XMLSerializer().serializeToString(content), width, height };
}
