# @eficy/opencode2-plugin

## 0.4.3

### Patch Changes

- Load chart primitives from the single-file @eficy/charts browser bundle instead of the Recharts CDN dependency graph. Preserve the shared React runtime and matching Tooltip/Legend instances, including existing ui.Recharts reports.

## 0.4.2

### Patch Changes

- Report export failures through the host's official global toast API instead of a local error banner. Older hosts retain an accessible error icon and retry behavior. Deduplicate identical snapshot styles to reduce export payload size while preserving report content and computed styles.

## 0.4.1

### Patch Changes

- Replace the full-width export toolbar with a subtle, translucent icon button floating at the preview's top-right. Open format choices on demand, show circular progress with cancellation, and use a brief success checkmark. Preserve capability detection and accessible error feedback without shifting report content.

## 0.4.0

### Minor Changes

- Add PDF and full-page PNG export through the independent Yuri client GSAPIs, with self-contained live-view HTML snapshots, per-format capability lifetimes, native progress and cancellation. Both packages use window contracts without plugin main/Electron code.

  Keep the centered SVG loading indicator visible through file reads, runtime startup, dependency loading and content commit, with explicit errors and retry. Preserve legacy shadcn Recharts namespaces and interactive report state.

  Export requires a Yuri client providing `yuri.exportPDF` or `yuri.exportLongImage`. Older clients and unsupported containers retain previews and hide unavailable export actions.

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
