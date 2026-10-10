import type { Shape } from '../core/shape.js';
import { loadDeclaration } from './typescript/compiler.js';
import { createTypeReader } from './typescript/reader.js';

/** Explicit metadata extraction for test setup or build tools; never scans sources implicitly. */
export function describeType<T = unknown>(file: string, name: string, options: { tsconfig?: string } = {}): Shape<T> {
  const { checker, source, type } = loadDeclaration(file, name, options);
  return createTypeReader(checker, source)(type) as Shape<T>;
}
