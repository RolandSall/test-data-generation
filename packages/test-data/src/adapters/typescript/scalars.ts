import ts from 'typescript';
import { shape, type Shape } from '../../core/shape.js';
import { GenerationError } from '../../core/error.js';

const SCALAR_FACTORIES: readonly (readonly [ts.TypeFlags, () => Shape])[] = [
  [ts.TypeFlags.Boolean, shape.boolean],
  [ts.TypeFlags.String, shape.string],
  [ts.TypeFlags.Number, shape.number],
  [ts.TypeFlags.BigIntLike, shape.bigint],
  [ts.TypeFlags.Null, () => shape.literal(null)],
  [ts.TypeFlags.Undefined | ts.TypeFlags.Void, () => shape.literal(undefined)],
];
const UNSUPPORTED_FLAGS = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never | ts.TypeFlags.TypeParameter;

export function readScalar(type: ts.Type, checker: ts.TypeChecker): Shape | undefined {
  if (type.isStringLiteral() || type.isNumberLiteral()) return shape.literal(type.value);
  if (type.flags & ts.TypeFlags.BooleanLiteral) return shape.literal(checker.typeToString(type) === 'true');

  const factory = SCALAR_FACTORIES.find(([flags]) => type.flags & flags)?.[1];
  if (factory) return factory();
  if (type.flags & UNSUPPORTED_FLAGS) {
    throw new GenerationError('CONFIGURATION', `Type ${checker.typeToString(type)} needs explicit metadata/provider`);
  }
  return undefined;
}
