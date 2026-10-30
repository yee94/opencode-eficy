export const loadingSVG = '<svg viewBox="0 0 216 176" fill="none" aria-hidden="true"><rect x="42" y="12" width="132" height="152" rx="12" stroke="currentColor" stroke-opacity=".18" stroke-width="2"/><path d="M62 42h38M62 54h70" stroke="currentColor" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/><g class="eficy-loading-lines"><rect x="62" y="76" width="36" height="28" rx="4" fill="currentColor" fill-opacity=".16"/><rect x="108" y="76" width="46" height="28" rx="4" fill="currentColor" fill-opacity=".1"/><path d="M62 126h92M62 140h60" stroke="currentColor" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/></g></svg>';

export const errorSVG = '<svg viewBox="0 0 240 160" fill="none" aria-hidden="true"><rect x="24" y="16" width="192" height="128" rx="14" fill="var(--surface-muted, currentColor)" fill-opacity=".08"/><rect x="40" y="32" width="160" height="96" rx="8" stroke="currentColor" stroke-opacity=".3" stroke-dasharray="4 5"/><circle cx="86" cy="62" r="10" fill="currentColor" opacity=".15"/><path d="m52 116 42-39 26 24 25-31 43 46" stroke="currentColor" stroke-opacity=".3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="177" cy="119" r="21" fill="var(--surface-elevated, Canvas)" stroke="var(--interactive-border, currentColor)" stroke-opacity=".3"/><path d="M177 109v12m0 6v1" stroke="var(--status-error, currentColor)" stroke-width="2.5" stroke-linecap="round"/></svg>';

export const defaultErrorText = {
  title: '无法显示预览', retry: '重试',
  frameBoundary: '文件中包含 HTML 文档标签或脚本。Eficy 需要 TSX 组件：请移除 <html>、<head>、<body> 和 <script>，并保留 export default。',
};

export const previewStateStyles = (selector: string) => `
${selector}{position:fixed;inset:0;box-sizing:border-box;min-height:240px;overflow:hidden;text-align:center;background:var(--surface-background,Canvas);color:var(--text-primary,CanvasText);font-family:system-ui,sans-serif}
${selector} .eficy-state-illustration{position:absolute;left:24px;right:24px;top:calc(50% - 64px);height:80px;transform:translateY(-50%);display:flex;align-items:center;justify-content:center}
${selector} .eficy-state-illustration svg{width:120px;height:80px;max-width:100%;flex-shrink:0;color:var(--text-muted,CanvasText)}
${selector} .eficy-state-copy{position:absolute;left:24px;right:24px;top:calc(50% - 4px);bottom:16px;overflow:auto;overscroll-behavior:contain}
${selector} .eficy-state-content{max-width:384px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:12px;padding-bottom:8px}
${selector} .eficy-loading-title{margin:0;font-size:16px;font-weight:600;line-height:1.5}
${selector} .eficy-loading-detail{margin:0;max-width:100%;font:14px/1.7 system-ui,sans-serif;white-space:pre-wrap;overflow-wrap:anywhere;opacity:.65}
${selector} button{min-height:36px;padding:6px 14px;border:0;border-radius:6px;background:var(--text-primary,CanvasText);color:var(--surface-background,Canvas);font:500 13px/1.5 system-ui,sans-serif;cursor:pointer}
${selector} button:hover{opacity:.85}
${selector} button:focus-visible{outline:2px solid currentColor;outline-offset:3px}
${selector}[hidden]{display:none!important}`;

export const loadingStyles = (selector: string) => `
${previewStateStyles(selector)}
${selector} .eficy-loading-lines{animation:eficy-page-reveal 2.4s ease-in-out infinite;transform-origin:center}
@keyframes eficy-page-reveal{0%,100%{opacity:.3;transform:translateY(3px)}50%{opacity:.85;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){${selector} .eficy-loading-lines{animation:none}}
${selector}[hidden]{display:none!important}`;
