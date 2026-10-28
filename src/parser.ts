import { transform } from 'sucrase';
// Sucrase's pinned parser supplies syntactic tokens, including JSX and type context.
// Its runtime subpath has no adjacent declarations; use its shipped declaration type.
// @ts-expect-error Sucrase ships declarations under dist/types rather than dist/parser.
import { parse as parseTokens } from 'sucrase/dist/parser/index.js';
// @ts-expect-error Sucrase ships declarations under dist/types rather than dist/parser.
import { TokenType } from 'sucrase/dist/parser/tokenizer/types.js';
import type { File } from 'sucrase/dist/types/parser/index';

export const MAX_SOURCE_BYTES = 128 * 1024;
export const BUILTIN_IMPORTS = ['eficy', 'shadcn'] as const;
export type ValidationCode = 'missing' | 'path' | 'oversize' | 'syntax' | 'default-export' | 'import' | 'frame-boundary';

export class EficyValidationError extends Error {
  constructor(public readonly code: ValidationCode, message: string) {
    super(message);
    this.name = 'EficyValidationError';
  }
}

/** Parse only: never evaluate source, resolve imports, or read the supplied path. */
export function parseEficy(path: string, source: string) {
  if (typeof path !== 'string' || !path.trim() || typeof source !== 'string' || !source.trim()) {
    throw new EficyValidationError('missing', 'Expected a non-empty path and complete TSX source.');
  }
  if (!path.endsWith('.eficy')) throw new EficyValidationError('path', 'Expected a .eficy file path.');
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes > MAX_SOURCE_BYTES) throw new EficyValidationError('oversize', 'Source exceeds the 128 KiB UTF-8 limit.');

  let file: File;
  try {
    file = parseTokens(source, true, true, false) as File;
    transform(source, { transforms: ['typescript', 'jsx', 'imports'], jsxRuntime: 'classic', production: true, filePath: path });
  } catch (error) {
    throw new EficyValidationError('syntax', `Invalid TSX: ${error instanceof Error ? error.message : String(error)}`);
  }

  const tokens = file.tokens;
  const text = (index: number) => tokens[index] ? source.slice(tokens[index].start, tokens[index].end) : '';
  const imports = new Set<string>();
  let defaults = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === TokenType._import || (token.type === TokenType.name && text(i) === 'import' && tokens[i + 1]?.type === TokenType.dot)) {
      if (tokens[i + 1]?.type === TokenType.parenL || tokens[i + 1]?.type === TokenType.dot) {
        throw new EficyValidationError('import', 'Dynamic import and import.meta are unavailable; use static built-in imports.');
      }
      let moduleIndex = i + 1;
      while (moduleIndex < tokens.length && tokens[moduleIndex].type !== TokenType.string && tokens[moduleIndex].type !== TokenType.semi) moduleIndex++;
      const specifier = text(moduleIndex);
      const builtin = BUILTIN_IMPORTS.find((name) => specifier === `'${name}'` || specifier === `"${name}"`);
      if (!builtin) throw new EficyValidationError('import', 'Only static imports from "eficy" and "shadcn" are available; remote, relative, and other package imports are unsupported.');
      imports.add(builtin);
    }
    if (token.type === TokenType._export && !token.isType) {
      if (tokens[i + 1]?.type === TokenType._default) defaults++;
      // Keep this single-file format explicit: local named exports are unnecessary.
      else throw new EficyValidationError('default-export', 'Use a direct export default component; named exports and re-exports are unsupported.');
    }
    if (token.type === TokenType.name && ['require', 'loadModule'].includes(text(i))) {
      throw new EficyValidationError('import', 'require and loadModule are unavailable in single-file previews.');
    }
    if (token.type === TokenType.jsxName && tokens[i - 1]?.type === TokenType.jsxTagStart && ['script', 'html', 'head', 'body'].includes(text(i).toLowerCase())) {
      throw new EficyValidationError('frame-boundary', 'Write a TSX component, not an HTML document or script tag; the preview owns its runtime.');
    }
  }
  if (defaults !== 1) throw new EficyValidationError('default-export', 'Expected exactly one direct default export of a React component.');
  return { source, bytes, imports: [...imports] };
}
