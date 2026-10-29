import { readFile, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { parseEficy } from '../src/parser';
import { previewDocument } from '../src/frame-document';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { title: { type: 'string' }, theme: { type: 'string', default: 'dark' } },
  });
  const [input, output] = positionals;
  if (positionals.length !== 2 || !input || !output) throw new Error('Usage: node export-html.mjs input.eficy output.html [--title title] [--theme dark|light]');
  if (values.theme !== 'dark' && values.theme !== 'light') throw new Error('Theme must be dark or light.');
  if (extname(output).toLowerCase() !== '.html' || resolve(input) === resolve(output)) throw new Error('Output must be a separate .html file.');
  const source = await readFile(input, 'utf8');
  parseEficy(input, source);
  const html = previewDocument({ source, theme: values.theme, title: values.title ?? basename(input, extname(input)) });
  await writeFile(output, html, 'utf8');
  console.log(resolve(output));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
