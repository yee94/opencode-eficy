# @eficy/opencode2-shadcn

OpenCode 2 的通用 Eficy + shadcn 基础插件，集成 GUI 渲染、skill 注入、校验和模板工具。AI 可以生成表单、交互工具、展示页、dashboard 或数据分析报告。可独立安装，整个隔离文档默认暗色。

数据分析是内置场景之一：用户需要分析时，直接生成可打开的 Eficy 报告，默认 400–600px 阅读布局、最大宽度 600px 居中，先给结论，再展示图表与统计口径。通用页面按自身用途选择布局。

## 安装

在连接服务的全局 `opencode.jsonc` 的 `plugins` 中加入 `"@eficy/opencode2-shadcn@0.1.2"`。配置保存后 OpenCode 自动加载；预览需要支持 `./gui-experimental` 的 GUI 宿主。

## 使用

向 agent 请求：

> 使用 eficy-shadcn 生成 report.shadcn.eficy：分析收入变化和流量来源，先给出结论，再展示指标、趋势和构成图。暗色、600px 居中，支持切换时间范围；使用演示数据，先校验再返回文件链接。

- `eficy-shadcn` skill：通用渲染契约、组件组合、Signals、事件、图标、图表和文件交付；数据分析时按需加载报告规范。
- `eficy_shadcn_template({ preset: "analytics" | "operations" })`：返回经营分析／履约分析报告 TSX，可直接定制，不写磁盘。
- `eficy_shadcn_validate({ path, source })`：检查 `.shadcn.eficy` 后缀、TSX、默认导出、导入边界与 128 KiB 上限。
- 点击文件链接在宿主现有文件标签页显示。页面输入、图表、搜索与导航在客户端运行；读取远端文件交由宿主传输。

样例：[经营分析报告](samples/analytics.shadcn.eficy)、[履约分析报告](samples/operations.shadcn.eficy)。两者使用明确标注的本地演示数据，分析结论随范围筛选同步更新。

## 内置 API

```tsx
import { signal, computed, component } from 'eficy';
import * as ui from 'shadcn';
const { Card, CardContent, ChartContainer, ChartTooltip, ChartTooltipContent } = ui;
const { Search, ArrowUpRight } = ui.Lucide;
const { AreaChart, Area, XAxis, CartesianGrid } = ui.Recharts;
```

只有 `eficy`、`shadcn` 两个 import 可用；不要从 `recharts` 或 `lucide-react` 单独 import。图表容器需要明确高度；模板已提供相应布局。`Recharts` namespace 是本插件对上游 shadcn standalone 的扩展；`ChartTooltip`、`ChartLegend` 使用与图表相同的 Recharts。

React、Eficy、shadcn 组件/CSS、Lucide、Recharts 都随 GUI 包发布，不依赖 CDN。版本清单见 `dist/runtime-manifest.json`。iframe 不提供网络、Node、父页面或跨文件模块访问；校验器不会执行源码。

与通用插件同时安装时 `.shadcn.eficy` 由本包优先处理；普通 `.eficy` 仍由通用包处理。工具名、skill 名和插件 ID 独立，不覆盖基础插件。

开发、构建和发布从[仓库根目录](../../README.md)运行 pnpm workspace 命令。
