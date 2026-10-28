// The upstream standalone exposes shadcn components but not the chart primitives.
// Bundle the pinned primitives and share their Tooltip/Legend context with charts.
// @ts-expect-error The upstream standalone has no declaration file.
export * from '@eficy/shadcn-ui/dist/index.js';
import * as Recharts from 'recharts';
export { Recharts };
export const ChartTooltip = Recharts.Tooltip;
export const ChartLegend = Recharts.Legend;
