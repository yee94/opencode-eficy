import { fileAddressFor, isAbsoluteWorkspacePath, parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { isLocalFileLink } from '../../../src/file-links';

export function previewLinkAddress(resourceAddress: string, href: string): string | undefined {
  const file = parseFileAddress(resourceAddress);
  if (file?.scope !== 'session' || !isLocalFileLink(href)) return;
  const target = href.split(/[?#]/, 1)[0];
  let path: string;
  if (/^file:/i.test(target)) {
    const url = new URL(target);
    path = decodeURIComponent(url.pathname);
    if (url.hostname) path = `//${url.hostname}${path}`;
    else if (/^\/[a-z]:\//i.test(path)) path = path.slice(1);
  } else path = decodeURIComponent(target);
  if (!isAbsoluteWorkspacePath(path)) path = file.path.replace(/[^\\/]*$/, '') + path;
  return fileAddressFor(file.sessionId, undefined, path);
}
