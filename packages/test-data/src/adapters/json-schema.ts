import { constrain, shape, type Constraints, type Shape } from '../core/shape.js';
import { validateShape } from '../core/validation.js';
import { GenerationError } from '../core/error.js';
export interface JsonSchema {
  $ref?: string; $defs?: Record<string, JsonSchema>; definitions?: Record<string, JsonSchema>;
  type?: string | readonly string[]; properties?: Record<string, JsonSchema>;
  required?: readonly string[]; additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema; prefixItems?: readonly JsonSchema[]; enum?: readonly unknown[];
  const?: unknown; anyOf?: readonly JsonSchema[]; oneOf?: readonly JsonSchema[];
  allOf?: readonly JsonSchema[]; minimum?: number; maximum?: number;
  exclusiveMinimum?: number; exclusiveMaximum?: number; multipleOf?: number;
  minLength?: number; maxLength?: number; pattern?: string; format?: string;
  minItems?: number; maxItems?: number; uniqueItems?: boolean;
  default?: unknown; description?: string;
}
export function fromJsonSchema<T = unknown>(document: JsonSchema): Shape<T> {
  const cache = new WeakMap<JsonSchema, Shape>();
  const visit = (schema: JsonSchema): Shape => {
    for (const key of ['not', 'if', 'then', 'else', 'dependentRequired', 'dependentSchemas', 'dependencies', 'contains', 'minContains', 'maxContains', 'unevaluatedItems', 'unevaluatedProperties', 'patternProperties', 'propertyNames', 'minProperties', 'maxProperties']) {
      if (Object.hasOwn(schema, key)) throw new GenerationError('CONFIGURATION', `JSON Schema ${key} requires preprocessing or an explicit provider`);
    }
    const cached = cache.get(schema); if (cached) return cached;
    let output: Shape | undefined;
    cache.set(schema, shape.lazy(() => output ?? (() => { throw new GenerationError('CONFIGURATION', 'Unresolved schema'); })()));
    if (schema.$ref) {
      if (!schema.$ref.startsWith('#/')) throw new GenerationError('CONFIGURATION', 'Only local JSON Schema references are supported');
      const target = schema.$ref.slice(2).split('/').reduce<unknown>((o, key) => typeof o === 'object' && o !== null ? (o as Record<string, unknown>)[key.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined, document);
      if (typeof target !== 'object' || target === null) throw new GenerationError('CONFIGURATION', `Missing schema reference ${schema.$ref}`);
      output = visit(target as JsonSchema);
    } else if (schema.allOf) {
      const members = schema.allOf.map(visit);
      if (!members.every(member => member.kind === 'object')) throw new GenerationError('CONFIGURATION', 'Non-object allOf needs an explicit provider');
      output = Object.freeze({ ...shape.object(Object.assign({}, ...members.map(member => member.fields)) as Record<string, Shape>), validate: (value: unknown) => members.flatMap(member => validateShape(member, value).map(issue => `${issue.path}: ${issue.message}`)) });
    } else if (schema.anyOf || schema.oneOf) {
      const members = (schema.anyOf ?? schema.oneOf)!.map(visit);
      output = Object.freeze({ ...shape.union(members), validate: (value: unknown) => {
        const count = members.filter(member => !validateShape(member, value).length).length;
        return schema.oneOf ? count === 1 ? [] : ['Expected exactly one JSON Schema alternative'] : count > 0 ? [] : ['No JSON Schema alternative matched'];
      } });
    }
    else if (schema.enum) output = shape.enum(schema.enum);
    else if (Object.hasOwn(schema, 'const')) output = shape.literal(schema.const);
    else if (Array.isArray(schema.type)) output = shape.union(schema.type.map(type => visit({ ...schema, type })));
    else {
      const c: Constraints = {};
      if (schema.minimum !== undefined) c.min = schema.minimum;
      if (schema.maximum !== undefined) c.max = schema.maximum;
      if (schema.exclusiveMinimum !== undefined) c.min = schema.exclusiveMinimum + (schema.type === 'integer' ? 1 : Math.max(Number.EPSILON, Math.abs(schema.exclusiveMinimum) * Number.EPSILON));
      if (schema.exclusiveMaximum !== undefined) c.max = schema.exclusiveMaximum - (schema.type === 'integer' ? 1 : Math.max(Number.EPSILON, Math.abs(schema.exclusiveMaximum) * Number.EPSILON));
      if (schema.multipleOf !== undefined) c.multipleOf = schema.multipleOf;
      if (schema.minLength !== undefined) c.minLength = schema.minLength;
      if (schema.maxLength !== undefined) c.maxLength = schema.maxLength;
      if (schema.pattern !== undefined) c.pattern = new RegExp(schema.pattern);
      if (schema.format !== undefined) c.format = schema.format;
      if (schema.minItems !== undefined) c.minSize = schema.minItems;
      if (schema.maxItems !== undefined) c.maxSize = schema.maxItems;
      if (schema.uniqueItems !== undefined) c.unique = schema.uniqueItems;
      switch (schema.type ?? (schema.properties ? 'object' : undefined)) {
        case 'object': {
          if (!schema.properties && typeof schema.additionalProperties === 'object') output = shape.record(visit(schema.additionalProperties), c);
          else output = shape.object(Object.fromEntries(Object.entries(schema.properties ?? {}).map(([key, member]) => [key, schema.required?.includes(key) ? visit(member) : shape.optional(visit(member))])));
          break;
        }
        case 'array': output = schema.prefixItems ? shape.tuple(schema.prefixItems.map(visit)) : shape.array(visit(schema.items ?? { type: 'string' }), c); break;
        case 'string': output = shape.string(c); break;
        case 'number': output = shape.number(c); break;
        case 'integer': output = shape.integer(c); break;
        case 'boolean': output = shape.boolean(); break;
        case 'null': output = shape.literal(null); break;
        default: throw new GenerationError('CONFIGURATION', 'Schema requires a supported type, enum, union or explicit custom provider');
      }
      output = constrain(output, c);
    }
    cache.set(schema, output); return output;
  };
  return visit(document) as Shape<T>;
}
