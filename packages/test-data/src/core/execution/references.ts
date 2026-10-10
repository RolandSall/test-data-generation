import { GenerationError } from '../error.js';
import { getPath, write } from '../path.js';
import type { Seed } from '../random.js';

export class GraphReference {
  constructor(readonly target: string) {}
}

/** Wire deferred edges after construction, including Map keys/values and Set entries. */
export function resolveReferences(value: unknown, root: unknown, seed: Seed, seen = new WeakSet<object>()): unknown {
  if (value instanceof GraphReference) {
    const target = getPath(root, value.target);
    if (target === undefined || target instanceof GraphReference) {
      throw new GenerationError('DEPENDENCY', 'Unresolved reference ' + value.target, '$', seed);
    }
    return target;
  }
  if (typeof value !== 'object' || value === null || seen.has(value)) return value;
  seen.add(value);
  if (value instanceof Map) {
    const entries = [...value];
    value.clear();
    for (const [key, member] of entries) {
      value.set(resolveReferences(key, root, seed, seen), resolveReferences(member, root, seed, seen));
    }
  } else if (value instanceof Set) {
    const entries = [...value];
    value.clear();
    for (const member of entries) value.add(resolveReferences(member, root, seed, seen));
  } else {
    for (const key of Object.keys(value)) {
      const current = (value as Record<string, unknown>)[key];
      const resolved = resolveReferences(current, root, seed, seen);
      if (resolved !== current) write(value, key, resolved);
    }
  }
  return value;
}
