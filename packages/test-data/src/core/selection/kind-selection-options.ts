import type { Paths } from '../types/property-paths.js';

export interface KindSelectionOptions<Model> {
  under?: Paths<Model> | ((model: Model) => unknown);
  optional?: boolean;
}
