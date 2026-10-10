import * as core from 'zod/v4/core';
import { annotate, constrain, shape, type Constraints, type Shape } from '../core/shape.js';
import { GenerationError } from '../core/error.js';
/** Traverses Zod's documented core definitions, with independent Zod validation. */
export function fromZod<S extends core.$ZodType>(source: S): Shape<core.output<S>> {
  const cache = new WeakMap<core.$ZodType, Shape>();
  const visit = (source: core.$ZodType): Shape => {
    const cached = cache.get(source); if (cached) return cached;
    let output: Shape | undefined;
    cache.set(source, shape.lazy(() => output!));
    const definition = (source as core.$ZodTypes)._zod.def;
    const c: Constraints = {};
    const checks = definition.checks ?? [];
    const format = (definition as unknown as { format?: string }).format;
    if (format) c.format = normalizeFormat(format);
    let integer = false;
    for (const check of checks) {
      const def = check._zod.def as core.$ZodChecks['_zod']['def'];
      switch (def.check) {
        case 'greater_than': if (typeof def.value === 'bigint') c.bigMin = def.value + (def.inclusive ? 0n : 1n); else c.min = Number(def.value) + (def.inclusive ? 0 : Number.EPSILON * Math.max(1, Math.abs(Number(def.value)))); break;
        case 'less_than': if (typeof def.value === 'bigint') c.bigMax = def.value - (def.inclusive ? 0n : 1n); else c.max = Number(def.value) - (def.inclusive ? 0 : Number.EPSILON * Math.max(1, Math.abs(Number(def.value)))); break;
        case 'multiple_of': c.multipleOf = Number(def.value); break;
        case 'min_length': c.minLength = def.minimum; break;
        case 'max_length': c.maxLength = def.maximum; break;
        case 'length_equals': c.minLength = def.length; c.maxLength = def.length; break;
        case 'min_size': c.minSize = def.minimum; break;
        case 'max_size': c.maxSize = def.maximum; break;
        case 'size_equals': c.minSize = def.size; c.maxSize = def.size; break;
        case 'number_format': integer = ['safeint', 'int32', 'uint32'].includes(def.format); break;
        case 'string_format': {
          const spec = def as unknown as { format: string; pattern?: RegExp };
          if (spec.format === 'regex' && spec.pattern) c.pattern = spec.pattern;
          else c.format = normalizeFormat(spec.format);
          break;
        }
      }
    }
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
      case 'default': case 'prefault':
        output = Object.freeze({ ...visit(definition.innerType), defaultFactory: () => core.parse(source, undefined) }); break;
      case 'catch': case 'nonoptional': output = visit(definition.innerType); break;
      case 'readonly': output = shape.transform(visit(definition.innerType), value => typeof value === 'object' && value !== null ? Object.freeze(value) : value); break;
      case 'intersection': {
        const left = visit(definition.left), right = visit(definition.right);
        if (left.kind !== 'object' || right.kind !== 'object') throw new GenerationError('CONFIGURATION', 'Non-object Zod intersections require a provider');
        output = shape.object({ ...left.fields, ...right.fields }); break;
      }
      case 'pipe': output = shape.transform(visit(definition.in), value => core.parse(source, value)); break;
      default: output = shape.custom(); break;
    }
    if (definition.type !== 'pipe' && definition.type !== 'readonly') output = Object.freeze({ ...output, validate: (value: unknown) => {
      const result = core.safeParse(source, value);
      return result.success ? [] : result.error.issues.map(issue => issue.message);
    } });
    output = annotate(constrain(output, c), core.globalRegistry.get(source) as Record<string, unknown> ?? {});
    cache.set(source, output); return output;
  };
  return visit(source) as Shape<core.output<S>>;
}
function normalizeFormat(format: string): string {
  const names: Record<string, string> = { datetime: 'date-time', guid: 'uuid', int32: '', safeint: '', float64: '', float32: '' };
  return names[format] ?? format;
}
