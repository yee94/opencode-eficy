/** Keep filesystem references separate from network, script and same-document links. */
export function isLocalFileLink(href: unknown): href is string {
  if (typeof href !== 'string' || !href || href.length > 32_768 || /[\u0000\r\n]/.test(href)) return false;
  if (/^file:/i.test(href)) {
    try { return new URL(href).protocol === 'file:'; } catch { return false; }
  }
  if (/^[a-z]:[\\/]/i.test(href)) return true;
  return !/^[a-z][a-z\d+.-]*:/i.test(href) && !/^[#?]/.test(href);
}
