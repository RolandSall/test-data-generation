import { GenerationError } from '../error.js';
import { Decimal, type Shape } from '../shape.js';
import type { GeneratorContext } from '../instructions.js';
import type { ResolvedConfig } from '../recipe.js';
import type { Seed } from '../random.js';
import { projectRow } from '../../feeds/feed.js';

export function projectFeed(
  config: ResolvedConfig<unknown> | undefined, declared: Readonly<Record<string, Shape>>,
  context: GeneratorContext, blank: boolean,
): Record<string, unknown> {
  if (!config?.source || blank) return {};
  const source = config.source;
  const row = source.next(context);
  const consumed = config.columns ? new Set<string>() : new Set(Object.keys(declared));
  const projected = config.columns
    ? projectRow(row, config.columns, context, consumed)
    : Object.fromEntries(Object.entries(row).filter(([key]) =>
      source.options.unmatched !== 'ignore' || Object.hasOwn(declared, key),
    ));
  if (source.options.unmatched !== 'ignore') {
    for (const key of Object.keys(row)) {
      if (!consumed.has(key)) throw new GenerationError('FEED', 'Unmapped feed column ' + key, context.path, context.random.seed);
    }
  }
  for (const key of Object.keys(projected)) {
    if (!Object.hasOwn(declared, key)) throw new GenerationError('FEED', 'Feed target ' + key + ' has no field', context.path, context.random.seed);
  }
  return projected;
}

export function decodeColumn(node: Shape, value: unknown, path: string, seed: Seed): unknown {
  if (node.decode) return node.decode(value);
  if (node.kind === 'lazy') return decodeColumn(node.resolve!(), value, path, seed);
  if (node.kind === 'optional' || node.kind === 'nullable') {
    return value === null || value === undefined ? value : decodeColumn(node.element!, value, path, seed);
  }
  if (typeof value !== 'string' || node.kind === 'string') return value;
  switch (node.kind) {
    case 'number': case 'integer': {
      const numeric = Number(value);
      if (!value.trim() || !Number.isFinite(numeric) || (node.kind === 'integer' && !Number.isSafeInteger(numeric))) {
        throw new GenerationError('FEED', 'Invalid numeric column', path, seed);
      }
      return numeric;
    }
    case 'boolean':
      if (value === 'true') return true;
      if (value === 'false') return false;
      throw new GenerationError('FEED', 'Boolean column must be true or false', path, seed);
    case 'bigint': return BigInt(value);
    case 'decimal': return Decimal.parse(value);
    case 'date': {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) throw new GenerationError('FEED', 'Invalid date column', path, seed);
      return date;
    }
    case 'literal': case 'enum': {
      const match = node.values!.find(candidate => String(candidate) === value);
      if (match === undefined) throw new GenerationError('FEED', 'Unknown enum column value', path, seed);
      return match;
    }
    default: return value;
  }
}
