# OpenCode 2 的 Eficy 插件

Eficy 为 OpenCode 2 提供 `.eficy` 单文件交互预览，内置页面与报告技能、校验工具和分析模板。组件、图标、图表及 CSS 通过 HTTPS 按需加载。

| npm 包 | 文件后缀 | 用途 |
| --- | --- | --- |
| [`@eficy/opencode2-plugin`](packages/opencode2-plugin/README.md) | `.eficy` | 通用交互式 TSX 预览 |

## 安装

将 `@eficy/opencode2-plugin@0.5.6` 加入连接服务的全局 `opencode.jsonc`，保留已有配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@eficy/opencode2-plugin@0.5.6"
  ]
}
```

终端可使用技能和工具；显示预览需要支持实验性 GUI 插件接口的宿主。SDK 固定为 `@opencode/plugin` 2.2.0。

## 一次生成数据分析报告

> 使用 eficy 技能，生成一份 SaaS 收入分析报告：先给结论，再展示关键指标、趋势和渠道构成，注明统计口径；暗色、最大宽度 600px 居中，支持日期筛选，使用演示数据。保存 report.eficy 并返回预览链接。

`eficy` 技能在页面、分析报告、看板和图表任务中默认交付 Eficy 文件，简单查找、列举和问答直接回复。基础包包含按需读取的 shadcn/图表导入、组件交互和报告规范；`eficy_template` 提供 `analytics` 经营分析与 `operations` 履约分析模板，修改后直接保存并交付链接，校验与浏览器检查按需使用。源码、数据、状态留在一个文件中，本地编译；React/Eficy 内置，外部组件和 CSS 按固定版本 URL 在客户端加载。

## 开发结构

### 客户端导出

宿主通过 `yuri.previewActions` v1 装载下载控件：PC 在右上角与源码按钮并排，手机在半浮层标题行。`src/preview-actions.ts` 声明结构契约，按当前 Solid Panel mount 注册 iframe 元素、实时 capture 和操作 UI；PDF/PNG 点击通过该 surface 的 `snapshot()` 获取最新 HTML/宽高，不截工具栏。卸载撤销按钮并取消任务。未提供此契约时使用内联悬浮入口。

入口为报告预览右上角的 16px 下载图标，默认背景透明、无明显边框或阴影，不显示文字、不占用布局；本地化名称保留在 aria-label/title，点击才展开 PDF/PNG/HTML 菜单。进行中原位显示带取消按钮的圆环，成功原位短暂显示勾号；失败通过宿主全局 toast 展示本地化错误，原位保留可重试的错误图标、详细 title/aria 和简短读屏状态，不显示局部长文或错误 pill。菜单支持 Escape 收起并归还焦点、外点（含 iframe）收起；加载未就绪时禁用。控件触控目标至少 36px，支持宿主明暗色变量与减少动画偏好。

错误通知使用 SDK 2.2.0 官方 `ctx.toast.show({ title, description, variant: 'error' })`，标题为本地化简短提示，description 为详细错误。`ctx.toast` 不可用时通过错误图标及 title/aria 提示，支持重试。取消、abort 和销毁后的迟到失败不触发 toast；已提交的原生 saved 结果仍优先于 abort。

「导出 HTML」通过 SDK 的 `ctx.system.save` 保存可独立运行的交互单文件：桌面端弹出保存框，网页端下载。文件包含当前预览源码、Eficy/React 运行时、编译器和启动逻辑，打开即可使用 Signals、输入绑定和筛选交互，无需 OpenCode 宿主。预览与导出共用 `src/frame-document.ts` 和 `src/frame-runtime.ts`。打开时从源码初始状态运行，不序列化当前 Signals 值；HTTPS 组件、样式、图片和字体仍从原地址加载，只有不依赖外部资源的页面可完整离线运行。生成文件时可取消，保存框打开后以保存框的确认/取消结果为准。

PDF/PNG 使用 Yuri 的独立 GSAPI `yuri.exportPDF` / `yuri.exportLongImage`，通过官方 `Contract.define` / `ctx.use` 获取当前设备的 v1 活动能力，分别控制对应菜单项；HTML 不依赖这两个能力。本地、远端和 Relay 连接使用相同判断。插件不含 main/Electron 导出代码。iframe 生成保留实时交互状态的自包含 HTML 快照，宿主负责原生 PDF/PNG 生成和保存。

公开结构类型位于 `src/export-types.ts`，token 位于 `src/export-contract.ts`，不跨仓库导入。输入包含 `snapshot: { html, width, height }` 与 `filename`，PDF 支持 A4/Letter；选项包含 `signal` / `onProgress`，结果为 `saved` 或 `cancelled`，失败携带 `EXPORT_*` code。能力撤销/替换时取消对应任务，恢复后继续使用原 iframe。真实阶段及有总量的进度显示见[完整说明](packages/opencode2-plugin/README.md#导出报告)。

### 目录

```text
packages/opencode2-plugin/  通用包入口、技能、样例和发布元数据
src/                       共享服务端注册、解析、GUI 和隔离 iframe 实现
scripts/                   共享运行时构建、单包构建和打包发布
tests/                     运行时、校验、包契约及浏览器夹具
```

使用 pnpm workspace、Turborepo 和 Changesets 管理基础包。根包为 private；共享源码在构建时内联进基础包，npm 用户无需安装本仓库或访问相邻目录。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

内置运行时依赖版本由根 manifest 和锁文件控制；基础包维护版本并生成 `dist/runtime-manifest.json`。文件中的 HTTPS URL 决定外部组件版本，更新组件不必新增插件或后缀。更新运行时后为基础包创建 changeset。

导出回归覆盖两个契约的格式独立、generation 过期、撤销/取消/恢复、失败重试、快照资源及表单状态、进度总量与基础包的无 main 入口。`pnpm build` 同时更新内联运行时和 GUI 产物；自动测试不代表 Electron/iOS/Android 的原生保存实机验收。

```sh
pnpm changeset
pnpm changeset version
```

GitHub Actions 使用仓库的 `NPM_TOKEN` Secret 发布基础包；版本由 `.github/workflows/changesets.yml` 管理，版本变更合入 main 后发布并创建 GitHub Release。发布前必须构建、类型检查、测试并验证打包安装。

## 边界

预览文件支持静态 `eficy`、`shadcn` 与 HTTPS ESM/CSS 导入。远程模块必须满足 CORS、浏览器 ESM 和共享 React 契约，任意 npm 包并不自动兼容。首次加载需要网络；缓存由浏览器管理，不承诺完整离线可用。源码不发送到 CDN 编译。跨文件本地模块与 Node API 不支持。静态校验不执行代码或获取远程导出，不能代替真实浏览器验收。源码更新重新求值模块，状态不持久化；本地文件链接交给宿主文件标签页。

Eficy 上游参考：[`@eficy/shadcn-ui`](https://www.npmjs.com/package/@eficy/shadcn-ui)。图表及 Tooltip/Legend 使用同一固定 Recharts URL 导入。许可证见 [LICENSE](LICENSE) 和每包 `dist/THIRD-PARTY-NOTICES.txt`。
