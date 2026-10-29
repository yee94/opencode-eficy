# Eficy：单文件交互预览

提供 `eficy` 技能、报告模板、`eficy_validate` 校验工具与 `.eficy` GUI 预览。服务端插件 ID 为 `eficy`，SDK 使用 `@opencode/plugin` 2.2.0。iframe 内置 Eficy/React；组件、图标、图表及 CSS 通过固定版本 HTTPS 地址按需加载。

## 安装（OpenCode 2）

`0.5.0` 默认提供完整 Eficy + shadcn 页面与报告引导，支持 HTTPS 模块与 CSS 导入、静态 HTML 单文件导出，以及按客户端能力提供的 PDF/长图导出。在连接服务的全局 `opencode.json(c)` 中加入 npm 包，保留已有配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["@eficy/opencode2-plugin@0.5.0"]
}
```

配置保存后由 OpenCode 重新加载插件。终端可使用 skill 和校验工具；可视化预览需要支持标准 `./gui-experimental` 入口的 GUI 宿主。GUI API 仍为实验性接口，本版本针对 `@opencode/plugin` 2.2.0 构建。

也可用本仓库 `pnpm pack:all` 生成 tgz，安装后将对应 `node_modules/@eficy/opencode2-plugin` 绝对路径加入全局 `plugins`。

## 本地构建与安装

本目录为独立发布包，开发命令从仓库根目录执行：

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

将目录绝对路径加入连接服务的**全局** `opencode.json(c)`，保留已有配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/path/to/opencode-eficy/packages/opencode2-plugin"]
}
```

包的 `.` 导出服务端入口，`./gui-experimental` 导出预构建 GUI bundle。远程连接时应在远端服务安装同一包；仅本地放置 GUI 产物不会给远端 agent 注册技能。GUI 开关不取消服务端 skill/tool 注册。

## 生成与预览

向 agent 请求：

> 使用 eficy 技能生成一个带计数按钮和姓名输入框的 demo.eficy，先用 eficy_validate 验证，再保存并返回链接。

`.eficy` 是单文件 TSX，默认导出一个 React 组件，支持静态 `eficy`、`shadcn` 与 HTTPS ESM/CSS 导入。文件类型由最后一层后缀识别。完整 Signals 示例见 [`skills/eficy/SKILL.md`](skills/eficy/SKILL.md)。保存后点击文件链接或文件树即可预览。

`import * as ui from 'shadcn'` 提供 `ui.Recharts` 与 `ui.Lucide`。图表使用 `@eficy/charts@0.1.0` 的 Recharts namespace，UI 与图标使用 `@eficy/shadcn-ui@1.1.3`，共享宿主 React/ReactDOM；ChartTooltip/ChartLegend 与图表使用同一实例。适配模块仅在导入 `shadcn` 时加载。图表 CDN 地址尚待发布与浏览器验证。

源码变化会重新求值模块，模块级 Signal 状态可能重置；同内容更新不应重载。预览状态不是持久数据。文件读取失败、语法或渲染失败必须显示错误；真实浏览器保存更新、交互和恢复流程由集成验收确认。

Panel 创建时立即在外层真实 DOM 显示居中的 SVG 与提示，覆盖文件读取、iframe 启动、源码编译和 HTTPS 组件/样式加载，直到当前版本内容实际提交。首次加载提示只显示在居中画面，顶部状态区用于文件错误和重试。SVG/样式与 iframe 自带加载画面共用，独立使用 frame 时仍有加载提示。文案沿用宿主 `ctx.t` 的语言，动画遵循 `prefers-reduced-motion`。

iframe 在外层占位获得绘制机会后才创建；等待期间使用 `visibility:hidden` 保留实际尺寸，不使用 `display:none`。外层依据经过 source、frameId 与 revision 校验的 `status` 消息收起加载画面；iframe 的 `load`、runtime 的 `ready` 和导出的 `render-state` 都不是内容就绪信号。首次内容提交前不展示内部初始化占位，已有内容在后台更新期间保持可交互。文件错误显示外层重试；启动、依赖和渲染错误解除遮挡并显示 iframe 内错误与重试。重试重建文档、分配新 frameId 并重新发送最新源码，旧文档消息、过期 revision 和已关闭 Panel 的异步结果不能影响新加载。

