import { afterEach, expect, it, vi } from 'vitest';
import { toSvg } from 'html-to-image';
import { captureSnapshot } from '../src/export-snapshot';

vi.mock('html-to-image', () => ({ toSvg: vi.fn() }));
const encoded = (content: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">${content}</div></foreignObject></svg>`)}`;
function setup(content = '') {
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
  const root = document.createElement('div');
  root.innerHTML = content;
  document.body.append(root);
  Object.defineProperty(root, 'scrollWidth', { value: 600 });
  Object.defineProperty(root, 'scrollHeight', { value: 1200 });
  document.body.style.backgroundColor = 'rgb(10, 20, 30)';
  return root;
}
afterEach(() => {
  document.body.replaceChildren();
  document.body.removeAttribute('style');
  Reflect.deleteProperty(document, 'fonts');
  vi.resetAllMocks();
});

it('unwraps the embedded snapshot into HTML while preserving resources and serialized live controls', async () => {
  const root = setup('<input type="checkbox" checked/><textarea>old</textarea><select multiple><optgroup><option value="a" selected>A</option><option value="b">B</option></optgroup></select><details open>expanded</details><canvas/>');
  root.querySelector('input')!.checked = false;
  root.querySelector('textarea')!.value = '<current & safe>';
  const options = root.querySelectorAll('option');
  options[0].selected = false;
  options[1].selected = true;
  const font = '<style>@font-face{font-family:Report;src:url(data:font/woff2;base64,YQ==)}</style>';
  const image = '<img src="data:image/png;base64,Yg==" style="width:60px" />';
  vi.mocked(toSvg).mockResolvedValue(encoded(`${font}<input type="checkbox" checked=""/><textarea>old</textarea><select multiple=""><optgroup><option selected="">A</option><option>B</option></optgroup></select><details open="">expanded</details>${image}<a href="https://example.com" onclick="alert(1)">link</a>`));
  const progress = vi.fn();
  const before = root.innerHTML;
  const snapshot = await captureSnapshot(root, progress, new AbortController().signal);
  expect(snapshot).toMatchObject({ width: 600, height: 1200 });
  expect(snapshot.html).not.toContain('foreignObject');
  const html = new DOMParser().parseFromString(snapshot.html, 'text/html');
  expect(html.querySelector('style')!.textContent).toContain('data:font/woff2');
  expect(html.querySelector('img')!.getAttribute('src')).toBe('data:image/png;base64,Yg==');
  expect(html.querySelector('img')!.style.width).toBe('60px');
  expect(html.querySelector('input')!.hasAttribute('checked')).toBe(false);
  expect(html.querySelector('textarea')!.textContent).toBe('<current & safe>');
  expect([...html.querySelectorAll('option')].map(option => option.hasAttribute('selected'))).toEqual([false, true]);
  expect(html.querySelector('details')!.hasAttribute('open')).toBe(true);
  expect(html.querySelector('a')!.hasAttribute('href')).toBe(false);
  expect(html.querySelector('a')!.hasAttribute('onclick')).toBe(false);
  expect(root.innerHTML).toBe(before);
  expect(root.querySelector('textarea')!.value).toBe('<current & safe>');
  expect(progress.mock.calls.map(([value]) => value.stage)).toEqual(['preparing', 'capturing']);
});

it('cancels a resource wait without changing the live preview and supports a fresh retry', async () => {
  const root = setup('<button>interactive</button>');
  let release!: (value: string) => void;
  vi.mocked(toSvg).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const controller = new AbortController();
  const work = captureSnapshot(root, vi.fn(), controller.signal);
  const assertion = expect(work).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(toSvg).toHaveBeenCalledOnce());
  controller.abort();
  await assertion;
  release(encoded('<div>stale</div>'));
  expect(root.textContent).toBe('interactive');
  vi.mocked(toSvg).mockResolvedValueOnce(encoded('<button>interactive</button>'));
  await expect(captureSnapshot(root, vi.fn(), new AbortController().signal)).resolves.toMatchObject({ width: 600, height: 1200 });
});

it('rejects failed resource embeds instead of exporting a partial report', async () => {
  const root = setup();
  vi.mocked(toSvg).mockResolvedValue(encoded('<img src="data:application/x-eficy-missing;base64,"/>'));
  await expect(captureSnapshot(root, vi.fn(), new AbortController().signal)).rejects.toThrow('could not be embedded');
});
