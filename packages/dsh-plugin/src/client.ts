import { createElement, useEffect, useRef } from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { DocumentPreviewProps } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import { parseFileAddress } from '@deepseek-ai/dsh-util-workspace-path';
import { mountPreview } from './preview';
import { previewLinkAddress } from './links';
import { DocumentTitle } from './title';
import { exportMessages } from '../../../src/export-toolbar';
import styles from '../../../src/export-toolbar.css?inline';

const id = '@eficy/dsh-plugin';
const messages = {
  en: { ...exportMessages.en, exportSaved: 'Download started', disabled: 'Enable Coding Tools in Settings to run Eficy interactive previews.', invalid: 'Eficy expects a UTF-8 TSX file up to 128 KiB.', preview: 'Eficy preview' },
  zh: { ...exportMessages.zh, exportSaved: '已开始下载', disabled: '请在设置中启用 Coding Tools，再运行 Eficy 交互预览。', invalid: 'Eficy 需要不超过 128 KiB 的 UTF-8 TSX 文件。', preview: 'Eficy 预览' },
};
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { eficy: keyof typeof messages.en }
}
interface PreviewInjected { hooks: { interactivePreview: ObservableSnapshot<boolean> } }
type Props = DocumentPreviewProps & PropsLocale<'eficy'> & InjectFace<PreviewInjected>;

export const inject = ['slots', 'locale', 'documentPreviews', 'configForms'];

export function apply(ctx: Context) {
  const style = document.createElement('style');
  style.textContent = styles + '.dsh-eficy-tab-icon{flex:none}.dsh-eficy-preview{position:relative;min-height:320px;height:100%;width:100%;flex:1;display:flex;flex-direction:column}.dsh-eficy-preview>iframe{flex:1;min-height:320px}.dsh-eficy-preview .eficy-export-toolbar{position:absolute;right:12px;top:12px;z-index:2}';
  ctx.effect(() => { document.head.append(style); return () => style.remove(); });
  ctx.effect(() => ctx.locale.register('eficy', messages));
  ctx.effect(() => ctx.documentPreviews.register({ id, extensions: ['eficy'], title: () => 'Eficy', loading: 'bytes-complete' }));
  ctx.effect(() => ctx.slots.inject('sidebar.right.tab.document', () => ctx.slots.register({
    name: 'sidebar.right.tab.document', key: id, locale: 'eficy',
    inject: (): PreviewInjected => ({ hooks: { interactivePreview: ctx.configForms.developerTools.enabled } }),
  }, EficyPreview)));
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: '@deepseek-ai/dsh-client-ui-sidebar-documentpreview', priority: -1,
  }, DocumentTitle)));
}

function EficyPreview(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const enabled = props.useInteractivePreview(value => value);
  const { tab } = props.useTabInfo();
  const data = props.content.kind === 'bytes' ? props.content.data : undefined;
  const t = props.t;
  useEffect(() => {
    const container = root.current;
    if (!container) return;
    if (!enabled) {
      container.textContent = t('disabled');
      return () => { container.textContent = ''; };
    }
    if (!data) return;
    try {
      if (data.byteLength > 128 * 1024) throw new Error(t('invalid'));
      const source = new TextDecoder('utf-8', { fatal: true }).decode(data);
      const file = parseFileAddress(props.resourceAddress);
      if (file?.scope !== 'session') throw new Error('Expected a session file address.');
      const view = mountPreview(container, {
        source, filename: file.path.split(/[\\/]/).at(-1) || 'report.eficy',
        t: (key, params) => t(key as keyof typeof messages.en, params),
        openLink(href) {
          const address = previewLinkAddress(props.resourceAddress, href);
          if (!address) return false;
          tab.actions.openResource(address);
          return true;
        },
      });
      return () => view.dispose();
    } catch (error) {
      container.textContent = error instanceof Error ? error.message : t('invalid');
      container.setAttribute('role', 'alert');
      return () => { container.textContent = ''; container.removeAttribute('role'); };
    }
  }, [enabled, data, props.resourceAddress, tab.actions, t]);
  return createElement('div', { ref: root, className: 'dsh-eficy-preview', 'aria-label': t('preview') });
}
