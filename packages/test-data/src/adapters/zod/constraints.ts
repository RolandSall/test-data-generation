import type * as core from 'zod/v4/core';
import type { Constraints } from '../../core/shape.js';

export function readConstraints(definition: core.$ZodTypes['_zod']['def']) {
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
  return { constraints: c, integer };
}
function normalizeFormat(format: string): string {
  const names: Record<string, string> = { datetime: 'date-time', time: 'local-time', guid: 'uuid', int32: '', safeint: '', float64: '', float32: '' };
  return names[format] ?? format;
}
