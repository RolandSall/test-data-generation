import { GenerationError } from './error.js';
import type { RunOptions } from './recipe.js';
import type { Constraints, Kind } from './shape.js';
export type SettingsOptions = Omit<RunOptions, 'fields' | 'case' | 'trace'>;
/** Explicit layers keep configuration deterministic and avoid mutable process-global settings. */
export function resolveSettings({ defaults = {}, environment = {}, overrides = {} }: {
  defaults?: RunOptions; environment?: Readonly<Record<string, string | undefined>>; overrides?: RunOptions;
} = {}): RunOptions {
  const env: RunOptions = {};
  if (environment.TEST_DATA_SEED !== undefined) env.seed = environment.TEST_DATA_SEED;
  if (environment.TEST_DATA_NOW !== undefined) env.now = environment.TEST_DATA_NOW;
  for (const [key, name] of [['maxDepth', 'TEST_DATA_MAX_DEPTH'], ['maxAttempts', 'TEST_DATA_MAX_ATTEMPTS'], ['maxNodes', 'TEST_DATA_MAX_NODES'], ['nullProbability', 'TEST_DATA_NULL_PROBABILITY'], ['optionalProbability', 'TEST_DATA_OPTIONAL_PROBABILITY']] as const) {
    if (environment[name] !== undefined) {
      const value = Number(environment[name]);
      if (!environment[name]?.trim() || !Number.isFinite(value)) throw new GenerationError('CONFIGURATION', `Invalid ${name}`);
      env[key] = value;
    }
  }
  if (environment.TEST_DATA_STRICT !== undefined) {
    if (!['true', 'false'].includes(environment.TEST_DATA_STRICT)) throw new GenerationError('CONFIGURATION', 'TEST_DATA_STRICT must be true or false');
    env.strict = environment.TEST_DATA_STRICT === 'true';
  }
  const kinds = new Set([...Object.keys(defaults.defaults ?? {}), ...Object.keys(overrides.defaults ?? {})]);
  const constraints = Object.fromEntries([...kinds].map(kind => [kind, Object.freeze({ ...defaults.defaults?.[kind as keyof NonNullable<RunOptions['defaults']>], ...overrides.defaults?.[kind as keyof NonNullable<RunOptions['defaults']>] })]));
  return Object.freeze({ ...defaults, ...env, ...overrides, defaults: Object.freeze(constraints) });
}
/** Serializable settings only; source code owns callbacks, fields, and provider registries. */
export function parseSettings(source: string): SettingsOptions {
  const input: unknown = JSON.parse(source);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new GenerationError('CONFIGURATION', 'Settings must be a JSON object');
  const output: SettingsOptions = {};
  const numberKeys = ['maxDepth', 'maxAttempts', 'maxNodes', 'nullProbability', 'optionalProbability'];
  for (const [key, value] of Object.entries(input)) {
    if (numberKeys.includes(key)) {
      const integer = key.startsWith('max');
      if (typeof value !== 'number' || !Number.isFinite(value) || (integer ? !Number.isSafeInteger(value) || value < (key === 'maxDepth' ? 0 : 1) : value < 0 || value > 1)) throw new GenerationError('CONFIGURATION', `Invalid setting ${key}`);
    } else if (key === 'seed') {
      if (typeof value !== 'string' && (typeof value !== 'number' || !Number.isSafeInteger(value))) throw new GenerationError('CONFIGURATION', 'Invalid seed');
    } else if (key === 'now') {
      if (typeof value !== 'string' || !Number.isFinite(new Date(value).getTime())) throw new GenerationError('CONFIGURATION', 'Invalid now');
    } else if (key === 'strict') {
      if (typeof value !== 'boolean') throw new GenerationError('CONFIGURATION', 'Invalid strict');
    } else if (key === 'check' || key === 'cycle') {
      if (!(key === 'check' ? ['none', 'schema'] : ['omit', 'null', 'reference', 'error']).includes(String(value))) throw new GenerationError('CONFIGURATION', `Invalid ${key}`);
    } else if (key === 'defaults') {
      output.defaults = parseDefaults(value); continue;
    } else throw new GenerationError('CONFIGURATION', `Unknown setting ${key}`);
    Object.defineProperty(output, key, { value, enumerable: true });
  }
  return Object.freeze(output);
}
function parseDefaults(input: unknown): Partial<Record<Kind, Constraints>> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new GenerationError('CONFIGURATION', 'Defaults must be an object');
  const kinds: Kind[] = ['string', 'number', 'integer', 'bigint', 'boolean', 'date', 'decimal', 'bytes', 'array', 'tuple', 'set', 'map', 'record'];
  const numberKeys = ['min', 'max', 'minLength', 'maxLength', 'minSize', 'maxSize', 'multipleOf', 'precision', 'scale'];
  const output: Partial<Record<Kind, Constraints>> = {};
  for (const [kind, fields] of Object.entries(input)) {
    if (!kinds.includes(kind as Kind) || typeof fields !== 'object' || fields === null || Array.isArray(fields)) throw new GenerationError('CONFIGURATION', `Invalid defaults kind ${kind}`);
    const constraints: Constraints = {};
    for (const [key, value] of Object.entries(fields)) {
      if (numberKeys.includes(key) && typeof value === 'number' && Number.isFinite(value) || ['unique', 'past', 'future'].includes(key) && typeof value === 'boolean' || ['format', 'alphabet'].includes(key) && typeof value === 'string') Object.defineProperty(constraints, key, { value, enumerable: true });
      else if (key === 'pattern' && typeof value === 'string') constraints.pattern = new RegExp(value);
      else if (['bigMin', 'bigMax'].includes(key) && typeof value === 'string' && /^-?\d+$/.test(value)) Object.defineProperty(constraints, key, { value: BigInt(value), enumerable: true });
      else throw new GenerationError('CONFIGURATION', `Invalid default constraint ${kind}.${key}`);
    }
    output[kind as Kind] = Object.freeze(constraints);
  }
  return Object.freeze(output);
}
