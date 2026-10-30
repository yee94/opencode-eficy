import { afterEach, expect, it, vi } from 'vitest';
import { createRoot, createSignal } from 'solid-js';
import { Panel, type PanelProps, type Live, type Toasts } from '@opencode/plugin/gui';
import { ExportPDF, ExportLongImage } from '../src/export-contract';
import { PreviewActions, type PreviewActionsAPI } from '../src/preview-actions';
import type { ExportPDFAPI, ExportLongImageAPI, ViewExportOptions, ViewExportResult } from '../src/export-types';
import plugin from '../packages/opencode2-plugin/src/gui';

const { context } = vi.hoisted(() => ({ context: { id: 'eficy', use: vi.fn(), system: { save: vi.fn(async (_file: { name: string; content: string }) => true) }, toast: undefined as Toasts | undefined, t: (key: string) => key, links: { open: vi.fn() } } }));
vi.mock('@opencode/plugin/gui', async (original) => ({
  ...await original<typeof import('@opencode/plugin/gui')>(),
  bindPlugin: (component: unknown) => component,
  usePlugin: () => context,
}));
// Exercise browser Solid effects, not its inert server implementation.
vi.mock('solid-js', () => vi.importActual<typeof import('solid-js')>('solid-js/dist/solid.js'));

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.replaceChildren(); context.toast = undefined; context.system.save.mockReset(); vi.restoreAllMocks(); });

const limits = { maxHTMLBytes: 16 * 1024 * 1024, maxWidth: 8192, maxHeight: 32768, maxPixels: 16777216 };
const snapshot = { html: '<div xmlns="http://www.w3.org/1999/xhtml">report</div>', width: 600, height: 1200 };

function mount(sync = vi.fn(() => new Promise<void>(() => {})), actions?: PreviewActionsAPI) {
  const [capability, setCapability] = createSignal<Live<ExportPDFAPI>>({ status: 'inactive', reason: 'disabled' });
  const [imageCapability, setImageCapability] = createSignal<Live<ExportLongImageAPI>>({ status: 'inactive', reason: 'disabled' });
  context.use.mockImplementation(token => {
    if (token.id === ExportPDF.id) return capability;
    if (token.id === ExportLongImage.id) return imageCapability;
    if (token.id === PreviewActions.id) return () => actions ? { status: 'active', generation: 1, value: actions } : { status: 'pending' };
    throw new Error(`Unexpected contract: ${token.id}`);
  });
  const paints: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => paints.push(callback));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  let panel!: Panel;
  plugin.setup!({ id: 'eficy', add: (registry: { id: string }, value: unknown) => { if (registry.id === Panel.id) panel = value as Panel; } } as never);
  const [state, setState] = createSignal<Record<string, unknown>>({ loaded: false });
  const props = { tab: { file: 'page.eficy' }, session: { id: 'session' }, screen: { file: { root: '/workspace', get: state, sync, unwatch: vi.fn() } } };
  let root!: HTMLElement;
  let dispose!: () => void;
  createRoot(cleanup => { dispose = cleanup; cleanups.push(cleanup); root = panel.render(props as unknown as PanelProps) as HTMLElement; document.body.append(root); });
  const paint = () => paints.splice(0).forEach(callback => callback(0));
  const receive = (type: string, data: Record<string, unknown> = {}) => {
    const frame = root.querySelector('iframe')!;
    const frameId = /"frameId":"([^"]+)"/.exec(frame.srcdoc)![1];
    window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, data: { protocol: 'eficy-preview', frameId, type, ...data } }));
  };
  return { root, setState, sync, paint, receive, dispose, setCapability, setImageCapability };
}

it('offers HTML without native capabilities and enables it only once the preview is ready', () => {
  const { root, paint, setState, receive, setCapability } = mount();
  paint(); paint();
  const frame = root.querySelector('iframe')!;
  const html = root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!;
  expect(html.textContent).toBe('exportHTML');
  expect(html.disabled).toBe(true);
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  setState({ loaded: true, content: { content: 'source' } });
  receive('ready');
  receive('status', { revision: 1, status: 'committed' });
  for (const state of [{ status: 'pending' }, { status: 'inactive', reason: 'disabled' }, { status: 'inactive', reason: 'failed' }] as const) {
    setCapability(state);
    expect(root.querySelectorAll('.eficy-export-choices button')).toHaveLength(1);
    expect(html.disabled).toBe(false);
    expect(frame.style.visibility).toBe('visible');
  }
});

