import type { ExportFormat, ExportProgress, ViewExportResult } from './export-types';

export const exportMessages = {
  en: {
    exportSaved: 'File saved', exportError: 'Failed', exportFailureTitle: 'Export failed',
    export: 'Export', exportPDF: 'Export PDF', exportPNG: 'Export PNG image', exportCancel: 'Cancel',
    exportPreparing: 'Preparing images and fonts…', exportCapturing: 'Capturing the report…',
    exportRendering: 'Rendering report…', exportEncoding: 'Generating file…', exportSaving: 'Saving file…', exportCancelled: 'Export cancelled',
    exportFailed: 'Export failed: {{error}}', exportWait: 'Available once the preview is ready',
  },
  zh: {
    exportSaved: '文件已保存', exportError: '失败', exportFailureTitle: '导出失败',
    export: '导出', exportPDF: '导出 PDF', exportPNG: '导出 PNG 长图', exportCancel: '取消',
    exportPreparing: '正在准备图片与字体…', exportCapturing: '正在截取报告…',
    exportRendering: '正在渲染报告…', exportEncoding: '正在生成文件…', exportSaving: '正在保存文件…', exportCancelled: '已取消导出',
    exportFailed: '导出失败：{{error}}', exportWait: '预览准备完成后可导出',
  },
};

