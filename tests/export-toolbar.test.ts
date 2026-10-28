import { afterEach, describe, expect, it, vi } from 'vitest';
import { createExportToolbar, exportMessages } from '../src/export-toolbar';
import type { ExportProgress, ViewExportResult } from '../src/export-types';

const cleanups: (() => void)[] = [];
function setup(locale: keyof typeof exportMessages = 'en') {
  vi.useFakeTimers();
  let finish!: (result: ViewExportResult) => void;
  let fail!: (error: Error) => void;
  let progress!: (value: ExportProgress) => void;
  let signal!: AbortSignal;
  const run = vi.fn((_format, notify, abort) => {
    progress = notify; signal = abort;
    return new Promise<ViewExportResult>((resolve, reject) => { finish = resolve; fail = reject; });
  });
  const toolbar = createExportToolbar({
    t: (key, params = {}) => exportMessages[locale][key as keyof typeof exportMessages.en].replace(/\{\{(\w+)\}\}/g, (match, name: string) => String(params[name] ?? match)),
    run,
  });
  toolbar.setAvailable('pdf', true);
  toolbar.setAvailable('png', true);
  document.body.append(toolbar.element);
  cleanups.push(toolbar.dispose);
  const buttons = toolbar.element.querySelectorAll('button');
  const cancel = buttons[0];
  const pdf = buttons[1];
  const png = buttons[2];
  const meter = toolbar.element.querySelector('progress')!;
  return { toolbar, run, cancel, pdf, png, meter, progress: (value: ExportProgress) => progress(value), finish: (saved = true) => finish({ status: saved ? 'saved' : 'cancelled' }), fail: (error = new Error('CORS blocked image')) => fail(error), signal: () => signal };
}
afterEach(() => {
  cleanups.splice(0).forEach(cleanup => cleanup());
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('native export UI lifecycle', () => {
  it('uses native totals only and clears determinate progress on the next unbounded stage', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.pdf.click();
    app.progress({ stage: 'rendering', completed: 2 });
    expect(app.meter.hasAttribute('value')).toBe(false);
    app.progress({ stage: 'encoding', completed: 2, total: 4 });
    expect(app.meter.value / app.meter.max).toBe(0.5);
    expect(app.toolbar.element.textContent).toContain('50%');
    app.progress({ stage: 'saving' });
    expect(app.meter.hasAttribute('value')).toBe(false);
    expect(app.toolbar.element.textContent).toContain('Saving file');
    app.finish();
    await Promise.resolve();
    app.progress({ stage: 'rendering' });
    expect(app.toolbar.element.textContent).toContain('File saved');
  });

  it('treats EXPORT_ABORTED as cancellation and restores controls after host errors', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.pdf.click();
    app.fail(Object.assign(new Error('Owner closed'), { code: 'EXPORT_ABORTED' }));
    await Promise.resolve();
    expect(app.toolbar.element.textContent).toContain('Export cancelled');
    expect(app.toolbar.element.querySelector('[role=alert]')).toBeNull();
    app.pdf.click();
    app.fail(Object.assign(new Error('Disk full'), { code: 'EXPORT_SAVE_FAILED' }));
    await Promise.resolve();
    expect(app.toolbar.element.querySelector('[role=alert]')?.textContent).toContain('Disk full');
    expect(app.pdf.disabled).toBe(false);
  });

  it('gates export on rendered content and shows stages until native saving finishes', async () => {
    const app = setup();
    expect(app.pdf.disabled).toBe(true);
    app.toolbar.setReady(true);
    app.pdf.click();
    expect(app.run).toHaveBeenCalledTimes(1);
    expect(app.run.mock.calls[0][0]).toBe('pdf');
    expect(app.meter.hasAttribute('value')).toBe(false);
    expect(app.png.disabled).toBe(true);
    app.progress({ stage: 'encoding' });
    expect(app.toolbar.element.textContent).toContain('Generating file');
    expect(app.meter.hidden).toBe(false);
    expect(app.toolbar.element.textContent).not.toContain('File saved');
    app.finish();
    await vi.waitFor(() => expect(app.toolbar.element.textContent).toContain('File saved'));
    expect(app.meter.hidden).toBe(true);
    expect(app.png.disabled).toBe(false);
  });

  it('reports cancellation from the native save dialog', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.png.click();
    expect(app.run.mock.calls[0][0]).toBe('png');
    app.finish(false);
    await Promise.resolve();
    expect(app.toolbar.element.textContent).toContain('Export cancelled');
    expect(app.toolbar.element.textContent).not.toContain('File saved');
    expect(app.png.disabled).toBe(false);
  });

  it.each(['cancel', 'not-ready', 'revoked'] as const)('honors a committed save even after %s requests abort', async action => {
    const app = setup();
    app.toolbar.setReady(true);
    app.png.click();
    if (action === 'cancel') app.cancel.click();
    if (action === 'not-ready') app.toolbar.setReady(false);
    if (action === 'revoked') app.toolbar.setAvailable('png', false);
    expect(app.signal().aborted).toBe(true);
    app.finish();
    await Promise.resolve(); await Promise.resolve();
    expect(app.toolbar.element.textContent).toContain('File saved');
    expect(app.toolbar.element.textContent).not.toContain('Export cancelled');
  });

  it('honors saved when abort races with the already resolved native promise', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.pdf.click();
    app.finish();
    app.cancel.click();
    expect(app.signal().aborted).toBe(true);
    await Promise.resolve();
    expect(app.toolbar.element.textContent).toContain('File saved');
    expect(app.toolbar.element.textContent).not.toContain('Export cancelled');
  });

  it('reports cancellation when native confirms the abort instead of committing', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.png.click();
    app.cancel.click();
    expect(app.signal().aborted).toBe(true);
    app.finish(false);
    await Promise.resolve();
    expect(app.toolbar.element.textContent).toContain('Export cancelled');
    expect(app.toolbar.element.textContent).not.toContain('File saved');
    expect(app.png.disabled).toBe(false);
  });

  it('does not show late native success after disposal', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.png.click();
    app.toolbar.dispose();
    expect(app.signal().aborted).toBe(true);
    app.finish();
    await Promise.resolve();
    expect(app.toolbar.element.textContent).not.toContain('File saved');
    expect(app.toolbar.element.isConnected).toBe(false);
  });

  it.each(['en', 'zh'] as const)('interpolates actual native errors using official SDK templates in %s', async locale => {
    const app = setup(locale);
    app.toolbar.setReady(true);
    app.pdf.click();
    app.fail(Object.assign(new Error('Disk full / 磁盘已满'), { code: 'EXPORT_SAVE_FAILED' }));
    await Promise.resolve();
    expect(app.toolbar.element.querySelector('[role=alert]')?.textContent).toBe(locale === 'en'
      ? 'Export failed: Disk full / 磁盘已满'
      : '导出失败：Disk full / 磁盘已满');
    expect(app.toolbar.element.textContent).not.toContain('{error}');
  });

  it('shows resource failures and allows retry', async () => {
    const app = setup();
    app.toolbar.setReady(true);
    app.pdf.click();
    app.fail();
    await Promise.resolve();
    expect(app.toolbar.element.querySelector('[role=alert]')?.textContent).toContain('CORS blocked image');
    expect(app.toolbar.element.textContent).not.toContain('File saved');
    app.pdf.click();
    expect(app.run).toHaveBeenCalledTimes(2);
    app.finish();
    await Promise.resolve();
  });
});
