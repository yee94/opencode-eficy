import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import * as Recharts from 'recharts';
import assets from '../src/generated/runtime';
import { parseEficy } from '../src/parser';

const directory = dirname(fileURLToPath(import.meta.url));
const url = (source: string) => `data:text/javascript;base64,${Buffer.from(`${source}\n//# sourceURL=legacy-report-module.js`).toString('base64')}`;
const loadModule = async (source: string): Promise<Record<string, any>> => {
  try { return await import(/* @vite-ignore */ url(source)); }
  catch (error) { throw new Error(error instanceof Error ? error.message : String(error)); }
};
let eficy: Record<string, any>;
let core: unknown;
let adapter: string;
let root: Root;
let container: HTMLDivElement;

beforeAll(async () => {
  Object.assign(window, { React, ReactDOM: { ...ReactDOM, createRoot, hydrateRoot }, legacyTestRecharts: Recharts });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, width: 600, height: 240, top: 0, right: 600, bottom: 240, left: 0, toJSON() {} });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(240);
  eficy = await loadModule(assets.eficy);
  core = await eficy.initEficy();
  // Node lacks browser import maps/HTTPS imports. Resolve just these module
  // boundaries to installed real libraries; the runtime and report stay real.
  const upstream = url(readFileSync(join(directory, '../node_modules/@eficy/shadcn-ui/dist/index.js'), 'utf8'));
  const charts = url(`export const {${Object.keys(Recharts).filter(key => key !== 'default').join(',')}} = window.legacyTestRecharts;`);
  const result = await build({
    stdin: { contents: assets.shadcn, loader: 'js' }, bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'installed-remote-modules', setup(builder) {
      builder.onResolve({ filter: /^https:\/\// }, args => {
        if (args.path === 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js') return { path: upstream, external: true };
        if (args.path === 'https://esm.sh/recharts@2.15.4?external=react,react-dom') return { path: charts, external: true };
        throw new Error(`Unexpected remote dependency: ${args.path}`);
      });
    } }],
  });
  adapter = url(result.outputFiles[0].text);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterAll(async () => {
  if (root) await act(async () => root.unmount());
  container?.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const name of ['React', 'ReactDOM', 'legacyTestRecharts']) Reflect.deleteProperty(window, name);
});

async function renderReport(source: string) {
  parseEficy('legacy-report.shadcn.eficy', source);
  const compiled = await eficy.compileJSXWithCSS(source);
  const result = await build({
    stdin: { contents: compiled.compiledCode, loader: 'js' }, bundle: true, write: false, format: 'esm',
    plugins: [{ name: 'frame-import-map', setup(builder) {
      builder.onResolve({ filter: /^(eficy(?:\/jsx-runtime)?|shadcn)$/ }, args => ({ path: args.path === 'shadcn' ? adapter : url(assets.eficy), external: true }));
    } }],
  });
  const report = await loadModule(result.outputFiles[0].text);
  await act(async () => root.render(React.createElement(eficy.EficyProvider, { core }, React.createElement(report.default))));
}

it('runs legacy namespaces, nested computed Signals, disclosure and ChartContainer consumers', async () => {
  await renderReport(readFileSync(join(directory, 'fixtures/legacy-report.shadcn.eficy'), 'utf8'));
  expect(container.querySelector('h1')?.textContent).toBe('Legacy report');
  expect(container.querySelector('output')?.textContent).toBe('2 sections · 50%');
  expect(container.querySelectorAll('[aria-label="Icons"] svg')).toHaveLength(7);
  expect(container.querySelectorAll('.recharts-surface')).toHaveLength(2);
  expect(container.querySelectorAll('.recharts-area-curve')).toHaveLength(1);
  expect(container.querySelectorAll('.recharts-bar-rectangle')).toHaveLength(2);
  await act(async () => {
    const event = new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 100 });
    // happy-dom does not derive page coordinates from client coordinates.
    Object.defineProperties(event, { pageX: { value: 150 }, pageY: { value: 100 } });
    container.querySelector('.recharts-wrapper')!.dispatchEvent(event);
  });
  expect(container.querySelector('.recharts-tooltip-wrapper')?.textContent).toContain('Passed');
  const disclosure = container.querySelector<HTMLButtonElement>('button[aria-expanded="true"]')!;
  await act(async () => disclosure.click());
  expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  expect(container.textContent).not.toContain('Methods details');
  const focus = [...container.querySelectorAll('button')].find(button => button.textContent === 'Focus Guard')!;
  await act(async () => focus.click());
  expect(container.querySelector('[aria-label="Sections"]')?.textContent).toBe('GuardGuard details');
});

it.skipIf(!process.env.EFICY_LEGACY_REPORT)('runs the unchanged original report supplied for reproduction', async () => {
  await renderReport(readFileSync(process.env.EFICY_LEGACY_REPORT!, 'utf8'));
  expect(container.querySelector('h1')?.textContent).toBe('七条研究线跑完，没有一条通过上线验收');
  expect(container.querySelectorAll('.recharts-surface')).toHaveLength(4);
  expect(container.querySelectorAll('.kf-sections .kf-card')).toHaveLength(7);
  const disclosure = container.querySelector<HTMLButtonElement>('.kf-section-head[aria-expanded="true"]')!;
  await act(async () => disclosure.click());
  expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelectorAll('.kf-section-body')).toHaveLength(0);
});