export function createExportToolbar(options: {
  t: (key: string, params?: Record<string, string | number>) => string;
  run: (format: ExportFormat, progress: (value: ExportProgress) => void, signal: AbortSignal) => Promise<ViewExportResult>;
  onError?: (message: string) => void;
}) {
  const element = document.createElement('div');
  element.className = 'eficy-export-toolbar';
  const feedback = document.createElement('div');
  feedback.className = 'eficy-export-feedback';
  const meter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  meter.setAttribute('viewBox', '0 0 24 24');
  meter.setAttribute('role', 'progressbar');
  meter.setAttribute('aria-valuemin', '0');
  meter.setAttribute('aria-valuemax', '100');
  meter.classList.add('eficy-export-progress');
  meter.innerHTML = '<circle cx="12" cy="12" r="9" opacity=".25"/><circle cx="12" cy="12" r="9" pathLength="100" transform="rotate(-90 12 12)"/>';
  const arc = meter.lastElementChild!;
  const status = document.createElement('span');
  status.className = 'eficy-export-sr-only';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.hidden = true;
  cancel.className = 'eficy-export-cancel';
  const cross = document.createElement('span');
  cross.setAttribute('aria-hidden', 'true');
  cross.innerHTML = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 7 10 10M17 7 7 17"/></svg>';
  cancel.append(meter, cross);
  const menu = document.createElement('details');
  menu.className = 'eficy-export-menu';
  const trigger = document.createElement('summary');
  trigger.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>';
  const downloadIcon = trigger.innerHTML;
  const choices = document.createElement('div');
  choices.className = 'eficy-export-choices';
  menu.append(trigger, choices);
  feedback.append(status, cancel);
  element.append(feedback, menu);
  let ready = false;
  let disposed = false;
  let job: AbortController | undefined;
  let jobFormat: ExportFormat | undefined;
  let reset: ReturnType<typeof setTimeout> | undefined;
  let blurCheck: ReturnType<typeof setTimeout> | undefined;
  let failure = '';
  const available = new Set<ExportFormat>();
  const buttons = new Map<ExportFormat, HTMLButtonElement>();
  const sync = () => {
    element.hidden = !available.size;
    menu.hidden = !!job;
    trigger.setAttribute('aria-disabled', String(!ready || !!job));
    trigger.title = failure || options.t(ready ? 'export' : 'exportWait');
    trigger.setAttribute('aria-label', failure ? `${options.t('export')}: ${failure}` : options.t('export'));
    cancel.title = options.t('exportCancel');
    cancel.setAttribute('aria-label', options.t('exportCancel'));
    for (const [format, button] of buttons) {
      button.textContent = options.t(format === 'pdf' ? 'exportPDF' : 'exportPNG');
      button.disabled = !ready || !!job;
    }
  };
  const showProgress = (value: ExportProgress) => {
    status.textContent = options.t({ preparing: 'exportPreparing', capturing: 'exportCapturing', rendering: 'exportRendering', encoding: 'exportEncoding', saving: 'exportSaving' }[value.stage]);
    if (Number.isFinite(value.total) && value.total! > 0 && Number.isFinite(value.completed) && value.completed! >= 0) {
      const percent = Math.floor(Math.min(value.completed!, value.total!) / value.total! * 100);
      meter.setAttribute('aria-valuenow', String(percent));
      arc.setAttribute('stroke-dasharray', `${percent} 100`);
      meter.classList.remove('is-indeterminate');
      status.textContent += ` ${percent}%`;
    } else {
      meter.removeAttribute('aria-valuenow');
      arc.setAttribute('stroke-dasharray', '24 100');
      meter.classList.add('is-indeterminate');
    }
    meter.setAttribute('aria-label', status.textContent);
  };
  const run = async (format: ExportFormat) => {
    if (!ready || job || disposed || !available.has(format)) return;
    const controller = new AbortController();
    job = controller;
    jobFormat = format;
    clearTimeout(reset);
    trigger.innerHTML = downloadIcon;
    delete trigger.dataset.state;
    failure = '';
    menu.open = false;
    cancel.hidden = false;
    status.setAttribute('role', 'status');
    showProgress({ stage: 'preparing' });
    sync();
    cancel.focus();
    try {
      const result = await options.run(format, value => { if (!disposed && job === controller && !controller.signal.aborted) showProgress(value); }, controller.signal);
      if (disposed) return;
      // A native save may commit before abort arrives; its returned terminal status is authoritative.
      status.textContent = options.t(result.status === 'saved' ? 'exportSaved' : 'exportCancelled');
      if (result.status === 'saved') {
        trigger.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
        trigger.dataset.state = 'saved';
        reset = setTimeout(() => { trigger.innerHTML = downloadIcon; delete trigger.dataset.state; status.textContent = ''; }, 1800);
      }
    } catch (error) {
      if (disposed) return;
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
        || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EXPORT_ABORTED');
      status.textContent = options.t(cancelled ? 'exportCancelled' : 'exportError');
      if (!cancelled) {
        failure = options.t('exportFailed', { error: error instanceof Error ? error.message : String(error) });
        trigger.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v1"/></svg>';
        trigger.dataset.state = 'error';
        // Notification availability must not prevent retrying the export.
        try { options.onError?.(failure); } catch { /* Retain the accessible icon fallback. */ }
      }
    } finally {
      job = undefined;
      jobFormat = undefined;
      const restoreFocus = document.activeElement === cancel;
      cancel.hidden = true;
      if (!disposed) { sync(); if (restoreFocus && available.size) trigger.focus(); }
    }
  };
  for (const format of ['pdf', 'png'] as const) {
    const button = document.createElement('button');
    button.type = 'button';
    button.onclick = () => void run(format);
    buttons.set(format, button);
  }
  cancel.onclick = () => job?.abort();
  trigger.onclick = event => { if (!ready || job) event.preventDefault(); };
  element.onkeydown = event => { if (event.key === 'Escape' && menu.open) { event.preventDefault(); menu.open = false; trigger.focus(); } };
  const outside = (event: Event) => { if (!element.contains(event.target as Node)) menu.open = false; };
  // iframe pointer events do not bubble; inspect only the parent document's focused element.
  const blur = () => {
    clearTimeout(blurCheck);
    blurCheck = setTimeout(() => { if (document.activeElement?.tagName === 'IFRAME') menu.open = false; }, 0);
  };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('focusin', outside);
  window.addEventListener('blur', blur);
  sync();
  return {
    element,
    refresh: sync,
    setAvailable(format: ExportFormat, value: boolean) {
      if (value) available.add(format);
      else { available.delete(format); if (jobFormat === format) job?.abort(); }
      choices.replaceChildren(...[...buttons].filter(([key]) => available.has(key)).map(([, button]) => button));
      if (!available.size) menu.open = false;
      sync();
      return available.size > 0;
    },
    cancel(format: ExportFormat) { if (jobFormat === format) job?.abort(); },
    setReady(value: boolean) { ready = value; if (!value) { menu.open = false; job?.abort(); } sync(); },
    dispose() {
      disposed = true;
      job?.abort();
      clearTimeout(reset);
      clearTimeout(blurCheck);
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('blur', blur);
      element.remove();
    },
  };
}
