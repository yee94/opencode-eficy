// @vitest-environment node
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';

describe.each([
  { preset: 'analytics', root: 'ns-app', content: 'ns-content', metrics: 'ns-metrics', charts: 'ns-chart-grid', orders: 'ns-orders' },
  { preset: 'operations', root: 'ops', content: 'ops-content', metrics: 'ops-kpis', charts: 'ops-charts', orders: 'ops-orders' },
])('$preset report layout', ({ preset, root, content, metrics, charts, orders }) => {
  const source = readFileSync(new URL(`../packages/opencode2-plugin/samples/${preset}.eficy`, import.meta.url), 'utf8');
  const css = source.match(/<style>\{`([\s\S]*?)`\}/)![1];

  it.each([390, 600, 760, 761, 1024, 1600])('adapts to a %ipx preview instead of enforcing a report width', width => {
    const window = new Window({ width, height: 900 });
    try {
      const document = window.document;
      document.head.innerHTML = `<style>${css}</style>`;
      document.body.innerHTML = `<main class="${root}"><div class="${content}"><div class="${metrics}"></div><div class="${charts}"></div><div class="${orders}"><div data-slot="table-container"></div></div></div></main>`;
      const style = (selector: string) => window.getComputedStyle(document.querySelector(selector)!);
      const report = style(`.${root}`);
      expect(report.width).toBe('100%');
      expect(['', 'none']).toContain(report.maxWidth);
      expect(report.boxSizing).toBe('border-box');
      expect(['', 'none']).toContain(style(`.${content}`).maxWidth);
      expect(style('[data-slot="table-container"]').overflowX).toBe('auto');
      expect(style(`.${metrics}`).gridTemplateColumns).toBe(`repeat(${width <= 760 ? 2 : 4},minmax(0,1fr))`);
      const chartColumns = style(`.${charts}`).gridTemplateColumns;
      if (width <= 760) expect(chartColumns).toBe('minmax(0,1fr)');
      else expect(chartColumns).not.toBe('minmax(0,1fr)');
      if (preset === 'analytics') expect(report.gridTemplateColumns).toBe('minmax(0,1fr)');
    } finally {
      window.close();
    }
  });
});
