import * as core from 'zod/v4/core';
import { annotate, constrain, shape, type Shape } from '../core/shape.js';
import { GenerationError } from '../core/error.js';
import { readConstraints } from './zod/constraints.js';
import { createOutputSchemaReader } from './zod/output-schema.js';
import { zodIssues, parseZod } from './zod/issues.js';
import type { ZodOptions } from './zod/zod-options.js';
export type { ZodOptions } from './zod/zod-options.js';
/** Traverses Zod's documented core definitions, with independent Zod validation. */
export function fromZod<S extends core.$ZodType>(source: S, options: { mode: 'input' }): Shape<core.input<S>>;
export function fromZod<S extends core.$ZodType>(source: S, options?: { mode?: 'output' }): Shape<core.output<S>>;
export function fromZod<S extends core.$ZodType>(source: S, options: ZodOptions): Shape<core.input<S> | core.output<S>>;
export function fromZod(source: core.$ZodType, options: ZodOptions = {}): Shape {
  if (options.mode !== undefined && !['input', 'output'].includes(options.mode)) throw new GenerationError('CONFIGURATION', 'Invalid Zod generation mode');
  return createReader(options.mode ?? 'output')(source);
}

function createReader(mode: 'input' | 'output') {
  const outputSchema = createOutputSchemaReader();
  const inputReader = mode === 'output' ? createReader('input') : undefined;
  const cache = new WeakMap<core.$ZodType, Shape>();
  const visit = (source: core.$ZodType): Shape => {
    const cached = cache.get(source); if (cached) return cached;
    let output: Shape | undefined;
    cache.set(source, shape.lazy(() => output!));
    const definition = (source as core.$ZodTypes)._zod.def;
    const { constraints: c, integer } = readConstraints(definition);
    switch (definition.type) {
      case 'string': output = shape.string(c); break;
      case 'number': output = integer ? shape.integer(c) : shape.number(c); break;
      case 'bigint': output = shape.bigint(c); break;
      case 'boolean': output = shape.boolean(); break;
      case 'date': output = shape.date(c); break;
      case 'null': output = shape.literal(null); break;
      case 'undefined': case 'void': output = shape.literal(undefined); break;
      case 'object': output = shape.object(Object.fromEntries(Object.entries(definition.shape).map(([key, value]) => [key, visit(value)]))); break;
      case 'array': output = shape.array(visit(definition.element), c); break;
      case 'tuple': {
        if (definition.rest) throw new GenerationError('CONFIGURATION', 'Variadic Zod tuples require an explicit collection recipe');
        output = shape.tuple(definition.items.map(visit)); break;
      }
      case 'map': output = shape.map(visit(definition.keyType), visit(definition.valueType), c); break;
      case 'set': output = shape.set(visit(definition.valueType), c); break;
      case 'record': {
        const key = visit(definition.keyType);
        output = key.values ? shape.object(Object.fromEntries(key.values.map(k => [String(k), visit(definition.valueType)]))) : shape.record(visit(definition.valueType), c, key);
        break;
      }
      case 'union': output = shape.union(definition.options.map(visit)); break;
      case 'literal': output = shape.enum(definition.values); break;
      case 'enum': output = shape.enum([...new Set(Object.entries(definition.entries).filter(([key, value]) => !(typeof value === 'string' && typeof definition.entries[value] === 'number' && String(definition.entries[value]) === key)).map(([, value]) => value))]); break;
      case 'lazy': output = shape.lazy(() => visit(definition.getter())); break;
      case 'optional': output = shape.optional(visit(definition.innerType)); break;
      case 'nullable': output = shape.nullable(visit(definition.innerType)); break;
      case 'default': case 'prefault': {
        const described = visit(definition.innerType);
        const inner = mode === 'input' ? shape.optional(described) : ['optional', 'transform'].includes(described.kind)
          ? shape.transform(inputReader!(definition.innerType), value => parseZod(source, value)) : described;
        output = Object.freeze({ ...inner, defaultFactory: () => mode === 'output' ? parseZod(source, undefined) : definition.type === 'prefault' ? definition.defaultValue : undefined }); break;
      }
      case 'catch': case 'nonoptional': output = visit(definition.innerType); break;
      case 'readonly': output = mode === 'input' ? visit(definition.innerType) : shape.transform(visit(definition.innerType), value => typeof value === 'object' && value !== null ? Object.freeze(value) : value); break;
      case 'intersection': {
        const left = visit(definition.left), right = visit(definition.right);
        if (left.kind !== 'object' || right.kind !== 'object') throw new GenerationError('CONFIGURATION', 'Non-object Zod intersections require a provider');
        output = shape.object({ ...left.fields, ...right.fields }); break;
      }
      case 'pipe': output = mode === 'input' ? visit(definition.in) : shape.transform(inputReader!(definition.in), value => parseZod(source, value)); break;
      default: output = shape.custom(); break;
    }
    if (mode === 'output' && definition.checks?.some(check => check._zod.def.check === 'overwrite')) {
      output = shape.transform(inputReader!(source), value => parseZod(source, value));
    }
    const validator = mode === 'input' ? source : outputSchema(source);
    output = Object.freeze({ ...output, validate: (value: unknown) => zodIssues(validator, value) });
    output = annotate(constrain(output, c), core.globalRegistry.get(source) as Record<string, unknown> ?? {});
    cache.set(source, output); return output;
  };
  return visit;
}
