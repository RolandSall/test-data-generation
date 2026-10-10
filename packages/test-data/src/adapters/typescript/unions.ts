import ts from 'typescript';
import { shape, type Shape } from '../../core/shape.js';
import type { TypeReader } from './context.js';

function readConcreteMembers(types: readonly ts.Type[], read: TypeReader): Shape[] {
  const booleans = types.filter(member => member.flags & ts.TypeFlags.BooleanLiteral);
  if (booleans.length !== 2) return types.map(read);
  return [
    ...types.filter(member => !(member.flags & ts.TypeFlags.BooleanLiteral)).map(read),
    shape.boolean(),
  ];
}

export function readUnion(type: ts.UnionType, read: TypeReader): Shape {
  const optional = type.types.some(member => member.flags & ts.TypeFlags.Undefined);
  const nullable = type.types.some(member => member.flags & ts.TypeFlags.Null);
  const concrete = type.types.filter(member => !(member.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null)));
  const members = readConcreteMembers(concrete, read);
  let result = members.length === 0 ? shape.literal(null) : members.length === 1 ? members[0]! : shape.union(members);
  if (nullable && members.length > 0) result = shape.nullable(result);
  if (optional) result = shape.optional(result);
  return result;
}