当前版本提交时，在用户组件的 layout effect 之前启用样式并解除根节点隐藏，保证首次布局测量有效；同次提交的 layout effect 收起加载画面。加载画面采用独立固定定位，不参与内容布局，也不覆盖已有可交互内容。

### 加载回归与阶段注入

运行 `pnpm build && pnpm typecheck` 后，用 `pnpm exec vitest run tests/preview-loading.test.ts tests/bootstrap-loading.test.ts tests/frame.test.ts tests/frame-runtime.test.ts tests/gui.test.ts` 验证 Panel、父子消息边界和真实 runtime；bootstrap 用例执行生成的内联运行时，避免只测源码而漏掉旧构建产物。

浏览器夹具可独立控制以下边界，无需改原报告或添加生产开关：

- 文件：在宿主 `file.sync`/`readFile` 返回一个可手动 resolve/reject 的 Promise；等待期间外层 SVG 可见、顶部无重复加载文字。reject 后应看到错误与重试。
- 启动：暂存 iframe 的 `srcdoc` setter 写入，释放时调用原 setter；期间 iframe 隐藏但宽高非零。收到 `ready` 后 SVG 仍须可见。
- 依赖/模块：仅给夹具读取到的源码前置一个等待消息的顶层 Promise；释放前保持加载，释放后等待 `status:committed`，不能以 `render-state` 或 `ready` 提前结束。
- CSS/渲染：在浏览器网络层暂存样式响应，或用测试组件抛出可控 Suspense Promise；错误响应/渲染异常必须露出错误与重试，成功 layout commit 才收起加载。
- 更新/取消：第一次提交后再次阻塞模块，旧按钮仍应可点击；等待期间关闭或切换文件，再释放旧 Promise，不得改变新 Panel。

生产 GUI 产物为 `packages/opencode2-plugin/dist/gui-experimental.cjs`。运行时与 GUI 必须同次构建，正在修改期间的中间产物不用于验收。

## 内置报告与组件说明

`eficy` 技能用于页面、报告、分析、看板和图表，默认采用 shadcn 组件、暗色主题和报告阅读布局，也支持用户指定风格。包内提供组件说明、报告规范，以及 [经营分析](samples/analytics.eficy)、[履约分析](samples/operations.eficy) 和 [交互工作台](samples/workbench.eficy) 示例。

调用 `eficy_template({ preset: "analytics" | "operations" })` 获取对应报告完整源码，按实际数据与问题修改后使用 `eficy_validate` 校验并保存。模板包含明确标注的演示数据；工具只返回源码，不写文件。

页面内的 `<a href>` 本地文件链接通过标准 `ctx.links.open` 交给宿主：支持绝对路径、`file://` URL 和相对当前文件目录的路径，继续在文件标签页中渲染。消息中的文件链接也进入同一文件预览链路。iframe 不自行跳转到本地路径；文件不存在或当前服务无权访问时按宿主文件错误显示。

## 校验与隔离边界

`eficy_validate({ path, source })` 只处理传入文本，不读取目标路径、不执行代码、不解析网络或磁盘依赖。Sucrase 执行真正的 TSX 语法解析；同一语法 token 流用于检查默认导出和 import 边界。源码限制为 **128 KiB UTF-8**。失败返回 `valid: false`、`code` 和 `error`，区分缺失输入、路径、超限、语法、默认导出、导入与 frame 文档边界问题。

格式要求直接 `export default`；支持固定版本的 HTTPS 浏览器模块与 CSS 侧效导入。相对本地模块、未映射的 npm 包名、动态 import、`require`、`loadModule` 不支持。外部 React 库需保留 React external，使用 frame 的共享实例；初始化、import map 和挂载由 frame 管理。静态校验通过不证明 CDN 可达或模块包含所需导出。

静态校验不是类型检查或安全沙箱，也不能证明默认导出值可渲染。源码在客户端编译并在隔离 iframe 运行，不发送到 CDN；网络用于获取外部资源。iframe 权限、CSP、消息来源校验和资源清理由 frame 承担，不授予父页 DOM、宿主 SDK 或 Node API 能力。首次加载需要网络及资源端 CORS 支持，浏览器缓存不等于完整离线保证。

