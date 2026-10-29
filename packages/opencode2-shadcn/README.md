# @eficy/opencode2-shadcn

已有安装的兼容入口，保留 `eficy-shadcn` skill、校验和模板工具，使用与通用 Eficy 包相同的渲染实现，统一识别 `.eficy`。新用户只需安装通用 Eficy 插件，shadcn、图标与图表通过 skill 指导使用 HTTPS 模块。

数据分析是内置场景之一：用户需要分析时，直接生成可打开的 Eficy 报告，默认 400–600px 阅读布局、最大宽度 600px 居中，先给结论，再展示图表与统计口径。通用页面按自身用途选择布局。

## 安装

兼容包停留在 `0.3.0`，后续不再发布新版本。请将配置中的此包替换为[通用包](../opencode2-plugin/README.md)，仍支持 `.shadcn.eficy` 文件。

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@eficy/opencode2-plugin@0.4.2"]
}
```

配置保存后 OpenCode 自动加载；预览需要支持 `./gui-experimental` 的 GUI 宿主。

## 使用

向 agent 请求：

> 使用 eficy-shadcn 生成 report.eficy：分析收入变化和流量来源，先给出结论，再展示指标、趋势和构成图。暗色、600px 居中，支持切换时间范围；使用演示数据，先校验再返回文件链接。

- `eficy-shadcn` skill：通用渲染契约、组件组合、Signals、事件、图标、图表和文件交付；数据分析时按需加载报告规范。
- `eficy_shadcn_template({ preset: "analytics" | "operations" })`：返回经营分析／履约分析报告 TSX，可直接定制，不写磁盘。
- `eficy_shadcn_validate({ path, source })`：检查 `.eficy` 后缀、TSX、默认导出、导入边界与 128 KiB 上限。
- 点击文件链接在宿主现有文件标签页显示。页面输入、图表、搜索与导航在客户端运行；读取远端文件交由宿主传输。

样例：[经营分析报告](samples/analytics.shadcn.eficy)、[履约分析报告](samples/operations.shadcn.eficy)。两者使用明确标注的本地演示数据，分析结论随范围筛选同步更新。

## HTTPS 模块用法

```tsx
import { signal, computed, component } from 'eficy';
import { Card, CardContent } from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
import 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.css';
import { Search, ArrowUpRight } from 'https://esm.sh/lucide-react@0.468.0?external=react';
import { ResponsiveContainer, AreaChart, Area, XAxis, CartesianGrid, Tooltip } from 'https://esm.sh/recharts@2.15.4?external=react,react-dom';
```

内置 `eficy` 提供 Signals；远程库使用浏览器 ESM 与固定版本 URL。React 库的 external 参数保留宿主共享实例。图表容器需明确高度；Tooltip/Legend 从与图表相同的 Recharts URL 导入。上游 UI 模块没有 `ui.Recharts`；该接口只为旧裸 `shadcn` 导入兼容保留。

旧裸导入的 `ui.Lucide` 直接保留上游 UI 已有命名空间，`ui.ChartTooltip` / `ui.ChartLegend` 则使用与 `ui.Recharts` 同一远程模块的组件。旧报告无需改写这些调用；兼容模块的求值和依赖加载不影响仅使用直连 HTTPS 导入的新文件。

React/Eficy 随 GUI 发布，组件、CSS、图标与图表由客户端直接从 HTTPS 加载，首次使用需要网络。源码在本地编译，校验器不执行源码或访问 CDN。iframe 不提供 Node、父页面或本地跨文件模块访问。

与通用插件同时安装时本兼容包优先处理 `.eficy`，旧 `.shadcn.eficy` 也只按最后一层后缀识别。工具名、skill 名和插件 ID 保持独立；新安装不必双装。

PDF/PNG 导出与通用包共用两个独立 Yuri 客户端 GSAPI：`yuri.exportPDF`、`yuri.exportLongImage`。使用官方 `Contract.define` / `ctx.use`，仅显示处于 `active` 的 v1 能力对应按钮；都不可用时隐藏工具栏。能力取决于当前设备的原生实现，与本地/远端/LAN/Relay 服务连接无关。插件没有 main/Electron 代码，移动壳安装对应原生实现后也可提供能力。

iframe 将当前交互状态、样式、字体和 canvas 数据捕获为自包含 `{ html, width, height }`，调用对应方法并传入 `filename`、`signal`、`onProgress`；PDF 当前使用 A4，契约也允许 Letter。准备、快照和原生渲染/编码/保存均显示真实阶段，有有效总量才显示百分比。保存返回 `saved`，取消返回 `cancelled`，`EXPORT_*` 错误可重试。对应能力撤销、generation 替换或关闭预览会取消任务；恢复能力不重挂 iframe。完整契约和限制见[通用包导出说明](../opencode2-plugin/README.md#导出报告)。

开发、构建和发布从[仓库根目录](../../README.md)运行 pnpm workspace 命令。
