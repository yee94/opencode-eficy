// @vitest-environment node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EficyValidationError, MAX_SOURCE_BYTES, parseEficy } from '../src/parser';

const valid = `import { signal, component } from 'eficy';
import * as ui from 'shadcn';
const count = signal<number>(0);
export default component(() => <ui.Button onClick={() => count.value++}>{count}</ui.Button>);`;

function errorCode(source: string, path = 'demo.eficy') {
  try { parseEficy(path, source); } catch (error) {
    expect(error).toBeInstanceOf(EficyValidationError);
    return (error as EficyValidationError).code;
  }
  throw new Error('Expected validation failure');
}

describe('single-file TSX parser', () => {
  it('parses typed JSX and the built-in imports without evaluating any code', () => {
    expect(parseEficy('/a/nonexistent/demo.eficy', valid)).toMatchObject({ source: valid, imports: ['eficy', 'shadcn'] });
    expect(() => parseEficy('demo.eficy', `throw new Error('must not execute'); export default () => <div />;`)).not.toThrow();
  });

  it('accepts the actual skill example', () => {
    const skill = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../packages/opencode2-plugin/skills/eficy/SKILL.md'), 'utf8');
    const example = skill.match(/```tsx\n([\s\S]*?)\n```/)?.[1];
    expect(example).toBeTruthy();
    expect(() => parseEficy('example.eficy', example!)).not.toThrow();
  });

  it.each([
    `export default () => <div>`,
    `export default () => { const x: = 1; return <div />; };`,
    `export default () => <div>{a + }</div>;`,
    `export default function ( {`,
  ])('reports real syntax failures: %s', (source) => {
    expect(errorCode(source)).toBe('syntax');
  });

  it('does not mistake comments, strings or JSX text for module syntax', () => {
    expect(errorCode(`// export default () => <div />\nconst s = 'export default';`)).toBe('default-export');
    expect(() => parseEficy('demo.eficy', `/* import x from 'https://example.invalid/x' */
const text = "import('remote'); </script>";
export default () => <p>import from 'remote' {text}</p>;`)).not.toThrow();
  });

  it.each([
    `const text = "import type { X } from './types';";`,
    "const text = `import type { X } from './types'; import('remote');`;",
    "const text = `import('remote') ${'display only'} import.meta.url`;",
    `type Text = "import type { X } from './types'"; const text: Text = "import type { X } from './types'";`,
  ])('keeps import-like string and template content inert: %s', (prefix) => {
    expect(parseEficy('demo.eficy', `${prefix}\nexport default () => <p>{text}</p>;`).imports).toEqual([]);
  });

  it('checks real imports inside template expressions', () => {
    expect(errorCode("const text = `value: ${import('remote')}`; export default () => <p>{text}</p>;")).toBe('import');
  });

  it('allows a built-in type import while retaining the module allowlist', () => {
    expect(parseEficy('demo.eficy', `import type { Button } from 'shadcn'; export default () => <div />;`).imports).toEqual(['shadcn']);
  });

  it.each([
    `import x from './local';`,
    `import x from 'https://example.invalid/x';`,
    `import x from 'react';`,
    `import 'data:text/javascript,alert(1)';`,
    `import type { X } from '../types';`,
    `const x = import('eficy');`,
    `const x = import.meta.url;`,
    `const x = require('eficy');`,
    `import { loadModule as load } from 'eficy';`,
  ])('rejects unavailable module mechanisms: %s', (prefix) => {
    expect(errorCode(`${prefix}\nexport default () => <div />;`)).toBe('import');
  });

  it('requires the direct default component export', () => {
    expect(errorCode('const App = () => <div />;')).toBe('default-export');
    expect(errorCode(`export { default } from './other';`)).toBe('default-export');
    expect(errorCode(`export const App = () => <div />;`)).toBe('default-export');
  });

  it('reports missing text and wrong extension explicitly', () => {
    expect(errorCode('  ')).toBe('missing');
    expect(errorCode(valid, '')).toBe('missing');
    expect(errorCode(valid, 'demo.tsx')).toBe('path');
  });

  it('measures the 128 KiB boundary in UTF-8 bytes', () => {
    const prefix = 'export default () => <div />; //';
    const exact = prefix + 'a'.repeat(MAX_SOURCE_BYTES - Buffer.byteLength(prefix));
    expect(parseEficy('limit.eficy', exact).bytes).toBe(MAX_SOURCE_BYTES);
    expect(errorCode(exact + 'a')).toBe('oversize');
    expect(errorCode(prefix + '中'.repeat(Math.ceil(MAX_SOURCE_BYTES / 3)))).toBe('oversize');
  });

  it.each(['script', 'html', 'head', 'body'])('keeps %s ownership in the frame', (tag) => {
    expect(errorCode(`export default () => <${tag} />;`)).toBe('frame-boundary');
  });
});