iframe 采用 `allow-scripts allow-forms`，不授予 same-origin 权限。`allow-forms` 让 React 的 `onSubmit` 可以收到原生表单事件，CSP 的 `form-action 'none'` 仍禁止网络表单提交。消息通过 source 与独立 frameId 校验；opaque origin 的首次握手只能使用通配目标，不传递宿主凭据。

## 导出报告

提供 `yuri.previewActions` v1 的宿主负责操作区排版：移动端标题行、PC 右上角悬浮位置，与源码切换并排。插件注册当前 iframe 的 `element/capture/render`，`render(surface)` 的点击回调通过 `surface.snapshot()` 获取该实例最新内容，并将 `surface.signal` 传入导出任务。卸载、源码切换和重试撤销按钮；两份预览互不串用快照。未提供该契约时使用内联悬浮菜单。

入口仅显示 16px 下载图标，36px 触控区域采用淡黑半透明背景，无明显边框和强阴影；「导出」文字仅保留于本地化 aria-label/title。点击后才出现菜单，忙碌圆环与成功小勾号均在入口原位显示。

预览右上角悬浮的「导出」下拉菜单支持 PDF、PNG 长图和静态 HTML 单文件，不占用整行、不移动报告，保留当前页面的筛选、输入和展开状态。菜单支持 Escape 归还入口焦点、外点（含 iframe）收起；加载未就绪时禁用。PDF/PNG 通过官方 `Contract.define` / `ctx.use` 分别消费 Yuri 的两个客户端 GSAPI：`yuri.exportPDF` 和 `yuri.exportLongImage`。插件只有窗口 setup，原生渲染和保存由当前设备的宿主实现。

PDF/PNG 的契约独立判断 `active` 且 `value.version === 1`，不可用时隐藏对应菜单项。能力属于当前客户端设备，与连接本地、远端、LAN 或 Relay 服务无关。Electron 或安装了对应原生实现的移动壳可提供能力。能力撤销/替换取消对应格式的任务；另一格式变化不打断当前任务。快照开始与调用原生保存前重新检查对应能力及 generation，关闭预览或内容更新也会取消任务。能力恢复不会重挂 iframe 或丢失交互状态。

「导出 HTML」始终保留，预览就绪后可用，不依赖 PDF/PNG 契约。`src/export-html.ts` 将当前快照封装为含 UTF-8、标题、视口和 CSP 的完整 HTML 文档，通过 SDK `ctx.system.save({ name, content })` 保存；桌面端弹保存框，网页端下载。文件内嵌样式、图片和字体，保留当前筛选结果、输入值和页面尺寸，可离线阅读，不包含 React/Eficy 脚本或后续筛选交互。准备快照时可以取消；保存框打开后由保存框确认或取消，SDK 返回的布尔值决定最终状态。

结构类型在 `src/export-types.ts` 中维护，契约声明在 `src/export-contract.ts`。公开输入为 `{ snapshot: { html, width, height }, filename }`；PDF 另有可选 `pageSize: 'a4' | 'letter'`，当前按钮使用 A4。每个能力提供 `version: 1`、各自的 `limits` 和各自的方法 `exportPDF` / `exportLongImage`，调用选项为 `{ signal, onProgress }`。插件按能力限制检查 HTML UTF-8 字节、宽高和像素总数；宿主仍独立执行资源及安全校验。

快照在 iframe 内通过 `html-to-image` 收集 DOM、计算样式、字体和图片（含 canvas 数据），将 SVG 的 foreignObject 内容转换为静态自包含 HTML，补齐序列化后的表单状态，再交给宿主。宿主原生导出页禁用脚本、外部网络和导航。插件不执行报告源码的第二次渲染，不生成最终 PDF/PNG；HTML 文件保存及浏览器下载由 SDK 处理。

