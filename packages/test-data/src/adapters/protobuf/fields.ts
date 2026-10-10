import type { Field, MapField, Type } from 'protobufjs';
import { annotate, shape, type Shape } from '../../core/shape.js';
import { readScalar, readMapKey } from './scalars.js';

function readValue(field: Field, readMessage: (type: Type) => Shape): Shape {
  const resolved = field.resolvedType;
  if (resolved && 'fieldsArray' in resolved) return readMessage(resolved as Type);
  if (resolved && 'values' in resolved) return shape.enum(Object.values(resolved.values));
  return readScalar(field.type);
}

function applyCardinality(field: Field, value: Shape): Shape {
  if (field.map) return shape.record(value, {}, readMapKey((field as unknown as MapField).keyType));
  return field.repeated ? shape.array(value) : value;
}

export function readField(field: Field, readMessage: (type: Type) => Shape): Shape {
  const value = readValue(field, readMessage);
  return annotate(applyCardinality(field, value), { protobuf: field.name });
}
