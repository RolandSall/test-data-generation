import { GenerationError } from '../error.js';
import { clone } from '../path.js';
import { Decimal, type Shape } from '../shape.js';
import type { GeneratorContext } from '../instructions.js';
import * as values from '../../generators/values.js';
import { formatGenerator } from '../../generators/formats.js';

/** Built-in leaf generation; provider selection belongs to the rule registry. */
export function generateScalar(node: Shape, context: GeneratorContext): unknown {
  const constraints = node.constraints;
  const random = context.random;
  switch (node.kind) {
    case 'string':
      if (constraints.format) {
        const format = formatGenerator(constraints.format);
        if (format) return format.generate(context);
        throw new GenerationError('CONSTRAINT', 'Unknown format ' + constraints.format, context.path, random.seed);
      }
      if (constraints.pattern) return values.regex(constraints.pattern).generate(context);
      return values.text({
        min: constraints.minLength ?? Math.min(3, constraints.maxLength ?? 3),
        max: constraints.maxLength ?? Math.max(constraints.minLength ?? 3, 10),
        ...(constraints.alphabet === undefined ? {} : { alphabet: constraints.alphabet }),
      }).generate(context);
    case 'integer': case 'number': {
      const min = constraints.min ?? Math.min(1, constraints.max ?? 1);
      const max = constraints.max ?? Math.max(min, 10000);
      if (constraints.multipleOf !== undefined) {
        const divisor = constraints.multipleOf;
        if (divisor <= 0 || !Number.isFinite(divisor)) {
          throw new GenerationError('CONSTRAINT', 'Invalid multipleOf', context.path, random.seed);
        }
        return random.int(Math.ceil(min / divisor), Math.floor(max / divisor)) * divisor;
      }
      return node.kind === 'integer' ? random.int(Math.ceil(min), Math.floor(max)) : random.float(min, max);
    }
    case 'bigint': {
      const upper = constraints.bigMax ?? (constraints.max === undefined ? undefined : BigInt(constraints.max));
      const min = constraints.bigMin ?? (constraints.min === undefined
        ? upper !== undefined && upper < 1n ? upper : 1n : BigInt(constraints.min));
      return random.bigint(min, upper ?? (min > 10000n ? min : 10000n));
    }
    case 'boolean': return random.boolean();
    case 'date':
      return values.date({
        ...(constraints.min === undefined ? {} : { min: new Date(constraints.min) }),
        ...(constraints.max === undefined ? {} : { max: new Date(constraints.max) }),
        ...(constraints.past === undefined ? {} : { past: constraints.past }),
        ...(constraints.future === undefined ? {} : { future: constraints.future }),
      }).generate(context);
    case 'bytes': {
      const min = constraints.minLength ?? Math.min(3, constraints.maxLength ?? 3);
      const max = constraints.maxLength ?? Math.max(constraints.minLength ?? 3, 10);
      return Uint8Array.from(Array.from({ length: random.int(min, max) }, () => random.int(0, 255)));
    }
    case 'decimal':
      return values.decimal({
        precision: constraints.precision ?? 8, scale: constraints.scale ?? 2,
        ...(constraints.min === undefined ? {} : { min: Decimal.parse(String(constraints.min)) }),
        ...(constraints.max === undefined ? {} : { max: Decimal.parse(String(constraints.max)) }),
      }).generate(context);
    case 'literal': case 'enum': return clone(random.pick(node.values!));
    case 'custom':
      throw new GenerationError('CONSTRAINT', 'Custom shape requires a provider or field generator', context.path, random.seed);
    default:
      throw new GenerationError('CONFIGURATION', 'Unsupported kind ' + node.kind, context.path, random.seed);
  }
}
