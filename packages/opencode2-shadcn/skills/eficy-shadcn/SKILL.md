---
name: eficy-shadcn
description: Create compact dark data-analysis reports as one .shadcn.eficy preview, with evidence-backed conclusions, interactive charts and a 400–600px reading layout.
---

# shadcn 暗色数据分析报告

## 一次交付流程

1. 明确分析问题、数据来源、时间范围和统计口径。用户提供了数据就据此计算；缺少数据时明确标注模拟数据。先写有证据的结论，再组织支持结论的指标和图表。
2. 调用 `eficy_shadcn_template({ preset: "analytics" })` 获取经营分析报告；订单履约分析用 `preset: "operations"`。工具返回完整 TSX，不写文件。替换分析结论、数据和文案；结论中的数字必须随筛选同步计算。
3. 一个文件承载报告：标题与范围 → 核心结论 → 关键指标 → 趋势/构成图 → 必要明细 → 数据口径与局限。以阅读和理解为主，按分析问题选择图表数量与类型。日期、维度和指标切换用于探索数据；只有用户明确要求管理系统时才加入侧栏、工作空间或管理操作。
4. 调用 `eficy_shadcn_validate({ path: "dashboard.shadcn.eficy", source: "完整源码" })`，修复错误至 `valid: true`。
5. 将同一份源码保存到 `.shadcn.eficy` 文件，返回 `[打开仪表盘](dashboard.shadcn.eficy)`。说明演示数据范围和可用交互。校验器只验证语法、后缀和导入边界；效果必须在预览里核对。

## 文件与运行时

- 纯 TSX，直接 `export default` React 组件；最多 128 KiB UTF-8。
- 仅静态导入 `eficy` 和 `shadcn`。它们以及 React、Recharts、Lucide、样式已在插件内置，离线也能渲染。
- 宿主负责 iframe 初始化、挂载与隔离。文件里不写 HTML 文档、script、import map、CDN、`initEficy`、`render`，不依赖网络、Node、父页面或本地跨文件资源。
- `.shadcn.eficy` 是该插件的专用后缀；通用 `.eficy` 使用基础 Eficy 插件。两个插件可同时安装。

## 真实导出与组件组合

```tsx
import { signal, computed, component, batch } from 'eficy';
import * as ui from 'shadcn';

const { Card, CardHeader, CardTitle, CardDescription, CardContent,
  Button, Badge, Input, Select, SelectTrigger, SelectValue, SelectContent,
  SelectItem, Tabs, TabsList, TabsTrigger, TabsContent,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } = ui;
const { Search, ArrowUpRight, LayoutDashboard, BarChart3 } = ui.Lucide;
const { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line } = ui.Recharts;
```

`Lucide` 来自 Eficy 上游 shadcn 包。`Recharts` 是本插件对上游的明确扩展，提供与 shadcn 图表组合兼容的同版 Recharts 原语；不要写 `import ... from 'recharts'`，也不要把 `AreaChart` 当成 `ui` 的顶层成员。

组件按组合使用：`CardHeader + CardTitle + CardDescription + CardContent`，`TableHeader/TableBody + TableRow + TableHead/TableCell`，`SelectTrigger + SelectValue + SelectContent + SelectItem`。不要给 `Button` 编造 `loading` 属性：使用 `disabled` 和明确文本。

## 图表必须可见、可读、可交互

- `ChartContainer` 必须有明确高度与最小宽度，例如 `style={{ height: 280, width: '100%', minWidth: 0 }}`；它已经提供 ResponsiveContainer，不再嵌套。
- 使用 `config={{ revenue: { label: '收入', color: '#3b82f6' } }}`，图形用 `fill="var(--color-revenue)"` / `stroke="var(--color-revenue)"`。`dataKey` 必须与数据字段一致。
- Tooltip 用 `<ChartTooltip content={<ChartTooltipContent />} />`，Legend 用 `<ChartLegend content={<ChartLegendContent />} />`，放在 `ChartContainer` 内的图表中。
- 图表旁保留文本指标或表格，颜色不能成为唯一的信息来源。空筛选结果显示明确空状态，金额和百分比统一格式。
- 使用面积/折线呈现趋势、柱状呈现比较、饼图呈现构成。避免用装饰 SVG 假装数据图表。

## Signals 与真实业务交互

- 原子 Signal 在模块级创建；业务状态不用 React Hooks。自定义组件在函数体读取 `.value` 时用 `component()` 包裹。
- 派生结论、图表数据和 KPI 使用一致的统计口径，修改日期/维度后一起更新；抽样明细明确说明其与汇总的关系。
- `Input` 使用 `value={search.value}`、`onChange={e => { search.value = e.target.value; }}`；`Select` 使用 `value={range.value}`、`onValueChange={value => { range.value = value; }}`；`Tabs` 同样使用 `onValueChange`，不要把 DOM `onChange` 套给它们。
- 多字段重置用 `batch`。数组/对象更新使用新引用，`effect` 不读写同一个 Signal 形成循环。
- 维度切换真实改变分析范围；搜索真实过滤明细；区间真实改变结论/图表/KPI。结论区分观测事实、解释与建议，相关性不直接写成因果。

## 视觉与响应式

默认主题为「暗色阅读报告」：iframe 的 html 已设置 `.dark` 和 `color-scheme: dark`，下拉/浮层继承同一主题。使用 shadcn 语义色：近黑背景、深灰图表卡片、细灰边框、亮色正文，蓝色表示主要序列、青色表示构成或正向状态。

阅读宽度以 400–600px 为目标，根容器 `width:100%; max-width:600px; margin-inline:auto; box-sizing:border-box`，内边距 16–20px。宽屏仍保持 600px 居中，小于 400px 时随容器收缩。正文 14–16px、行高 1.7–1.85；标题 24–28px，结论小标题 18px。图表纵向排列，KPI 最多两列，辅助筛选紧邻报告标题。宽明细表只在自身容器内横向滚动，核心结论应无需横滚即可读完。浏览器分别检查 400px、600px 和宽屏居中效果。

相对或绝对本地文件链接使用 `<a href>`，宿主负责打开文件标签页；页面内部导航优先 Signal 状态或 `#section`，不导航 iframe。

## 包内运行时版本

{{RUNTIME_VERSIONS}}
