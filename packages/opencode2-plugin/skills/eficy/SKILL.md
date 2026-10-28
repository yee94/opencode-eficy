---
name: eficy
description: Create or repair single-file .eficy TSX interactive previews with built-in Eficy signals and shadcn components.
---

# Eficy 单文件交互预览

## 交付步骤

1. 把页面写成一个 `.eficy` 文件：纯 TSX，直接 `export default` 一个 React 组件。所有逻辑、样式类和数据留在这个文件。
2. 仅静态导入内置的 `eficy`、`shadcn`。iframe 已内置真实 Eficy browser、shadcn、React 和样式；组件无需初始化、挂载或安装依赖。
3. 用 `eficy_validate` 传入目标 `path` 与完整 `source`。修正返回的错误，直到 `valid: true`；UTF-8 源码最多 128 KiB。
4. 保存同一份已验证源码到磁盘，返回 `[打开预览](相对路径.eficy)`。点击链接或侧边文件树中的文件，在现有文件标签页内渲染预览。静态校验通过只证明格式与导入边界，交互效果仍需在 GUI 预览中检查。

## 文件边界

默认导出由预览负责挂载。使用 `className` 的 Tailwind/UnoCSS 工具类和 `shadcn` 组件。文件不是 HTML 模板：不写文档标签、`script` 标签、CDN、import map、`initEficy` 或 `render`。仅使用上述两个内置 import；相对文件、其他 npm 包、动态 import、`require`、`loadModule` 均不支持。React 由运行时提供，不导入 React，也不写 React Hooks。

预览是隔离 iframe 中执行的代码，不是任意 Node/宿主 API 执行环境。使用本地示例数据；不要依赖外网请求、父页面 DOM、宿主 SDK 或跨文件资源。验证器只解析文本，不执行源码，不做 TypeScript 类型检查，也不证明导出值一定是可渲染组件。

## 文件链接

用 `<a href="/workspace/页面 文件.eficy">打开页面</a>` 提供文件跳转。也可使用正确编码的 `file://` URL；相对链接以当前文件所在目录为基准。点击交给宿主文件标签页，再由对应插件渲染，不用 `window.location` 或 `window.open` 导航预览 iframe。`#section` 保留为当前页面锚点。链接目标须是当前服务可访问的真实文件；文件链接不等于跨文件 JS import。

## Signals 模式

- 在模块级声明原子 `signal`；派生值用 `computed`，事件直接更新 `.value`。
- 自定义响应式组件用 `component()` 包裹。文本和基本类型 props 可直接传 Signal；对象 Signal 读取具体字段。
- 输入使用 `bind`。数字输入保留字符串中间态，在 `computed` 中转换。
- 数组、对象用新引用赋值；多个关联更新可用 `batch`。
- 必需的副作用用 `effect`，避免在同一 effect 中订阅又更新同一个 Signal；不需订阅的读取用 `peek`。
- 图标通过 `shadcnUi.Lucide` 获取。

```tsx
import { signal, computed, component, bind } from 'eficy';
import * as shadcnUi from 'shadcn';

const { Button, Input, Card, CardContent } = shadcnUi;
const { Plus } = shadcnUi.Lucide;
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

以下信息由插件从构建产物 `dist/runtime-manifest.json` 注入；它是可用版本的依据。更新依赖后须重构运行时并随插件一起发布，生成文件不写版本 URL。

{{RUNTIME_VERSIONS}}
