import { GenerationError } from '../error.js';
import { getPath, setPath } from '../path.js';
import type { ResolvedConfig } from '../recipe.js';
import type { Seed } from '../random.js';

/** Evaluate the current object's dependency DAG in topological order. */
export function computeFields(data: unknown, config: ResolvedConfig<unknown> | undefined, path: string, seed: Seed): void {
  const computed = config?.computed ?? {};
  const active = new Set<string>();
  const done = new Set<string>();
  const evaluate = (key: string): void => {
    if (done.has(key)) return;
    if (active.has(key)) throw new GenerationError('DEPENDENCY', 'Computed dependency cycle at ' + key, path, seed);
    const spec = computed[key]!;
    active.add(key);
    for (const dependency of spec.paths) {
      const root = dependency.split('.')[0]!;
      if (Object.hasOwn(computed, root)) evaluate(root);
      if (getPath(data, dependency) === undefined) {
        throw new GenerationError('DEPENDENCY', 'Unresolved dependency ' + dependency, path, seed);
      }
    }
    setPath(data, key, spec.compute(...spec.paths.map(dependency => getPath(data, dependency))));
    active.delete(key);
    done.add(key);
  };
  for (const key of Object.keys(computed)) evaluate(key);
}
