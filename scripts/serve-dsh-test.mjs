import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundle = await build({
  entryPoints: [resolve(root, 'tests/fixtures/dsh-browser.ts')],
  bundle: true, write: false, format: 'esm', platform: 'browser',
  define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.css': 'text' },
  plugins: [{ name: 'inline-css', setup(build) {
    build.onResolve({ filter: /\.css\?inline$/ }, args => ({ path: resolve(args.resolveDir, args.path.replace(/\?inline$/, '')) }));
  } }],
});
const server = createServer((request, response) => {
  if (request.url === '/fixture.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(bundle.outputFiles[0].contents);
  } else if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><meta charset="utf-8"><title>DSH Eficy browser fixture</title><div id="preview" style="position:relative;height:95vh;display:flex"></div><script type="module" src="/fixture.js"></script>');
  } else response.writeHead(404).end();
});
server.listen(0, '127.0.0.1', () => console.log(`DSH test fixture: http://127.0.0.1:${server.address().port}`));
process.on('SIGTERM', () => server.close());
