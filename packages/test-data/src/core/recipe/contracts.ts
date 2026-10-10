import type { RunOptions } from './run-options.js';
import type { RecipeConfig } from './recipe-config.js';
import type { Derived } from '../types/derived-fields.js';

export type { RunOptions } from './run-options.js';
export type { TraceEvent } from './trace-event.js';
export type { Provider } from './provider.js';
export type { RecipeConfig } from './recipe-config.js';
export type { GenerationResult } from './generation-result.js';

export type FixtureOverrides<Model> = Pick<RunOptions<Model>, 'case' | 'fields' | 'check' | 'strict'>;

export type ResolvedConfig<Model> = Omit<RecipeConfig<Model>, 'computed' | 'cases'> & {
  computed: Readonly<Record<string, Derived<unknown>>>;
  identity: object;
};
