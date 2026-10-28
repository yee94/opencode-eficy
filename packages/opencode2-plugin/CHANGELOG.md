# @eficy/opencode2-plugin

## 0.3.0

### Minor Changes

- Support static HTTPS ESM and CSS imports in a single `.eficy` preview. Keep React/Eficy bundled and share their React instance with remote components, icons, and charts; compile user source locally.

  Use the same renderer for both packages and retain legacy `shadcn` imports, skills, tools, and `.shadcn.eficy` files. New installations only need `@eficy/opencode2-plugin`.

  Load external assets on demand with recoverable errors and retry, cancel stale stylesheet loads, and update skills and samples to pinned HTTPS URLs. External components now require network access and CORS support on first load; browser caching does not guarantee offline availability.

## 0.2.1

### Patch Changes

- 3468111: Keep preview link handlers limited to local files, distinguish GUI icon IDs and mobile labels between plugins, and document standalone/coinstalled routing and persisted-tab behavior.

## 0.2.0

- 迁入 pnpm/Turbo/Changesets 多包工作区，独立构建与发布。
- 服务端改为打包入口，保留技能、校验和标准 GUI 预览。
- 图表运行时新增 Recharts namespace，与 shadcn 专用插件兼容共存。
