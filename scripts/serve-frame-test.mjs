import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';

const root = new URL('../', import.meta.url);
const bundle = await build({ entryPoints: [new URL('src/frame.ts', root).pathname], bundle: true, write: false, format: 'esm', platform: 'browser' });
const html = await readFile(new URL('tests/browser.html', root));
const server = createServer((request, response) => {
  if (request.url === '/frame.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle.outputFiles[0].contents);
  } else if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end(html);
  } else { response.writeHead(404).end(); }
});
server.listen(0, '127.0.0.1', () => console.log(`Frame test fixture: http://127.0.0.1:${server.address().port}`));
process.on('SIGTERM', () => server.close());
