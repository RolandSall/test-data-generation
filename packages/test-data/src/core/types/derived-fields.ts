import type { Derived } from './derived.js';
import type { DeriveContext } from './derive-context.js';

export type { Derived } from './derived.js';
export type { DeriveContext } from './derive-context.js';

/** Each computed property must return the type declared by the model. */
export type ComputedFields<Model> = Partial<{
  [Key in keyof Model]: Derived<Model[Key]>;
}>;

export type ComputedConfig<Model> =
  | ComputedFields<Model>
  | ((context: DeriveContext<Model>) => ComputedFields<Model>);
