# Eficy plugins for OpenCode 2

同一个仓库维护多个独立发布的 OpenCode 2 插件。每个包包含服务端 skill/tool 和标准 `./gui-experimental` 单文件 GUI，安装其中一个包即可使用对应能力，不依赖其他插件包。

| npm 包 | 文件后缀 | 用途 |
| --- | --- | --- |
| [`@eficy/opencode2-plugin`](packages/opencode2-plugin/README.md) | `.eficy` | 通用交互式 TSX 预览 |
| [`@eficy/opencode2-shadcn`](packages/opencode2-shadcn/README.md) | `.shadcn.eficy` | 通用 Eficy + shadcn GUI 与生成技能；内置暗色数据分析报告场景 |

## 安装

将需要的包加入连接服务的全局 `opencode.jsonc` 的 `plugins`，保留已有配置：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "@eficy/opencode2-plugin@0.2.0",
    "@eficy/opencode2-shadcn@0.1.1"
  ]
}
```

可只安装 shadcn 包。两个包同时安装时，shadcn 专用后缀由优先级更高的处理器接管。终端可使用技能和工具；显示预览需要支持实验性 GUI 插件接口的宿主。SDK 固定为 `@opencode/plugin` 2.2.0。

## 一次生成数据分析报告

> 使用 eficy-shadcn 技能，生成一份 SaaS 收入分析报告：先给结论，再展示关键指标、趋势和渠道构成，注明统计口径；暗色、最大宽度 600px 居中，支持日期筛选，使用演示数据。校验后保存 report.shadcn.eficy 并返回预览链接。

shadcn 包提供 `eficy_shadcn_template` 完整模板与 `eficy_shadcn_validate` 校验器；模板中的筛选、导航、搜索会真实更新页面。源码、数据、状态在一个文件中，React/Eficy/shadcn/Lucide/Recharts 都在插件内置，不使用 CDN。

## 开发结构

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

运行时依赖版本由根 manifest 和锁文件控制；每个发布包独立维护版本，构建将它和真实运行时版本写入自己的 `dist/runtime-manifest.json`，技能从该文件注入版本。更新共享运行时后为受影响的公共包都创建 changeset。

```sh
pnpm changeset
pnpm changeset version
```

GitHub Actions 使用仓库的 `NPM_TOKEN` Secret 发布公共包并上传 tarball；详见 `.github/workflows/release.yml`。发布前必须构建、类型检查、测试并验证打包安装。`v0.2.0` 是本次多包迁移的发布批次标签，不表示所有包同版。

## 边界

预览文件不是任意前端工程：仅静态导入内置 `eficy`/`shadcn`，不支持网络请求、跨文件 import 或 Node API。静态校验不执行代码，也不代替真实浏览器交互验证。文件源码更新会重新求值模块；预览状态不持久化。绝对路径链接交给宿主文件标签页处理。

Eficy 上游参考：[`@eficy/shadcn-ui`](https://www.npmjs.com/package/@eficy/shadcn-ui)。本仓库额外暴露 `shadcn.Recharts`，并将 Tooltip/Legend 与图表原语统一到同一 Recharts 实例。许可证见 [LICENSE](LICENSE) 和每包 `dist/THIRD-PARTY-NOTICES.txt`。