it('mounts one toolbar in the host slot and uses the instance snapshot callback on each click', async () => {
  const slot = document.createElement('div'); document.body.append(slot);
  const controller = new AbortController();
  const capture = vi.fn();
  let disposeSlot = () => {};
  const actions: PreviewActionsAPI = { version: 1, register(input) {
    const element = input.render({ element: input.element, signal: controller.signal, snapshot: options => { capture(); return input.capture(options ?? {}); } });
    slot.append(element);
    disposeSlot = () => { controller.abort(); element.remove(); };
    return disposeSlot;
  } };
  const { root, paint, setState, receive, setCapability, dispose } = mount(undefined, actions);
  paint(); paint();
  const frame = root.querySelector('iframe')!;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  const save = vi.fn(async (): Promise<ViewExportResult> => ({ status: 'saved' }));
  setCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportPDF: save } });
  setState({ loaded: true, content: { content: 'source' } });
  receive('ready'); receive('status', { revision: 1, status: 'committed' });
  expect(root.querySelector('.eficy-export-toolbar')).toBeNull();
  expect(slot.querySelectorAll('.eficy-export-toolbar-hosted')).toHaveLength(1);
  expect(capture).not.toHaveBeenCalled();
  for (const html of ['first interaction', 'latest interaction']) {
    slot.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
    const request = send.mock.calls.filter(([message]) => message.type === 'snapshot').at(-1)![0];
    receive('snapshot-result', { requestId: request.requestId, snapshot: { ...snapshot, html } });
    await vi.waitFor(() => expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ snapshot: { ...snapshot, html } }), expect.anything()));
  }
  expect(capture).toHaveBeenCalledTimes(2);
  dispose();
  expect(slot.children).toHaveLength(0);
  expect(controller.signal.aborted).toBe(true);
});

it('shows native export only while available and cancels a snapshot when that capability is revoked', async () => {
  const { root, paint, setState, receive, setCapability } = mount();
  paint(); paint();
  const frame = root.querySelector('iframe')!;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  const save = vi.fn(async (): Promise<ViewExportResult> => ({ status: 'saved' }));
  const value: ExportPDFAPI = { version: 1, limits, exportPDF: save };
  setCapability({ status: 'active', generation: 1, value });
  expect(root.querySelector('.eficy-export-toolbar')).not.toBeNull();
  const button = root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!;
  expect(button.disabled).toBe(true);
  setState({ loaded: true, content: { content: 'source' } });
  receive('ready');
  receive('status', { revision: 1, status: 'committed' });
  expect(button.disabled).toBe(false);
  button.click();
  const request = send.mock.calls.find(([message]) => message.type === 'snapshot')![0];
  setCapability({ status: 'inactive', reason: 'disabled' });
  expect(button.isConnected).toBe(false);
  expect(root.querySelector('.eficy-export-choices button')!.textContent).toBe('exportHTML');
  expect(send.mock.calls.some(([message]) => message.type === 'snapshot-cancel')).toBe(true);
  receive('snapshot-result', { requestId: request.requestId, snapshot });
  button.click();
  await Promise.resolve(); await Promise.resolve();
  expect(save).not.toHaveBeenCalled();
  setCapability({ status: 'active', generation: 2, value });
  expect(root.querySelector('iframe')).toBe(frame);
  const restored = root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!;
  expect(restored.disabled).toBe(false);
  restored.click();
  const latest = send.mock.calls.filter(([message]) => message.type === 'snapshot').at(-1)![0];
  receive('snapshot-result', { requestId: latest.requestId, snapshot });
  await Promise.resolve(); await Promise.resolve();
  expect(save).toHaveBeenCalledWith({ snapshot, filename: 'page.pdf', pageSize: 'a4' }, expect.objectContaining({ signal: expect.any(AbortSignal), onProgress: expect.any(Function) }));
});

function readyPreview() {
  const app = mount();
  app.paint(); app.paint();
  const frame = app.root.querySelector('iframe')!;
  const send = vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  app.setState({ loaded: true, content: { content: 'source' } });
  app.receive('ready');
  app.receive('status', { revision: 1, status: 'committed' });
  const finishSnapshot = () => {
    const request = send.mock.calls.filter(([message]) => message.type === 'snapshot').at(-1)![0];
    app.receive('snapshot-result', { requestId: request.requestId, snapshot });
  };
  return { ...app, frame, send, finishSnapshot };
}