导出进行中仅显示双 circle 圆环与中央取消图标；真实阶段通过读屏状态播报。仅当存在有效 `completed` 与正数 `total` 时显示确定进度（百分比供读屏），其余阶段旋转而不估算，并尊重减少动画偏好。方法完成返回 `{ status: 'saved' | 'cancelled' }`，以原生终态为准：保存已经提交后收到取消请求仍短暂显示成功勾号，原生确认取消才播报取消；已销毁工具栏不更新终态。失败 reject 携带 `EXPORT_*` code；`EXPORT_ABORTED` 显示取消，其他错误显示精简失败提示，详细错误通过官方 `{{error}}` 插值保留在 title 和 aria-live 中，可重新打开菜单重试。取消后的迟到进度不更新界面。

## 文件类型图标

GUI 同包携带 `.eficy` 的 E 字母文件图标，通过官方 `Registry.define` 注册到
Yuri 的可选 `yuri.file-icon` 扩展。文件树、标签页和文件引用共享此图标；关闭插件
GUI 后恢复宿主默认图标。图标随 GUI bundle 更新，不需要修改 Yuri 内置扩展名表。
这不是 OpenCode SDK 的内置文件图标接口，其他宿主若不消费该 registry，仍可使用
同一插件的预览和 skill。

```ts
const FileIcon = Registry.define<{
  id: string;
  extensions: readonly string[];
  svg: string;
  lightSvg?: string;
}>('yuri.file-icon');
ctx.add(FileIcon, { id: 'eficy', extensions: ['eficy'], svg: fileIcon });
```

## 版本与更新

内置依赖版本以 `package.json` 和锁文件为源，构建产出 `dist/runtime-manifest.json`，服务端将版本注入 skill。外部组件版本由文件中的 HTTPS URL 决定；更新后需重新验证导出、样式、React 兼容和交互。

更新包依赖后须重新构建内置运行时和 GUI，运行验证，更新插件版本，并把运行时产物、manifest 与 skill 同包发布。不能只改 skill 里的文字来宣称运行时已升级。解析器使用已固定 Sucrase 版本的内部 token API，升级 Sucrase 时同时验证 parser 测试和浏览器编译行为。

构建同时校验安装版本与 lock，版本号只来自 `package.json`，不在构建脚本另抄一份。官方 browser 1.2.4 的 standalone 仍含动态分块，因此先用标准 Webpack context 和单 chunk 构建合并官方文件，再作为文本内置于标准 GUI CJS；没有改写上游源码。生成资产内嵌同一 manifest，旧资产与新版本清单不匹配时构建失败。

## 验证范围

`tests/parser.test.ts` 覆盖真实语法、默认导出、导入策略、字节边界、文档标签与 skill 示例；`tests/server.test.ts` 使用真实 SDK 定义执行 skill/tool transforms，检查 manifest 注入和工具错误结果。先构建运行时，再运行测试。

`tests/legacy-report.test.ts` 使用真实内置 Eficy 编译器、上游 UI 与 Recharts，在 happy-dom 执行旧报告消费者，覆盖两个命名空间、嵌套 computed、component/batch 交互、ChartContainer 图形和 Tooltip 内容。测试只在模块解析边界用本机已安装的同版本库替代 HTTPS，布局尺寸由测试提供；CDN、import map 和实际布局仍需浏览器验收。可用 `EFICY_LEGACY_REPORT=/path/to/KF-ITERATION-REPORT.shadcn.eficy pnpm exec vitest run tests/legacy-report.test.ts` 直接运行原报告，文件按原文读取，验证四张图表与展开交互；未提供路径时跳过这一外部文件用例。

默认图表 fixture 用已安装 Recharts 模拟新包的 namespace/named exports；设置 `EFICY_CHARTS_FIXTURE=/path/to/charts/dist/index.js` 可用真实 charts standalone 替代。两种路径均检查 ChartTooltip/ChartLegend 与 namespace 的组件身份；fixture 仅用于测试，不是生产依赖。

自动测试不能替代浏览器验收。实际宿主应检查：文件链接与侧边文件树打开后的预览、Signals 交互、HTTPS 模块/CSS 加载、源码更新、错误与修复、跨文件/会话隔离和关闭清理。外部依赖断网或 404 时须显示可恢复错误，不承诺离线可用。
