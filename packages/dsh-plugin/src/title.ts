import { createElement, Fragment } from 'react';
import { FileTypeIcon, classifyFileType } from '@deepseek-ai/dsh-client-ui-primitives';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client';
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import fileIcon from '../../../src/file-icon.svg?raw';

const fileIconURL = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fileIcon)}`;

export function DocumentTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>) {
  const { tab } = useTabInfo();
  const path = parseFileAddress(tab.contentId)?.path ?? tab.title;
  const icon = /\.eficy$/i.test(path)
    ? createElement('img', { src: fileIconURL, width: 16, height: 16, alt: '', 'aria-hidden': true, className: 'dsh-eficy-tab-icon' })
    : createElement(FileTypeIcon, { kind: classifyFileType(tab.title), size: 16, className: 'dsh-eficy-tab-icon' });
  return createElement(Fragment, null, icon, tab.title);
}
