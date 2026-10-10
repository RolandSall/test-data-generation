import ts from 'typescript';
import { shape, type Shape } from '../../core/shape.js';
import { GenerationError } from '../../core/error.js';
import type { TypeContext, TypeReader } from './context.js';

type BuiltinFactory = (arguments_: readonly ts.Type[], read: TypeReader) => Shape;
const BUILTIN_FACTORIES: Readonly<Record<string, BuiltinFactory>> = {
  ReadonlyArray: (args, read) => shape.array(read(args[0]!)),
  Date: () => shape.date(),
  Uint8Array: () => shape.bytes(),
  Buffer: () => shape.bytes(),
  Map: (args, read) => shape.map(read(args[0]!), read(args[1]!)),
  ReadonlyMap: (args, read) => shape.map(read(args[0]!), read(args[1]!)),
  Set: (args, read) => shape.set(read(args[0]!)),
  ReadonlySet: (args, read) => shape.set(read(args[0]!)),
};

function readProperties(type: ts.Type, { checker, source, read }: TypeContext): Shape {
  const fields: Record<string, Shape> = {};
  for (const property of checker.getPropertiesOfType(type)) {
    const declaration = property.valueDeclaration ?? property.declarations?.[0] ?? source;
    const fieldType = checker.getTypeOfSymbolAtLocation(property, declaration);
    if (fieldType.getCallSignatures().length || (property.flags & ts.SymbolFlags.Method)) {
      throw new GenerationError('CONFIGURATION', `Method ${property.getName()} requires a class factory/provider`);
    }
    const member = read(fieldType);
    const optional = property.flags & ts.SymbolFlags.Optional && member.kind !== 'optional';
    fields[property.getName()] = optional ? shape.optional(member) : member;
  }
  return shape.object(fields);
}

export function readObject(type: ts.Type, context: TypeContext): Shape {
  const { checker, read } = context;
  const reference = (type.flags & ts.TypeFlags.Object) && ((type as ts.ObjectType).objectFlags & ts.ObjectFlags.Reference);
  const args = reference ? checker.getTypeArguments(type as ts.TypeReference) : [];
  if (checker.isArrayType(type)) return shape.array(read(args[0]!));

  const name = type.getSymbol()?.getName();
  const builtin = name && Object.hasOwn(BUILTIN_FACTORIES, name) ? BUILTIN_FACTORIES[name] : undefined;
  if (builtin) return builtin(args, read);

  const indexed = checker.getIndexTypeOfType(type, ts.IndexKind.String);
  return indexed ? shape.record(read(indexed)) : readProperties(type, context);
}
