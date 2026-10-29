import type { ViewExportSnapshot } from './export-types';

export function snapshotDocument(snapshot: ViewExportSnapshot, title: string): string {
  // Snapshots use XML serialization; decode it before HTML serialization so empty
  // elements and CSS containing XML entities survive opening as text/html.
  const parsed = new DOMParser().parseFromString(snapshot.html, 'application/xhtml+xml');
  if (parsed.querySelector('parsererror')) throw new Error('The report snapshot could not be decoded.');
  const doc = document.implementation.createHTMLDocument();
  doc.title = title;
  const charset = doc.createElement('meta');
  charset.setAttribute('charset', 'utf-8');
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
  const viewport = doc.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, initial-scale=1';
  doc.head.prepend(charset, policy, viewport);
  const content = doc.importNode(parsed.documentElement, true);
  doc.body.append(content);
  doc.body.style.cssText = `margin:0;width:${snapshot.width}px;min-height:${snapshot.height}px`;
  doc.documentElement.style.backgroundColor = (content as HTMLElement).style.backgroundColor;
  doc.documentElement.style.colorScheme = (content as HTMLElement).style.colorScheme;
  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}
