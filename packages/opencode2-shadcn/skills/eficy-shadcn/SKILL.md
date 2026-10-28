---
name: eficy-shadcn
description: Build interactive Eficy + shadcn previews as single .shadcn.eficy files: pages, forms, tools, dashboards and data-analysis reports. Includes Signals, components, icons and chart rendering rules.
---

# Eficy + shadcn 单文件交互预览

## 一次交付流程

1. 根据用户目标选择页面结构与交互：表单、计算工具、展示页、dashboard 等都可直接用 Eficy + shadcn 实现。用户要求数据分析、图表解读或报告时，先读 [报告规范](references/reports.md)，再生成可打开的报告文件。
2. 将组件、数据和状态写入一个 `.shadcn.eficy` TSX 文件，遵循下面的渲染契约。报告可选用 `eficy_shadcn_template` 获取完整起点；其他页面直接编写，不必套用报告模板。
3. 调用 `eficy_shadcn_validate({ path: "preview.shadcn.eficy", source: "完整源码" })`，修复错误至 `valid: true`。
4. 将同一份源码保存到磁盘，返回 `[打开预览](preview.shadcn.eficy)`。在 GUI 中检查实际交互。校验器只验证语法、后缀和导入边界，不替代浏览器验收。

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
- 用 `computed()` 派生筛选结果、计算值和展示数据；事件修改源 Signal，组件自动重新渲染。文件更新时模块会重新求值，状态不持久化。
- `Input` 使用 `value={search.value}`、`onChange={e => { search.value = e.target.value; }}`；`Select` 使用 `value={range.value}`、`onValueChange={value => { range.value = value; }}`；`Tabs` 同样使用 `onValueChange`，不要把 DOM `onChange` 套给它们。
- 多字段重置用 `batch`。数组/对象更新使用新引用，`effect` 不读写同一个 Signal 形成循环。
- 每个可操作控件都有可见结果；表单展示校验或提交结果，工具更新计算值，筛选更新展示数据。

### 最小交互示例

```tsx
import { signal, computed, component } from 'eficy';
import { Card, CardContent, Input, Button } from 'shadcn';
const name = signal('');
const message = computed(() => name.value.trim() ? `你好，${name.value.trim()}` : '输入姓名开始');
const Preview = component(() => <main className="p-4">
  <Card><CardContent className="p-4 space-y-3">
    <label htmlFor="name">姓名</label>
    <Input id="name" value={name.value} onChange={event => { name.value = event.target.value; }} />
    <p aria-live="polite">{message.value}</p>
    <Button onClick={() => { name.value = ''; }} disabled={!name.value}>清空</Button>
  </CardContent></Card>
</main>);
```

文件末尾添加 `export default Preview;`。宿主会编译 TSX/工具类并挂载默认导出，无需自行调用 ReactDOM。

## 视觉与响应式

默认暗色：iframe 的 html 已设置 `.dark` 和 `color-scheme: dark`，下拉/浮层继承同一主题。使用 shadcn 的 `bg-background`、`text-foreground`、`text-muted-foreground`、`border-border` 等语义工具类。宿主运行时编译 Tailwind/UnoCSS 风格类名；单文件内也可用 `<style>` 定义专用布局。

布局根据页面用途与宿主容器自适应，图表明确高度，宽表格内部横滚。400–600px 的阅读宽度用于报告场景，通用页面按任务选择合适宽度。

相对或绝对本地文件链接使用 `<a href>`，宿主负责打开文件标签页；页面内部导航优先 Signal 状态或 `#section`，不导航 iframe。

## 包内运行时版本

{{RUNTIME_VERSIONS}}
