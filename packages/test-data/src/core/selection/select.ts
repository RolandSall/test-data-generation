import type { Shape } from '../shape.js';
import type { Match } from '../types/match.js';
import type { Selection } from './selection.js';
import type { Selectors } from './selectors.js';
import type { Paths, AtPath } from '../types/property-paths.js';
import { checkSelectionPath } from './shape-path.js';
import { propertyPath } from './property-path.js';

function selection<Value>(match: Match, optional?: boolean): Selection<Value> {
  return Object.freeze({ use: (instruction: Parameters<Selection<Value>['use']>[0]) =>
    Object.freeze({ match: Object.freeze(match), use: instruction, ...(optional === undefined ? {} : { optional }) }),
  });
}

/** Typed selectors produce ordinary rules and retain the engine's precedence/strictness. */
export function select<Model>(model: Shape<Model>): Selectors<Model> {
  function field<Value>(property: (model: Model) => Value): Selection<Value>;
  function field<Path extends Paths<Model>>(path: Path): Selection<AtPath<Model, Path>>;
  function field(property: string | ((model: Model) => unknown)): Selection<unknown> {
    const path = typeof property === 'function' ? propertyPath(property) : property;
    checkSelectionPath(model, path);
    return selection({ path });
  }
  return Object.freeze({
    field,
    all: (kind, options = {}) => {
      const under = typeof options.under === 'function' ? propertyPath(options.under) : options.under;
      if (under !== undefined) checkSelectionPath(model, under);
      return selection({ kind, ...(under === undefined ? {} : { under }) }, options.optional);
    },
  } satisfies Selectors<Model>);
}
