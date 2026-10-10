import type { Seed } from './random.js';
import type { Infer, Shape } from './shape.js';
import { clone, isPlain } from './path.js';
import { deriveContext } from './instructions/derive.js';
import type { Fields } from './types/field-overrides.js';
import type { Derived, DeriveContext } from './types/derived-fields.js';
import type { DeepPartial } from './types/partial-values.js';
import type { RunOptions, RecipeConfig, ResolvedConfig, FixtureOverrides, GenerationResult } from './recipe/contracts.js';
import { registerFixture } from './fixture-identity.js';
import { Engine } from './engine.js';
import { GenerationError } from './error.js';

export type { RunOptions, RecipeConfig, ResolvedConfig, FixtureOverrides, GenerationResult, Provider, TraceEvent } from './recipe/contracts.js';
export type { DeepPartial } from './types/partial-values.js';
export { isFixture } from './fixture-identity.js';
export { defaultSeed } from './random.js';
export { isPlain } from './path.js';

export class Fixture<T> {
  readonly _fixture = true;
  readonly config: Readonly<RecipeConfig<T>>;
  constructor(readonly shape: Shape<T>, config: RecipeConfig<T> = {}) {
    this.config = freezeConfig(config);
    registerFixture(this);
    Object.freeze(this);
  }
  extend(config: RecipeConfig<T>): Fixture<T> { return new Fixture(this.shape, mergeConfig(this.config, config)); }
  private selectedConfig(options: RunOptions<T>): Readonly<RecipeConfig<T>> {
    let config = this.config;
    if (options.case) {
      const selected = config.cases?.[options.case];
      if (!selected) throw new GenerationError('CONFIGURATION', `Unknown case ${options.case}`);
      config = mergeConfig(config, selected);
    }
    return config;
  }
  private executionOptions(options: RunOptions<T>): RunOptions<T> { return { ...this.selectedConfig(options).options, ...options }; }
  resolve(options: RunOptions<T> = {}): ResolvedConfig<T> {
    const config = this.selectedConfig(options);
    const computed = typeof config.computed === 'function' ? config.computed(deriveContext<T>()) : config.computed;
    return { ...config, identity: this, fields: mergeFields(config.fields, options.fields) as Fields<T>, computed: computed as Record<string, Derived<unknown>> ?? {} };
  }
  one(options: RunOptions<T> = {}): T { return this.result(options).value; }
  result(options: RunOptions<T> = {}): GenerationResult<T> {
    const run = new Engine(this.executionOptions(options));
    return { value: run.make(this, options), seed: run.seed, now: run.now.toISOString() };
  }
  many(count: number, options: RunOptions<T> = {}): T[] {
    if (!Number.isSafeInteger(count) || count < 0) throw new GenerationError('CONFIGURATION', 'Count must be a nonnegative safe integer');
    const run = new Engine(this.executionOptions(options));
    return Array.from({ length: count }, (_, i) => run.make(this, options, i));
  }
  *stream(options: RunOptions<T> = {}): IterableIterator<T> {
    const run = new Engine(this.executionOptions(options));
    for (let index = 0; ; index++) yield run.make(this, options, index);
  }
  blank(options: RunOptions<T> = {}): DeepPartial<T> { return new Engine(this.executionOptions(options)).make(this, options, 0, undefined, 'blank') as DeepPartial<T>; }
  fill(existing: DeepPartial<T>, options: RunOptions<T> & { mode?: 'missing' | 'nullish' | 'rules' } = {}): T {
    return new Engine(this.executionOptions(options)).make(this, options, 0, existing, options.mode ?? 'missing');
  }
  cartesian(dimensions: Partial<{ [K in keyof T]: readonly T[K][] }>, options: RunOptions<T> & { limit?: number } = {}): T[] {
    const entries = Object.entries(dimensions) as [string, readonly unknown[]][];
    const size = entries.reduce((n, [, values]) => n * values.length, 1);
    if (!Number.isSafeInteger(size) || size > (options.limit ?? 10000)) throw new GenerationError('CONFIGURATION', 'Cartesian product exceeds limit');
    const combinations: Record<string, unknown>[] = [{}];
    for (const [key, values] of entries) {
      const previous = combinations.splice(0);
      for (const item of previous) for (const value of values) combinations.push({ ...item, [key]: value });
    }
    const run = new Engine(this.executionOptions(options));
    return combinations.map((fields, index) => run.make(this, { ...options, fields: fields as Fields<T> }, index));
  }
}
export function defineFixture<S extends Shape>(input: S, config: RecipeConfig<Infer<S>> = {}): Fixture<Infer<S>> { return new Fixture<Infer<S>>(input as Shape<Infer<S>>, config); }
export function fixtureRun(options: RunOptions = {}): {
  make<T>(fixture: Fixture<T>, overrides?: FixtureOverrides<T>): T;
  makeMany<T>(fixture: Fixture<T>, count: number, overrides?: FixtureOverrides<T>): T[];
  readonly seed: Seed; readonly now: Date;
} {
  const engine = new Engine(options);
  const checkOverrides = (overrides: object) => {
    for (const key of Object.keys(overrides)) if (!['case', 'fields', 'check', 'strict'].includes(key)) throw new GenerationError('CONFIGURATION', `Session option ${key} belongs on fixtureRun()`);
  };
  return { seed: engine.seed, now: new Date(engine.now), make: (fixture, overrides = {}) => { checkOverrides(overrides); return engine.make(fixture, overrides); },
    makeMany: (fixture, count, overrides = {}) => { checkOverrides(overrides); if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid count'); return Array.from({ length: count }, (_, i) => engine.make(fixture, overrides, i)); } };
}
function freezeConfig<T>(config: RecipeConfig<T>): Readonly<RecipeConfig<T>> {
  return Object.freeze({ ...config,
    ...(config.fields ? { fields: freezeFields(config.fields) } : {}),
    ...(config.rules ? { rules: Object.freeze(config.rules.map(rule => Object.freeze({ ...rule, match: Object.freeze({ ...rule.match }) }))) } : {}),
    ...(config.complete ? { complete: Object.freeze([...config.complete]) } : {}),
    ...(config.cases ? { cases: Object.freeze(Object.fromEntries(Object.entries(config.cases).map(([k, v]) => [k, freezeConfig(v)]))) } : {}),
  });
}
function freezeFields<T>(fields: Fields<T>): Fields<T> { return Object.freeze(mergeFields({}, fields)) as Fields<T>; }
export function mergeFields(base: unknown, overrides: unknown): Record<string, unknown> {
  const output = { ...base as object } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides as object ?? {})) {
    const old = output[key];
    Object.defineProperty(output, key, { value: isPlain(value) && isPlain(old) ? mergeFields(old, value) : isPlain(value) ? Object.freeze(mergeFields({}, value)) : cloneLiteralInstruction(value), enumerable: true, configurable: true, writable: true });
  }
  return output;
}
function cloneLiteralInstruction(value: unknown): unknown { return Array.isArray(value) ? Object.freeze(clone(value)) : value; }
function mergeConfig<T>(base: Readonly<RecipeConfig<T>>, overrides: RecipeConfig<T>): RecipeConfig<T> {
  const computed = (context: DeriveContext<T>) => ({
    ...(typeof base.computed === 'function' ? base.computed(context) : base.computed),
    ...(typeof overrides.computed === 'function' ? overrides.computed(context) : overrides.computed),
  });
  return { ...base, ...overrides, fields: mergeFields(base.fields, overrides.fields) as Fields<T>, computed,
    rules: [...(base.rules ?? []), ...(overrides.rules ?? [])], complete: [...(base.complete ?? []), ...(overrides.complete ?? [])],
    options: { ...base.options, ...overrides.options }, cases: { ...base.cases, ...overrides.cases } };
}
