# Eficy plugins for OpenCode 2

Eficy 使用一种 `.eficy` 文件格式。通用 OpenCode 2 插件提供服务端 skill/tool 和标准 `./gui-experimental` GUI；shadcn、图标、图表是 HTTPS 模块及 skill 使用方法，不需要额外渲染插件。

| npm 包 | 文件后缀 | 用途 |
| --- | --- | --- |
| [`@eficy/opencode2-plugin`](packages/opencode2-plugin/README.md) | `.eficy` | 通用交互式 TSX 预览 |
| [`@eficy/opencode2-shadcn`](packages/opencode2-shadcn/README.md) | `.eficy` | 旧安装兼容入口，同一渲染实现；保留原 skill/tool 名称 |

## 安装

新安装只需通用包 `@eficy/opencode2-plugin@0.4.4`，此版本支持 HTTPS 导入和按客户端能力提供的 PDF/长图导出。将 npm 包加入连接服务的全局 `opencode.jsonc`，保留已有配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@eficy/opencode2-plugin@0.4.4"
  ]
}
```

终端可使用技能和工具；显示预览需要支持实验性 GUI 插件接口的宿主。SDK 固定为 `@opencode/plugin` 2.2.0。

### 单装与双装

只看最后一层后缀；`report.eficy` 与 `report.shadcn.eficy` 属于同一文件格式。旧 shadcn 兼容包停留在 `0.3.0`，不再发布新版本；已有安装请替换为 `@eficy/opencode2-plugin`，无需双装。后续只发布通用包。

| 安装方式 | 普通 `.eficy` | `.shadcn.eficy` |
| --- | --- | --- |
| 仅通用包 | 通用预览 | 通用预览 |
| 仅 shadcn 兼容包 | Eficy 预览 | Eficy 预览 |
| 两者都装 | 高优先级处理器接管 | 高优先级处理器接管 |

双装会加载两份独立 GUI bundle，并提供两个 skill、三个工具；OpenCode 不按功能去重。新点击只调用优先级最高的一个处理器，不会自动开两个预览。两包的插件 ID、skill 和工具名不同，标签页按插件 ID 隔离，预览运行时在各自 iframe 中执行。

优先级只影响新点击，不迁移已保存的标签页。旧标签仍按插件 ID 隔离；切换安装方式后可关闭旧标签，再打开文件。

## 一次生成数据分析报告

> 使用 eficy 技能，生成一份 SaaS 收入分析报告：先给结论，再展示关键指标、趋势和渠道构成，注明统计口径；暗色、最大宽度 600px 居中，支持日期筛选，使用演示数据。校验后保存 report.eficy 并返回预览链接。

通用 `eficy` skill 包含 shadcn/图表的 HTTPS 导入说明和报告规范。兼容包仍提供 `eficy_shadcn_template` 与 `eficy_shadcn_validate`。源码、数据、状态留在一个文件中，本地编译；React/Eficy 内置，外部组件和 CSS 按固定版本 URL 在客户端加载。

## 开发结构

### 客户端导出

新版宿主通过 `yuri.previewActions` v1 装载下载控件：PC 在原右上角悬浮区与源码按钮并排，手机在半浮层标题行。`src/preview-actions.ts` 声明结构契约，按当前 Solid Panel mount 注册 iframe 元素、实时 capture 和操作 UI；点击通过该 surface 的 `snapshot()` 获取最新 HTML/宽高，不截工具栏。卸载撤销按钮并取消任务。未提供此契约的旧宿主继续使用下述内联悬浮入口，只生成一份菜单；已发布 0.4.2 插件仍可由新宿主正常预览，宿主不代造下载按钮。

入口为报告预览右上角的 16px 下载图标，采用淡黑半透明底、无明显边框或阴影，不显示文字、不占用布局；本地化名称保留在 aria-label/title，点击才展开 PDF/PNG 菜单。进行中原位显示带取消按钮的圆环，成功原位短暂显示勾号；失败通过宿主全局 toast 展示本地化错误，原位保留可重试的错误图标、详细 title/aria 和简短读屏状态，不显示局部长文或错误 pill。菜单支持 Escape 收起并归还焦点、外点（含 iframe）收起；加载未就绪时禁用。控件触控目标至少 36px，支持宿主明暗色变量与减少动画偏好。

错误通知使用 SDK 2.2.0 官方 `ctx.toast.show({ title, description, variant: 'error' })`，标题为本地化简短提示，description 为详细错误。旧宿主缺少 `ctx.toast` 或调用抛出 unsupported 等错误时，兼容降级为错误图标及 title/aria，仍可重试，不恢复局部错误块。取消、abort 和销毁后的迟到失败不触发 toast；已提交的原生 saved 结果仍优先于 abort。

两个包统一使用 Yuri 的独立 GSAPI `yuri.exportPDF` / `yuri.exportLongImage`，通过官方 `Contract.define` / `ctx.use` 获取当前设备的 v1 活动能力。各格式独立显示，全部不可用时隐藏工具栏；本地、远端和 Relay 连接使用相同判断。插件不含 main/Electron 导出代码。iframe 生成保留实时交互状态的自包含 HTML 快照，宿主负责原生 PDF/PNG 生成和保存。

公开结构类型位于 `src/export-types.ts`，token 位于 `src/export-contract.ts`，不跨仓库导入。输入包含 `snapshot: { html, width, height }` 与 `filename`，PDF 支持 A4/Letter；选项包含 `signal` / `onProgress`，结果为 `saved` 或 `cancelled`，失败携带 `EXPORT_*` code。能力撤销/替换时取消对应任务，恢复后继续使用原 iframe。真实阶段及有总量的进度显示见[完整说明](packages/opencode2-plugin/README.md#导出报告)。

### 目录

```text
packages/opencode2-plugin/  通用包入口、技能、样例和发布元数据
packages/opencode2-shadcn/  shadcn 包入口、技能、仪表盘模板和发布元数据
src/                       共享服务端注册、解析、GUI 和隔离 iframe 实现
scripts/                   共享运行时构建、单包构建和打包发布
tests/                     运行时、校验、包契约及浏览器夹具
```

参考 pnpm workspace + Turborepo + Changesets 的多包结构。根包为 private；共享源码在构建时内联进各发布包，npm 用户无需安装本仓库或访问相邻目录。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm test
```