it.each([true, false])('saves runtime HTML through the system API without capturing a snapshot (%s)', async saved => {
  const app = readyPreview();
  context.system.save.mockResolvedValue(saved);
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  await vi.waitFor(() => expect(context.system.save).toHaveBeenCalledOnce());
  const file = context.system.save.mock.calls[0][0];
  expect(file.name).toBe('page.html');
  const doc = new DOMParser().parseFromString(file.content, 'text/html');
  expect(doc.doctype?.name).toBe('html');
  expect(JSON.parse(doc.querySelector('#eficy-payload')!.textContent!).source).toBe('source');
  expect(app.send.mock.calls.some(([message]) => message.type === 'snapshot')).toBe(false);
  expect(app.root.querySelector('.eficy-export-feedback [role=status]')?.textContent).toBe(saved ? 'exportSaved' : 'exportCancelled');
});

it.each(['cancel', 'update', 'dispose'] as const)('does not save HTML when %s interrupts preparation', async action => {
  const app = readyPreview();
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  if (action === 'cancel') app.root.querySelector<HTMLButtonElement>('.eficy-export-cancel')!.click();
  if (action === 'update') app.setState({ loaded: true, content: { content: 'updated source' } });
  if (action === 'dispose') app.dispose();
  await new Promise(resolve => setTimeout(resolve, 10));
  expect(context.system.save).not.toHaveBeenCalled();
});

it('exports fresh source from the hosted toolbar after a failed save', async () => {
  const slot = document.createElement('div'); document.body.append(slot);
  const controller = new AbortController();
  const capture = vi.fn(async () => snapshot);
  const actions: PreviewActionsAPI = { version: 1, register(input) {
    slot.append(input.render({ element: input.element, signal: controller.signal, snapshot: capture }));
    return () => { controller.abort(); slot.replaceChildren(); };
  } };
  const app = mount(undefined, actions);
  app.paint(); app.paint();
  vi.spyOn(app.root.querySelector('iframe')!.contentWindow!, 'postMessage').mockImplementation(() => {});
  app.setState({ loaded: true, content: { content: 'source' } });
  app.receive('ready'); app.receive('status', { revision: 1, status: 'committed' });
  context.system.save.mockRejectedValueOnce(new Error('Disk full')).mockResolvedValue(true);
  const button = slot.querySelector<HTMLButtonElement>('.eficy-export-choices button')!;
  button.click();
  await vi.waitFor(() => expect(slot.querySelector('summary')?.dataset.state).toBe('error'));
  app.setState({ loaded: true, content: { content: 'latest source' } });
  app.receive('status', { revision: 2, status: 'committed' });
  button.click();
  await vi.waitFor(() => expect(slot.querySelector('summary')?.dataset.state).toBe('saved'));
  expect(capture).not.toHaveBeenCalled();
  const file = context.system.save.mock.calls.at(-1)![0];
  const doc = new DOMParser().parseFromString(file.content, 'text/html');
  expect(JSON.parse(doc.querySelector('#eficy-payload')!.textContent!).source).toBe('latest source');
});

it.each(['pdf', 'png'] as const)('uses only the independently active %s method and retains its limits', async format => {
  const app = readyPreview();
  const save = vi.fn(async (): Promise<ViewExportResult> => ({ status: 'saved' }));
  if (format === 'pdf') app.setCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportPDF: save } });
  else app.setImageCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportLongImage: save } });
  const choices = app.root.querySelectorAll<HTMLButtonElement>('.eficy-export-choices button');
  expect(choices).toHaveLength(2);
  expect(choices[0].textContent).toBe(format === 'pdf' ? 'exportPDF' : 'exportPNG');
  expect(choices[1].textContent).toBe('exportHTML');
  choices[0].click();
  app.finishSnapshot();
  await Promise.resolve(); await Promise.resolve();
  expect(save).toHaveBeenCalledWith({ snapshot, filename: `page.${format}`, ...(format === 'pdf' ? { pageSize: 'a4' } : {}) }, expect.objectContaining({ onProgress: expect.any(Function) }));
});

it('rechecks generation after snapshot resolution and ignores a replaced provider without remounting', async () => {
  const app = readyPreview();
  const save = vi.fn(async (): Promise<ViewExportResult> => ({ status: 'saved' }));
  const value: ExportPDFAPI = { version: 1, limits, exportPDF: save };
  app.setCapability({ status: 'active', generation: 1, value });
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  app.finishSnapshot();
  app.setCapability({ status: 'active', generation: 2, value });
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(save).not.toHaveBeenCalled();
  expect(app.root.querySelector('iframe')).toBe(app.frame);
  const button = app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!;
  expect(button.disabled).toBe(false);
  button.click();
  app.finishSnapshot();
  await Promise.resolve(); await Promise.resolve();
  expect(save).toHaveBeenCalledOnce();
});

