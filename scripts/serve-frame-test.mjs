import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('../', import.meta.url);
const bundle = await build({ entryPoints: [new URL('src/frame.ts', root).pathname], bundle: true, write: false, format: 'esm', platform: 'browser' });
const html = await readFile(new URL('tests/browser.html', root));
const samples = Object.fromEntries(['analytics', 'operations'].map(name => [name,
  new URL(`packages/opencode2-shadcn/samples/${name}.shadcn.eficy`, root),
]));
if (process.env.EFICY_TEST_SOURCE) {
  if (!isAbsolute(process.env.EFICY_TEST_SOURCE)) throw new Error('EFICY_TEST_SOURCE must be an absolute file path.');
  samples.custom = pathToFileURL(process.env.EFICY_TEST_SOURCE);
}
const server = createServer((request, response) => {
  if (request.url === '/frame.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle.outputFiles[0].contents);
  } else if (Object.hasOwn(samples, request.url?.slice('/sample/'.length) ?? '') && request.url?.startsWith('/sample/')) {
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    void readFile(samples[request.url.slice('/sample/'.length)]).then(content => response.end(content), () => response.writeHead(404).end());
  } else if (request.url === '/' || request.url?.startsWith('/?')) {
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  } else { response.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1', () => console.log(`Frame test fixture: http://127.0.0.1:${server.address().port}`));
process.on('SIGTERM', () => server.close());
