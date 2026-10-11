import type { Paths, AtPath } from '../types/property-paths.js';
import type { Selection } from './selection.js';
import type { KindValues } from './kind-values.js';
import type { KindSelectionOptions } from './kind-selection-options.js';

export interface Selectors<Model> {
  field<Value>(property: (model: Model) => Value): Selection<Value>;
  field<Path extends Paths<Model>>(path: Path): Selection<AtPath<Model, Path>>;
  all<Kind extends keyof KindValues>(kind: Kind, options?: KindSelectionOptions<Model>): Selection<KindValues[Kind]>;
}
