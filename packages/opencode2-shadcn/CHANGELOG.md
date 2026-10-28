# @eficy/opencode2-shadcn

## 0.2.0

### Minor Changes

- Support static HTTPS ESM and CSS imports in a single `.eficy` preview. Keep React/Eficy bundled and share their React instance with remote components, icons, and charts; compile user source locally.

  Use the same renderer for both packages and retain legacy `shadcn` imports, skills, tools, and `.shadcn.eficy` files. New installations only need `@eficy/opencode2-plugin`.

  Load external assets on demand with recoverable errors and retry, cancel stale stylesheet loads, and update skills and samples to pinned HTTPS URLs. External components now require network access and CORS support on first load; browser caching does not guarantee offline availability.

## 0.1.3

### Patch Changes

- Register the final `eficy` extension for file icons instead of the compound preview suffix. Fixes Yuri rejecting GUI setup with "Invalid GUI file icon extension" while preserving `.shadcn.eficy` preview routing.

## 0.1.2

### Patch Changes

- 3468111: Keep preview link handlers limited to local files, distinguish GUI icon IDs and mobile labels between plugins, and document standalone/coinstalled routing and persisted-tab behavior.

## 0.1.1

### Patch Changes

- Make the injected skill a general Eficy + shadcn rendering guide for pages, forms, tools and reports. Load compact dark report guidance only for data-analysis requests.

## 0.1.0

- 新增独立 shadcn 预览插件、生成技能、校验器和完整报告模板。
- 默认暗色阅读主题，400–600px 紧凑布局，结论、指标与图表随筛选同步更新。
- 内置 Eficy、shadcn、Lucide 和 Recharts，无 CDN 依赖。
