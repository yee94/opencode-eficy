import { mountPreview } from '../../packages/dsh-plugin/src/preview';
import { exportMessages } from '../../src/export-toolbar';
import styles from '../../src/export-toolbar.css?inline';

const style = document.createElement('style');
style.textContent = styles + '.eficy-export-toolbar{position:absolute;right:12px;top:12px;z-index:2}';
document.head.append(style);
const root = document.getElementById('preview')!;
const view = mountPreview(root, {
  filename: 'dsh-interactive.eficy',
  t: (key, params) => {
    let value = exportMessages.en[key as keyof typeof exportMessages.en] || key;
    for (const [name, replacement] of Object.entries(params || {})) value = value.replace(`{{${name}}}`, String(replacement));
    return value;
  },
  source: `import { signal, component } from 'eficy';
const count = signal(0);
export default component(() => <main style={{padding: 32, background: '#102035', color: '#ffffff', minHeight: 1200}}>
  <h1>DSH Eficy export check</h1>
  <button onClick={() => count.value++}>Count: {count.value}</button>
  <input defaultValue="retained input" aria-label="Note" />
  <p>Current filter: {count.value}</p>
</main>);`,
});
Object.assign(window, { dshPreview: view });
