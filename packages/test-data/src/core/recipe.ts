import type { Infer, Shape } from './shape.js';
import { clone, isPlain } from './path.js';
import { deriveContext } from './instructions/derive.js';
import type { Fields } from './types/field-overrides.js';
import type { Derived, DeriveContext } from './types/derived-fields.js';
import type { DeepPartial } from './types/partial-values.js';
import type { RunOptions, RecipeConfig, ResolvedConfig, FixtureOverrides, GenerationResult } from './recipe/contracts.js';
import { registerFixture } from './fixture-identity.js';
import { Engine } from './engine.js';
import type { OnlyProvidedOptions } from './recipe/only-provided-options.js';
import type { OnlyProvidedOverrides } from './recipe/only-provided-overrides.js';
import type { FixtureSession } from './recipe/fixture-session.js';
import { selectionOptions, selectionOverrides } from './recipe/selection-options.js';
import { GenerationError } from './error.js';

export type { RunOptions, RecipeConfig, ResolvedConfig, FixtureOverrides, GenerationResult, Provider, TraceEvent, OnlyProvidedOptions, OnlyProvidedOverrides, FixtureSession } from './recipe/contracts.js';
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
  private selectedConfig(options: RunOptions<T> | OnlyProvidedOptions<T>): Readonly<RecipeConfig<T>> {
    let config = this.config;
    if (options.case) {
      const selected = config.cases?.[options.case];
      if (!selected) throw new GenerationError('CONFIGURATION', `Unknown case ${options.case}`);
      config = mergeConfig(config, selected);
    }
    return config;
  }
  private executionOptions(options: RunOptions<T> | OnlyProvidedOptions<T>): RunOptions<T> { return { ...this.selectedConfig(options).options, ...selectionOptions(options).runOptions }; }
  resolve(options: RunOptions<T> | OnlyProvidedOptions<T> = {}): ResolvedConfig<T> {
    const config = this.selectedConfig(options);
    const computed = typeof config.computed === 'function' ? config.computed(deriveContext<T>()) : config.computed;
    return { ...config, identity: this, fields: mergeFields(config.fields, options.fields) as Fields<T>, computed: computed as Record<string, Derived<unknown>> ?? {} };
  }
  one(options: OnlyProvidedOptions<T>): DeepPartial<T>;
  one(options?: RunOptions<T>): T;
  one(options: RunOptions<T> | OnlyProvidedOptions<T>): T | DeepPartial<T>;
  one(options: RunOptions<T> | OnlyProvidedOptions<T> = {}): T | DeepPartial<T> { return this.generateResult(options).value; }
  result(options: OnlyProvidedOptions<T>): GenerationResult<DeepPartial<T>>;
  result(options?: RunOptions<T>): GenerationResult<T>;
  result(options: RunOptions<T> | OnlyProvidedOptions<T>): GenerationResult<T | DeepPartial<T>>;
  result(options: RunOptions<T> | OnlyProvidedOptions<T> = {}): GenerationResult<T | DeepPartial<T>> { return this.generateResult(options); }
  private generateResult(options: RunOptions<T> | OnlyProvidedOptions<T>): GenerationResult<T> {
    const run = new Engine(this.executionOptions(options));
    const selected = selectionOptions(options);
    return { value: run.make(this, selected.runOptions, 0, undefined, selected.mode), seed: run.seed, now: run.now.toISOString() };
  }
  many(count: number, options: OnlyProvidedOptions<T>): DeepPartial<T>[];
  many(count: number, options?: RunOptions<T>): T[];
  many(count: number, options: RunOptions<T> | OnlyProvidedOptions<T>): (T | DeepPartial<T>)[];
  many(count: number, options: RunOptions<T> | OnlyProvidedOptions<T> = {}): (T | DeepPartial<T>)[] {
    if (!Number.isSafeInteger(count) || count < 0) throw new GenerationError('CONFIGURATION', 'Count must be a nonnegative safe integer');
    const run = new Engine(this.executionOptions(options));
    const selected = selectionOptions(options);
    return Array.from({ length: count }, (_, i) => run.make(this, selected.runOptions, i, undefined, selected.mode));
  }
  stream(options: OnlyProvidedOptions<T>): IterableIterator<DeepPartial<T>>;
  stream(options?: RunOptions<T>): IterableIterator<T>;
  stream(options: RunOptions<T> | OnlyProvidedOptions<T>): IterableIterator<T | DeepPartial<T>>;
  *stream(options: RunOptions<T> | OnlyProvidedOptions<T> = {}): IterableIterator<T | DeepPartial<T>> {
    const run = new Engine(this.executionOptions(options));
    const selected = selectionOptions(options);
    for (let index = 0; ; index++) yield run.make(this, selected.runOptions, index, undefined, selected.mode);
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
export function fixtureRun(options: RunOptions = {}): FixtureSession {
  const engine = new Engine(options);
  return { seed: engine.seed, now: new Date(engine.now),
    make: <T>(fixture: Fixture<T>, overrides: FixtureOverrides<T> | OnlyProvidedOverrides<T> = {}): T => {
      const selected = selectionOverrides(overrides);
      return engine.make(fixture, selected.runOptions, 0, undefined, selected.mode);
    },
    makeMany: <T>(fixture: Fixture<T>, count: number, overrides: FixtureOverrides<T> | OnlyProvidedOverrides<T> = {}): T[] => {
      const selected = selectionOverrides(overrides);
      if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Invalid count');
      return Array.from({ length: count }, (_, i) => engine.make(fixture, selected.runOptions, i, undefined, selected.mode));
    },
  };
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
