import type { Fixture } from '../recipe.js';
import type { Seed } from '../random.js';
import type { DeepPartial } from '../types/partial-values.js';
import type { FixtureOverrides } from './contracts.js';
import type { OnlyProvidedOverrides } from './only-provided-overrides.js';
export interface FixtureSession {
  make<T>(fixture: Fixture<T>, overrides: OnlyProvidedOverrides<T>): DeepPartial<T>;
  make<T>(fixture: Fixture<T>, overrides?: FixtureOverrides<T>): T;
  make<T>(fixture: Fixture<T>, overrides: FixtureOverrides<T> | OnlyProvidedOverrides<T>): T | DeepPartial<T>;
  makeMany<T>(fixture: Fixture<T>, count: number, overrides: OnlyProvidedOverrides<T>): DeepPartial<T>[];
  makeMany<T>(fixture: Fixture<T>, count: number, overrides?: FixtureOverrides<T>): T[];
  makeMany<T>(fixture: Fixture<T>, count: number, overrides: FixtureOverrides<T> | OnlyProvidedOverrides<T>): (T | DeepPartial<T>)[];
  readonly seed: Seed;
  readonly now: Date;
}
