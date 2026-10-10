import type { DeriveContext } from '../types/derived-fields.js';

/**
 * Path checking proves the callback's argument tuple. Execution stores callbacks
 * with one uniform signature; preserve their result type while erasing arguments.
 */
function executionCallback<Arguments extends readonly unknown[], Result>(
  compute: (...values: Arguments) => Result,
): (...values: readonly unknown[]) => Result {
  return compute as (...values: readonly unknown[]) => Result;
}

export function deriveContext<Model>(): DeriveContext<Model> {
  return {
    derive: (paths, compute) => ({
      paths: [...paths],
      compute: executionCallback(compute),
    }),
  };
}
