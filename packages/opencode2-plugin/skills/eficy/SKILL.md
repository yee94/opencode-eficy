---
name: eficy
description: Create or repair .eficy interactive pages, forms, tools and reports using Eficy Signals and HTTPS imports for component libraries, icons and charts.
---

# Eficy 单文件交互预览

## 交付步骤

1. 把页面写成一个 `.eficy` 文件：纯 TSX，直接 `export default` 一个 React 组件。所有逻辑、样式类和数据留在这个文件。
2. 从内置 `eficy` 导入 Signals；组件、图标、图表使用固定版本 HTTPS ESM 地址，CSS 使用 HTTPS 侧效 import。需要 shadcn 或报告时读 [组件与图表](references/shadcn.md)。渲染器与 React 由插件管理，无需新插件或其他后缀。
3. 用 `eficy_validate` 传入目标 `path` 与完整 `source`。修正返回的错误，直到 `valid: true`；UTF-8 源码最多 128 KiB。
4. 保存同一份已验证源码到磁盘，返回 `[打开预览](相对路径.eficy)`。点击链接或侧边文件树中的文件，在现有文件标签页内渲染预览。静态校验通过只证明格式与导入边界，交互效果仍需在 GUI 预览中检查。

## 文件边界

默认导出由预览负责挂载。使用 `className` 的 Tailwind/UnoCSS 工具类；外部组件样式显式导入。文件是 TSX 组件，不写文档标签、`script`、import map、`initEficy` 或 `render`。支持静态 `eficy` 与 HTTPS 模块导入；相对模块、未映射的 npm 包名、动态 import、`require`、`loadModule` 不支持。业务状态使用 Signals。

预览在隔离 iframe 中执行，HTTPS 依赖由当前客户端直接加载。首次加载需要网络与 CDN 的 CORS 支持；源码仍在本机编译。依赖不可用时修正地址或重试，不改文件后缀。验证器只解析文本，不执行源码、不获取远程模块、不验证它们的真实导出，也不代替浏览器验收。父页面 DOM、宿主 SDK 和 Node API 不可用。

## 文件链接

用 `<a href="/workspace/页面 文件.eficy">打开页面</a>` 提供文件跳转。也可使用正确编码的 `file://` URL；相对链接以当前文件所在目录为基准。点击交给宿主文件标签页，再由对应插件渲染，不用 `window.location` 或 `window.open` 导航预览 iframe。`#section` 保留为当前页面锚点。链接目标须是当前服务可访问的真实文件；文件链接不等于跨文件 JS import。

## Signals 模式

- 在模块级声明原子 `signal`；派生值用 `computed`，事件直接更新 `.value`。
- 自定义响应式组件用 `component()` 包裹。文本和基本类型 props 可直接传 Signal；对象 Signal 读取具体字段。
- 输入使用 `bind`。数字输入保留字符串中间态，在 `computed` 中转换。
- 数组、对象用新引用赋值；多个关联更新可用 `batch`。
- 必需的副作用用 `effect`，避免在同一 effect 中订阅又更新同一个 Signal；不需订阅的读取用 `peek`。
- 图标使用 HTTPS 图标库；React 库保留 `react` external，复用预览的单实例 React。

```tsx
import { signal, computed, component, bind } from 'eficy';
import { Button, Input, Card, CardContent } from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
import 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.css';
import { Plus } from 'https://esm.sh/lucide-react@0.468.0?external=react';
const name = signal('Ada');
const count = signal(0);
const doubled = computed(() => count.value * 2);

const App = component(() => (
  <main className="p-6 space-y-4">
    <h1 className="text-2xl font-bold">欢迎，{name}</h1>
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Input {...bind(name)} aria-label="姓名" />
        <Button onClick={() => { count.value += 1; }}>
          <Plus className="mr-2 h-4 w-4" />计数 {count} · 双倍 {doubled}
        </Button>
      </CardContent>
    </Card>
  </main>
));

export default App;
```

源文件内容变化会重新求值模块，模块级 Signal 状态可能重置；相同内容不应触发重载。把需要持久保存的数据写入明确的数据模型，不能把预览状态当成持久存储。

## 当前包内运行时

以下信息由插件从构建产物 `dist/runtime-manifest.json` 注入。内置 Eficy/React 随插件版本更新；远程组件由文件中的固定版本 URL 决定。已有 `import ... from 'shadcn'` 为旧文件兼容入口，新文件按上述 HTTPS 写法生成。所有文件只识别最后一层 `.eficy`。

{{RUNTIME_VERSIONS}}