内置运行时依赖版本由根 manifest 和锁文件控制；每个发布包独立维护版本并生成 `dist/runtime-manifest.json`。文件中的 HTTPS URL 决定外部组件版本，更新组件不必新增插件或后缀。更新共享运行时后为受影响的公共包都创建 changeset。

导出回归覆盖两个契约的格式独立、generation 过期、撤销/取消/恢复、失败重试、快照资源及表单状态、进度总量与两个包的无 main 入口。`pnpm build` 同时更新内联运行时和两个包的 GUI 产物；自动测试不代表 Electron/iOS/Android 的原生保存实机验收。

```sh
pnpm changeset
pnpm changeset version
```

GitHub Actions 使用仓库的 `NPM_TOKEN` Secret 发布公共包；后续版本由 `.github/workflows/changesets.yml` 管理，版本变更合入 main 后发布未发布的包并创建各包的 GitHub Release。发布前必须构建、类型检查、测试并验证打包安装。`.github/workflows/release.yml` 仅用于多包迁移的 `v0.2.0` 首次发布及 tarball 上传，该批次标签不表示所有包同版。

## 边界

预览文件支持静态 `eficy` 与 HTTPS ESM/CSS 导入；旧 `shadcn` 裸导入保留兼容。远程模块必须满足 CORS、浏览器 ESM 和共享 React 契约，任意 npm 包并不自动兼容。首次加载需要网络；缓存由浏览器管理，不承诺完整离线可用。源码不发送到 CDN 编译。跨文件本地模块与 Node API 不支持。静态校验不执行代码或获取远程导出，不能代替真实浏览器验收。源码更新重新求值模块，状态不持久化；本地文件链接交给宿主文件标签页。

Eficy 上游参考：[`@eficy/shadcn-ui`](https://www.npmjs.com/package/@eficy/shadcn-ui)。上游 HTTPS 模块不导出 `Recharts`，新文件直接从同一固定 Recharts URL 导入图表及 Tooltip/Legend；旧裸 `shadcn` 的 `ui.Recharts` 属于兼容接口。许可证见 [LICENSE](LICENSE) 和每包 `dist/THIRD-PARTY-NOTICES.txt`。