it('keeps a PDF task alive when only image capability changes, then aborts on PDF revocation', async () => {
  const app = readyPreview();
  let nativeOptions!: ViewExportOptions;
  let finish!: (result: ViewExportResult) => void;
  const save = vi.fn((_input, options?: ViewExportOptions) => {
    nativeOptions = options!;
    return new Promise<ViewExportResult>(resolve => { finish = resolve; });
  });
  app.setCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportPDF: save } });
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  app.finishSnapshot();
  await Promise.resolve();
  app.setImageCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportLongImage: vi.fn() } });
  expect(nativeOptions.signal!.aborted).toBe(false);
  nativeOptions.onProgress!({ stage: 'encoding', completed: 1, total: 4 });
  expect(app.root.querySelector('[role=progressbar]')!.getAttribute('aria-valuenow')).toBe('25');
  app.setImageCapability({ status: 'inactive', reason: 'disabled' });
  expect(nativeOptions.signal!.aborted).toBe(false);
  app.setCapability({ status: 'inactive', reason: 'disabled' });
  expect(nativeOptions.signal!.aborted).toBe(true);
  expect(app.root.querySelector('.eficy-export-choices button')!.textContent).toBe('exportHTML');
  nativeOptions.onProgress!({ stage: 'saving' });
  finish({ status: 'cancelled' });
  await Promise.resolve(); await Promise.resolve();
  app.setCapability({ status: 'active', generation: 2, value: { version: 1, limits, exportPDF: save } });
  expect(app.root.textContent).not.toContain('exportSaved');
  expect(app.root.querySelector('iframe')).toBe(app.frame);
  await vi.waitFor(() => expect(app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.disabled).toBe(false));
});

it('reports device limits before calling native export and can retry after capability restoration', async () => {
  const app = readyPreview();
  const save = vi.fn(async (): Promise<ViewExportResult> => ({ status: 'saved' }));
  app.setCapability({ status: 'active', generation: 1, value: { version: 1, limits: { ...limits, maxWidth: 100 }, exportPDF: save } });
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  app.finishSnapshot();
  await Promise.resolve(); await Promise.resolve();
  expect(save).not.toHaveBeenCalled();
  expect(app.root.querySelector('.eficy-export-feedback [role=status]')?.textContent).toBe('exportError');
  expect(app.root.querySelector('summary')?.title).toBe('exportFailed');
  app.setCapability({ status: 'active', generation: 2, value: { version: 1, limits, exportPDF: save } });
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  app.finishSnapshot();
  await Promise.resolve(); await Promise.resolve();
  expect(save).toHaveBeenCalledOnce();
});

it.each(['supported', 'missing', 'unsupported'] as const)('uses official ctx.toast with safe fallback (%s)', async state => {
  const app = readyPreview();
  const show = vi.fn(() => {
    if (state === 'unsupported') throw Object.assign(new Error('GUI toast is unavailable'), { code: 'GUI_PLUGIN_UNSUPPORTED' });
    return { dismiss() {} };
  });
  if (state !== 'missing') context.toast = { show };
  const save = vi.fn(async (): Promise<ViewExportResult> => { throw new Error('Disk full'); });
  app.setCapability({ status: 'active', generation: 1, value: { version: 1, limits, exportPDF: save } });
  app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.click();
  app.finishSnapshot();
  await vi.waitFor(() => expect(app.root.querySelector('summary')?.dataset.state).toBe('error'));
  if (state !== 'missing') expect(show).toHaveBeenCalledExactlyOnceWith({ title: 'exportFailureTitle', description: 'exportFailed', variant: 'error' });
  else expect(show).not.toHaveBeenCalled();
  expect(app.root.querySelector('summary')?.title).toBe('exportFailed');
  expect(app.root.querySelector('.eficy-export-outcome')).toBeNull();
  expect(app.root.querySelector<HTMLButtonElement>('.eficy-export-choices button')!.disabled).toBe(false);
});

it('keeps a real outer SVG visible during a stalled file read and iframe bootstrap', () => {
  const { root, setState, sync, paint } = mount();
  expect(sync).toHaveBeenCalledOnce();
  const loading = root.querySelector<HTMLElement>('[role=status]')!;
  expect(loading?.querySelector('svg')).toBeTruthy();
  expect(loading.hidden).toBe(false);
  expect(root.querySelector<HTMLElement>('.eficy-file-status')!.hidden).toBe(true);
  expect(!!root.querySelector('iframe')).toBe(false);
  paint();
  expect(!!root.querySelector('iframe')).toBe(false);
  paint();
  setState({ loaded: true, content: { content: 'export default () => "ready"' } });
  const frame = root.querySelector('iframe')!;
  expect(frame.style.visibility).toBe('hidden');
  expect(frame.style.display).not.toBe('none');
  frame.dispatchEvent(new Event('load'));
  expect(loading.hidden).toBe(false);
});

