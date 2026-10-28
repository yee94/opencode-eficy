import type { ExportFormat, ExportProgress, ViewExportResult } from './export-types';

export const exportMessages = {
  en: {
    exportSaved: 'File saved',
    export: 'Export', exportPDF: 'Export PDF', exportPNG: 'Export PNG image', exportCancel: 'Cancel',
    exportPreparing: 'Preparing images and fonts…', exportCapturing: 'Capturing the report…',
    exportRendering: 'Rendering report…', exportEncoding: 'Generating file…', exportSaving: 'Saving file…', exportCancelled: 'Export cancelled',
    exportFailed: 'Export failed: {{error}}', exportWait: 'Available once the preview is ready',
  },
  zh: {
    exportSaved: '文件已保存',
    export: '导出', exportPDF: '导出 PDF', exportPNG: '导出 PNG 长图', exportCancel: '取消',
    exportPreparing: '正在准备图片与字体…', exportCapturing: '正在截取报告…',
    exportRendering: '正在渲染报告…', exportEncoding: '正在生成文件…', exportSaving: '正在保存文件…', exportCancelled: '已取消导出',
    exportFailed: '导出失败：{{error}}', exportWait: '预览准备完成后可导出',
  },
};

export function createExportToolbar(options: {
  t: (key: string, params?: Record<string, string | number>) => string;
  run: (format: ExportFormat, progress: (value: ExportProgress) => void, signal: AbortSignal) => Promise<ViewExportResult>;
}) {
  const element = document.createElement('div');
  element.className = 'eficy-export-toolbar';
  const feedback = document.createElement('div');
  feedback.className = 'eficy-export-feedback';
  const meter = document.createElement('progress');
  meter.hidden = true;
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.hidden = true;
  const menu = document.createElement('details');
  menu.className = 'eficy-export-menu';
  const trigger = document.createElement('summary');
  trigger.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5"/></svg>';
  const label = document.createElement('span');
  trigger.append(label);
  const choices = document.createElement('div');
  choices.className = 'eficy-export-choices';
  menu.append(trigger, choices);
  feedback.append(meter, status, cancel);
  element.append(feedback, menu);
  let ready = false;
  let disposed = false;
  let job: AbortController | undefined;
  let jobFormat: ExportFormat | undefined;
  const available = new Set<ExportFormat>();
  const buttons = new Map<ExportFormat, HTMLButtonElement>();
  const sync = () => {
    element.setAttribute('aria-busy', String(!!job));
    trigger.setAttribute('aria-disabled', String(!ready || !!job));
    trigger.title = options.t(ready ? 'export' : 'exportWait');
    label.textContent = options.t('export');
    cancel.textContent = options.t('exportCancel');
    for (const [format, button] of buttons) {
      button.textContent = options.t(format === 'pdf' ? 'exportPDF' : 'exportPNG');
      button.disabled = !ready || !!job;
    }
  };
  const showProgress = (value: ExportProgress) => {
    meter.hidden = false;
    status.textContent = options.t({ preparing: 'exportPreparing', capturing: 'exportCapturing', rendering: 'exportRendering', encoding: 'exportEncoding', saving: 'exportSaving' }[value.stage]);
    if (Number.isFinite(value.total) && value.total! > 0 && Number.isFinite(value.completed) && value.completed! >= 0) {
      meter.max = value.total!;
      meter.value = Math.min(value.completed!, value.total!);
      status.textContent += ` ${Math.floor(meter.value / meter.max * 100)}%`;
    } else meter.removeAttribute('value');
    meter.setAttribute('aria-label', status.textContent);
  };
  const run = async (format: ExportFormat) => {
    if (!ready || job || disposed || !available.has(format)) return;
    const controller = new AbortController();
    job = controller;
    jobFormat = format;
    menu.open = false;
    cancel.hidden = false;
    status.setAttribute('role', 'status');
    showProgress({ stage: 'preparing' });
    sync();
    try {
      const result = await options.run(format, value => { if (!disposed && job === controller && !controller.signal.aborted) showProgress(value); }, controller.signal);
      if (disposed) return;
      // A native save may commit before abort arrives; its returned terminal status is authoritative.
      status.textContent = options.t(result.status === 'saved' ? 'exportSaved' : 'exportCancelled');
    } catch (error) {
      if (disposed) return;
      const cancelled = controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')
        || (typeof error === 'object' && error !== null && 'code' in error && error.code === 'EXPORT_ABORTED');
      status.setAttribute('role', cancelled ? 'status' : 'alert');
      status.textContent = cancelled ? options.t('exportCancelled') : options.t('exportFailed', { error: error instanceof Error ? error.message : String(error) });
    } finally {
      job = undefined;
      jobFormat = undefined;
      meter.hidden = true;
      cancel.hidden = true;
      if (!disposed) sync();
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
  element.onkeydown = event => { if (event.key === 'Escape') { menu.open = false; trigger.focus(); } };
  const outside = (event: Event) => { if (!element.contains(event.target as Node)) menu.open = false; };
  document.addEventListener('pointerdown', outside);
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
      document.removeEventListener('pointerdown', outside);
      element.remove();
    },
  };
}
