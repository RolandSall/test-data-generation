import type { Type, Field } from 'protobufjs';
import { shape, type Shape } from '../../core/shape.js';
import { GenerationError } from '../../core/error.js';
import { readField } from './fields.js';

function messageVariants(type: Type, read: (field: Field) => Shape): Record<string, Shape>[] {
  const base = Object.fromEntries(type.fieldsArray.filter(field => !field.partOf).map(field => [field.name, read(field)]));
  let variants = [base];
  for (const oneof of type.oneofsArray) {
    variants = variants.flatMap(fields => oneof.fieldsArray.map(field => ({ ...fields, [field.name]: read(field) })));
  }
  return variants;
}

function constructMessage(type: Type, fields: Record<string, Shape>): Shape {
  return shape.class(fields, values => {
    const message = type.fromObject(values);
    const error = type.verify(message);
    if (error) throw new GenerationError('VALIDATION', error);
    return message;
  });
}

export function createMessageReader(): (type: Type) => Shape {
  const cache = new Map<Type, Shape>();
  const read = (type: Type): Shape => {
    const cached = cache.get(type);
    if (cached) return cached;

    // Message references share this conversion's cache and can be recursive.
    cache.set(type, shape.lazy(() => result));
    const variants = messageVariants(type, field => readField(field, read));
    const construct = (fields: Record<string, Shape>) => constructMessage(type, fields);
    const result = variants.length === 1 ? construct(variants[0]!) : shape.union(variants.map(construct));
    cache.set(type, result);
    return result;
  };
  return read;
}
