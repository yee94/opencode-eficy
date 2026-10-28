import { afterAll, describe, expect, it } from 'vitest';
import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot, hydrateRoot } from 'react-dom/client';
import assets from '../src/generated/runtime';
import { runtimeManifest } from '../scripts/runtime-manifest.mjs';
import pkg from '../package.json';

const loadModule = (url: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ url);
const url = (text: string) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
Object.assign(window, { React, ReactDOM: { ...ReactDOM, createRoot, hydrateRoot } });
afterAll(() => {
  Reflect.deleteProperty(window, 'React');
  Reflect.deleteProperty(window, 'ReactDOM');
});

describe('bundled official standalone', () => {
  it('derives shared runtime versions independently of plugin versions', () => {
    expect(assets.manifest).toEqual(runtimeManifest(pkg));
    const updated = { ...pkg, devDependencies: { ...pkg.devDependencies, '@eficy/browser': '1.3.0' } };
    const manifest = runtimeManifest(updated);
    expect(manifest).not.toHaveProperty('pluginVersion');
    expect(manifest.packages['@eficy/browser']).toBe('1.3.0');
    expect(manifest.packages.sucrase).toBe(pkg.dependencies.sucrase);
    expect(() => runtimeManifest({ ...pkg, devDependencies: { ...pkg.devDependencies, '@eficy/browser': '^1.2.4' } })).toThrow('exact version');
  });

  it('initializes from a non-hierarchical module URL and generates real UnoCSS without relative chunk fetches', async () => {
    const eficy = await loadModule(url(assets.eficy)) as {
      initEficy(): Promise<unknown>;
      compileJSXWithCSS(source: string): Promise<{ compiledCode: string; css: string }>;
    };
    expect(await eficy.initEficy()).toBeTruthy();
    const result = await eficy.compileJSXWithCSS('export default function App() { return <div className="text-red-500 p-4">Ready</div>; }');
    expect(result.compiledCode).toContain('eficy/jsx-runtime');
    expect(result.css).toContain('padding:1rem');
    expect(result.css).toContain('.text-red-500');
    expect(result.css).not.toContain('mock styles');
  });

  it('loads the pinned shadcn module with the same isolated React 18 instance', async () => {
    const shadcn = await loadModule(url(assets.shadcn));
    expect(shadcn.Button).toBeTruthy();
    for (const name of ['ChartContainer', 'ChartTooltip', 'ChartTooltipContent', 'Card', 'Table', 'Select', 'Tabs']) expect(shadcn[name], name).toBeTruthy();
    const charts = shadcn.Recharts as Record<string, unknown>;
    for (const name of ['AreaChart', 'Area', 'BarChart', 'Bar', 'PieChart', 'Pie', 'Cell', 'CartesianGrid']) expect(charts[name], name).toBeTruthy();
    expect(shadcn.ChartTooltip).toBe(charts.Tooltip);
    expect(shadcn.ChartLegend).toBe(charts.Legend);
    expect(React.version).toBe('18.3.1');
  });
});
