import type { Fields } from '../types/field-overrides.js';
import type { ComputedConfig } from '../types/derived-fields.js';
import type { Paths } from '../types/property-paths.js';
import type { Completion, Rule } from '../types/matching.js';
import type { Column, Feed } from '../../feeds/feed.js';
import type { RunOptions } from './run-options.js';
import type { Provider } from './provider.js';

export interface RecipeConfig<Model> {
  fields?: Fields<Model>;
  computed?: ComputedConfig<Model>;
  cases?: Readonly<Record<string, RecipeConfig<Model>>>;
  rules?: readonly Rule[];
  complete?: readonly Completion[];
  source?: Feed;
  columns?: Partial<Record<keyof Model & string, string | Column>>;
  options?: RunOptions<Model>;
  providers?: readonly Provider[];
  filter?: (value: Model) => boolean;
  unique?: readonly (Paths<Model> | {
    paths: readonly Paths<Model>[];
    scope?: 'shared' | 'composite';
  })[];
}
