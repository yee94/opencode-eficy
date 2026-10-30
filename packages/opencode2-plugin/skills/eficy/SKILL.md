---
name: eficy
description: 创建或修复 .eficy 交互页面、分析报告、看板和图表，默认 shadcn 暗色主题，保存后交付预览链接。简单查找、列举、问答直接回复；用户指定格式时遵循要求。
---

# Eficy + shadcn 单文件交互预览

## 交付

页面、分析报告、看板和图表默认交付 `.eficy`。简单查找、列举、问答直接回复，不额外生成页面；用户指定格式时遵循要求。

1. 编写一个完整 TSX 文件，直接 `export default` React 组件；数据和逻辑留在文件内，UTF-8 最多 128 KiB。模块级 `signal` 保存状态，`computed` 派生数据，读取 `.value` 的组件用 `component()` 包裹，事件更新 `.value`。
2. 保存为 `.eficy`，返回 `[打开预览](相对路径.eficy)`，即完成交付。默认不调用校验工具或浏览器，也不截图。

默认 shadcn 暗色语义主题，使用 `className` 工具类并显式导入 CSS。报告先结论后证据，默认 400–600px 居中阅读布局；普通页面按用途自适应，用户指定风格和宽度优先。只添加任务需要的交互。

## 最小起点

```tsx
import { signal, computed, component, bind } from 'eficy';
import { Button, Input, Card, CardContent } from 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.js';
import 'https://cdn.jsdelivr.net/npm/@eficy/shadcn-ui@1.1.3/dist/index.css';
const name = signal('Ada');
const count = signal(0);
const doubled = computed(() => count.value * 2);

const App = component(() => (
  <main className="bg-background text-foreground p-6 space-y-4">
    <h1 className="text-2xl font-bold">欢迎，{name}</h1>
    <Card>
      <CardContent className="pt-6 space-y-4">
        <Input {...bind(name)} aria-label="姓名" />
        <Button onClick={() => { count.value += 1; }}>
          计数 {count} · 双倍 {doubled}
        </Button>
      </CardContent>
    </Card>
  </main>
));

export default App;
```

## 按需校验

仅在用户要求验证或出现具体报错时检查。`eficy_validate({ path, source })` 的 `source` 是完整 TSX，不是路径、JSON 包装或片段；工具不会读取文件。工具返回 JSON 字符串，在代码中使用时先 `JSON.parse`。

valid: true 即停止校验，保存并交付同一份源码。失败按 `code` / `error` 定位，最多修复并复验一次；仍失败就保留文件并说明阻塞，不靠删除内容、反复重写或拆片探测凑通过。静态通过不代表交互验收；依赖或渲染错误按具体问题排查。

## 按需参考

- 图标、图表或其他 HTTPS 组件：[固定版本导入](references/shadcn.md)。
- 复杂组件组合、Signals 进阶及页面内文件链接：[组件与交互](references/components.md)。
- 分析报告：[报告规范](references/reports.md)，含可选模板及取用方法；实际数据替换演示数据，或明确标注。
- 用户要求导出 HTML：[HTML 导出](references/export.md)，直接交付独立 `.html`，独立使用本 skill 时同样适用。

## 运行边界

宿主管理 React 单实例和 iframe 挂载。文件仅使用静态 `eficy` 或固定版本 HTTPS ESM/CSS 导入；不支持相对模块、未映射 npm 包名、动态 import、`require`、`loadModule`，不写 HTML 文档标签、`script` 或自行挂载。HTTPS 依赖需网络与 CORS；父页面 DOM、宿主 SDK 和 Node API 不可用。源码更新可能重置模块状态，预览状态不是持久数据。

## 当前包内运行时

由构建产物注入。旧 `shadcn` 导入仅供兼容，新文件使用 HTTPS 导入；只识别最后一层 `.eficy`。

{{RUNTIME_VERSIONS}}
