export const loadingSVG = '<svg viewBox="0 0 216 176" fill="none" aria-hidden="true"><rect x="42" y="12" width="132" height="152" rx="12" stroke="currentColor" stroke-opacity=".18" stroke-width="2"/><path d="M62 42h38M62 54h70" stroke="currentColor" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/><g class="eficy-loading-lines"><rect x="62" y="76" width="36" height="28" rx="4" fill="currentColor" fill-opacity=".16"/><rect x="108" y="76" width="46" height="28" rx="4" fill="currentColor" fill-opacity=".1"/><path d="M62 126h92M62 140h60" stroke="currentColor" stroke-opacity=".4" stroke-width="4" stroke-linecap="round"/></g></svg>';

export const loadingStyles = (selector: string) => `
${selector}{position:fixed;inset:0;overflow:auto;box-sizing:border-box;min-height:100vh;padding:32px 24px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:12px}
${selector} svg{width:clamp(144px,28vw,216px);height:auto;margin-bottom:12px;color:inherit}
${selector} .eficy-loading-title{margin:0;font-size:18px;font-weight:600;line-height:1.5}
${selector} .eficy-loading-detail{margin:0;max-width:32em;font-size:14px;line-height:1.7;opacity:.65}
${selector} .eficy-loading-lines{animation:eficy-page-reveal 2.4s ease-in-out infinite;transform-origin:center}
@keyframes eficy-page-reveal{0%,100%{opacity:.3;transform:translateY(3px)}50%{opacity:.85;transform:translateY(0)}}
@media(prefers-reduced-motion:reduce){${selector} .eficy-loading-lines{animation:none}}
${selector}[hidden]{display:none!important}`;