it('waits through readiness and dependencies until current content commits, then keeps updates interactive', () => {
  const { root, setState, paint, receive } = mount();
  paint(); paint();
  setState({ loaded: true, content: { content: 'first' } });
  const frame = root.querySelector('iframe')!;
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  const loading = root.querySelector<HTMLElement>('.eficy-file-loading')!;
  receive('ready');
  expect(loading.hidden).toBe(false);
  receive('status', { revision: 1, status: 'loading', title: 'dependencies' });
  expect(loading.textContent).toContain('dependencies');
  expect(frame.style.visibility).toBe('hidden');
  setState({ loaded: true, content: { content: 'second' } });
  receive('status', { revision: 1, status: 'committed' });
  expect(loading.hidden).toBe(false);
  receive('status', { revision: 2, status: 'committed' });
  expect(loading.hidden).toBe(true);
  expect(frame.style.visibility).toBe('visible');
  setState({ loaded: true, content: { content: 'third' } });
  receive('status', { revision: 3, status: 'loading', title: 'rendering' });
  expect(loading.hidden).toBe(true);
  expect(frame.style.visibility).toBe('visible');
});

it('exposes file errors with retry and ignores an abandoned read failure during the next attempt', async () => {
  let reject!: (error: Error) => void;
  const sync = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  const { root, setState, paint } = mount(sync);
  const oldReject = reject;
  setState({ error: 'File unavailable', loaded: false });
  const loading = root.querySelector<HTMLElement>('.eficy-file-loading')!;
  const status = root.querySelector<HTMLElement>('.eficy-file-status')!;
  const retry = root.querySelector<HTMLButtonElement>('.eficy-file-retry')!;
  const error = root.querySelector<HTMLElement>('.eficy-file-error')!;
  expect(error.hidden).toBe(false);
  expect(error.getAttribute('role')).toBe('alert');
  expect(error.querySelector('.eficy-state-illustration svg')).not.toBeNull();
  expect(error.querySelector('.eficy-state-copy')!.contains(status)).toBe(true);
  expect(loading.hidden).toBe(true);
  expect(status.hidden).toBe(false);
  expect(status.textContent).toBe('File unavailable');
  expect(retry.hidden).toBe(false);
  retry.click();
  expect(sync).toHaveBeenCalledTimes(2);
  expect(error.hidden).toBe(true);
  expect(loading.hidden).toBe(false);
  expect(status.hidden).toBe(true);
  oldReject(new Error('Abandoned read'));
  await Promise.resolve(); await Promise.resolve();
  expect(loading.hidden).toBe(false);
  expect(status.hidden).toBe(true);
  reject(new Error('Current read failed'));
  await Promise.resolve(); await Promise.resolve();
  expect(loading.hidden).toBe(true);
  expect(status.textContent).toBe('Current read failed');
  paint(); paint();
  expect(root.querySelectorAll('iframe')).toHaveLength(1);
});

it('reveals bootstrap/runtime errors, restores loading only on retry and rejects the old document commit', () => {
  const { root, paint, receive, setState } = mount();
  paint(); paint();
  setState({ loaded: true, content: { content: 'source' } });
  const frame = root.querySelector('iframe')!;
  const oldId = /"frameId":"([^"]+)"/.exec(frame.srcdoc)![1];
  const loading = root.querySelector<HTMLElement>('.eficy-file-loading')!;
  receive('status', { revision: 0, status: 'error', error: 'bootstrap failed' });
  expect(loading.hidden).toBe(true);
  expect(frame.style.visibility).toBe('visible');
  receive('retry');
  expect(loading.hidden).toBe(false);
  expect(frame.style.visibility).toBe('hidden');
  window.dispatchEvent(new MessageEvent('message', { source: frame.contentWindow, data: { protocol: 'eficy-preview', frameId: oldId, type: 'status', revision: 1, status: 'committed' } }));
  expect(loading.hidden).toBe(false);
  paint(); paint();
  vi.spyOn(frame.contentWindow!, 'postMessage').mockImplementation(() => {});
  receive('ready');
  receive('status', { revision: 1, status: 'error', error: 'dependency failed', hasContent: false });
  expect(loading.hidden).toBe(true);
  expect(frame.style.visibility).toBe('visible');
});

it('cancels deferred bootstrap when the panel is disposed before its first paint', () => {
  const { root, paint, dispose } = mount();
  dispose();
  paint(); paint();
  expect(!!root.querySelector('iframe')).toBe(false);
});
