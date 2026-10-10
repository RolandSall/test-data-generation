import type { Paths, ValuesAtPaths } from './property-paths.js';
import type { Derived } from './derived.js';

export interface DeriveContext<Model> {
  derive<const Dependencies extends readonly Paths<Model>[], Result>(paths: Dependencies, compute: (...values: ValuesAtPaths<Model, Dependencies>) => Result): Derived<Result>;
}
