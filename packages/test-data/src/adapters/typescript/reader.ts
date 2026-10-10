import type ts from 'typescript';
import { shape, type Shape } from '../../core/shape.js';
import type { TypeContext, TypeReader } from './context.js';
import { readScalar } from './scalars.js';
import { readUnion } from './unions.js';
import { readObject } from './objects.js';

function convertType(type: ts.Type, context: TypeContext): Shape {
  // Literal/scalar classification precedes union handling: the compiler can
  // represent boolean as a union of true/false carrying the Boolean flag.
  const scalar = readScalar(type, context.checker);
  if (scalar) return scalar;
  if (type.isUnion()) return readUnion(type, context.read);
  if (context.checker.isTupleType(type)) {
    return shape.tuple(context.checker.getTypeArguments(type as ts.TypeReference).map(context.read));
  }
  return readObject(type, context);
}

export function createTypeReader(checker: ts.TypeChecker, source: ts.SourceFile): TypeReader {
  const cache = new Map<ts.Type, Shape>();
  const read: TypeReader = type => {
    const cached = cache.get(type);
    if (cached) return cached;

    // Register before traversing fields so self-references reuse a lazy edge.
    cache.set(type, shape.lazy(() => result));
    const result = convertType(type, { checker, source, read });
    cache.set(type, result);
    return result;
  };
  return read;
}
