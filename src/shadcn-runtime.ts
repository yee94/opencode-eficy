// The upstream standalone exposes shadcn components but not the chart primitives.
// Legacy bare imports use this thin remote adapter, sharing chart context.
// @ts-expect-error Browser HTTPS module.
export * from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
// @ts-expect-error Browser HTTPS module.
import * as Recharts from 'https://esm.sh/recharts@2.15.4?external=react,react-dom';
export { Recharts };
export const ChartTooltip = Recharts.Tooltip;
export const ChartLegend = Recharts.Legend;
