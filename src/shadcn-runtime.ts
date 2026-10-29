// The upstream standalone exposes shadcn components but not the chart primitives.
// Legacy bare imports use this thin remote adapter, sharing chart context.
// @ts-expect-error Browser HTTPS module.
export * from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
// @ts-expect-error Browser HTTPS module.
import { Recharts } from 'https://cdn.jsdelivr.net/npm/@eficy/charts@0.1.0/dist/index.js';
export { Recharts };
export const ChartTooltip = Recharts.Tooltip;
export const ChartLegend = Recharts.Legend;
