import type { Shape } from '../shape.js';
import type { Match } from '../types/match.js';
import type { Selection } from './selection.js';
import type { Selectors } from './selectors.js';
import { checkSelectionPath } from './shape-path.js';

function selection<Value>(match: Match, optional?: boolean): Selection<Value> {
  return Object.freeze({ use: (instruction: Parameters<Selection<Value>['use']>[0]) =>
    Object.freeze({ match: Object.freeze(match), use: instruction, ...(optional === undefined ? {} : { optional }) }),
  });
}

/** Typed selectors produce ordinary rules and retain the engine's precedence/strictness. */
export function select<Model>(model: Shape<Model>): Selectors<Model> {
  return Object.freeze({
    field: path => {
      checkSelectionPath(model, path);
      return selection({ path });
    },
    all: (kind, options = {}) => {
      if (options.under !== undefined) checkSelectionPath(model, options.under);
      return selection({ kind, ...(options.under === undefined ? {} : { under: options.under }) }, options.optional);
    },
  } satisfies Selectors<Model>);
}
