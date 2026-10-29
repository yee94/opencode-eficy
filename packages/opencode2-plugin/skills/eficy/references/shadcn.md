# HTTPS 组件、图标与图表

shadcn 是组件写法，不是文件类型。统一生成 `page.eficy`，只需安装 Eficy 插件。

## 固定版本导入

图表地址待官方发布与 CDN 浏览器实测通过后用于线上预览；本地 fixture 回归不证明该 URL 可用。

```tsx
import { signal, computed, component } from 'eficy';
import { Card, CardContent, Button, Input } from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
import 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.css';
import { Activity } from 'https://esm.sh/lucide-react@0.468.0?external=react';
import { Recharts } from 'https://cdn.jsdelivr.net/npm/@eficy/charts@0.1.0/dist/index.js';
const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } = Recharts;
```

shadcn 和 charts 包使用明确的 `dist/index.js`；shadcn 的 CSS 单独导入一次。Lucide 的 `external` 参数与 charts standalone 的宿主 React/ReactDOM 契约保持 React 与预览共用，避免重复 React。换用其他组件库时确认它能作为浏览器 ESM 加载，以及样式和 React 依赖契约；任意 npm 包并不天然满足这些条件。

直接导入的 shadcn 模块没有 `ui.Recharts`。图表及 Tooltip/Legend 都从上面的同一个 Recharts URL 导入，不混用 shadcn 内部的 ChartTooltip/ChartLegend。推荐用有明确高度的容器包 `ResponsiveContainer`，数据通过 props 传入；Tooltip 可用 Recharts 自带样式或自定义 `content`。

## 交互

- 模块级 `signal` 保存源状态，`computed` 派生筛选与统计；读 `.value` 的组件用 `component()` 包裹。
- Input 使用 `value`/`onChange`；Select 和 Tabs 使用 `value`/`onValueChange`。
- Card 使用 CardHeader/CardContent 等组合；Table 使用 TableHeader/TableBody/TableRow/TableCell 等组合。
- 图表必须给父容器明确高度，并有文本指标或表格补充。

## 数据分析报告

用户要求报告时，使用实际数据或明确标注演示数据，按「标题与范围 → 结论 → 指标 → 图表 → 必要明细 → 口径与局限」组织。筛选后结论、指标和图表同步更新，区分事实与推测。

默认暗色阅读布局：400–600px，根容器 `width:100%;max-width:600px;margin-inline:auto;box-sizing:border-box`，内边距 16–20px，正文 14–16px。图表纵向排列、KPI 最多两列；更窄视口继续收缩，表格仅在自身容器横滚。表单、工具等非报告页面按用途布局。
