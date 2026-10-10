import { getPath } from '../path.js';
import { stableKey } from '../validation.js';
import type { Rule } from '../instructions.js';
import type { ResolvedConfig } from '../recipe.js';

type Candidate = readonly [unknown, string];

/** Accepted keys survive roots; each root owns a rollback journal. */
export class UniquenessStore {
  readonly buckets = new Map<unknown, Set<string>>();
  readonly recipeKeys = new WeakMap<object, Map<string, object>>();

  transaction(): UniquenessTransaction { return new UniquenessTransaction(this); }
}

export class UniquenessTransaction {
  private readonly journal: [Set<string>, string][] = [];

  constructor(private readonly store: UniquenessStore) {}

  checkpoint(): number { return this.journal.length; }

  rollback(checkpoint = 0): void {
    for (const [bucket, key] of this.journal.splice(checkpoint)) bucket.delete(key);
  }

  reserve(output: unknown, rules: readonly Rule[], config?: ResolvedConfig<unknown>): boolean {
    const candidates: Candidate[] = rules.filter(rule => rule.unique).map(rule => [
      typeof rule.unique === 'string' ? rule.unique : rule, stableKey(output),
    ]);
    for (const group of config?.unique ?? []) {
      const paths = typeof group === 'string' ? [group] : group.paths;
      const scope = typeof group === 'string' ? 'shared' : group.scope ?? 'composite';
      const keys = this.store.recipeKeys.get(config!.identity) ?? new Map<string, object>();
      this.store.recipeKeys.set(config!.identity, keys);
      const id = paths.join('|');
      if (!keys.has(id)) keys.set(id, {});
      if (scope === 'composite') candidates.push([keys.get(id)!, stableKey(paths.map(path => getPath(output, path)))]);
      else for (const path of paths) candidates.push([keys.get(id)!, stableKey(getPath(output, path))]);
    }
    const duplicate = candidates.some(([key, value]) => this.store.buckets.get(key)?.has(value)) ||
      candidates.some(([key, value], i) => candidates.some(([other, candidate], j) => i !== j && other === key && candidate === value));
    if (duplicate) return false;

    for (const [key, value] of candidates) {
      const bucket = this.store.buckets.get(key) ?? new Set<string>();
      bucket.add(value);
      this.store.buckets.set(key, bucket);
      this.journal.push([bucket, value]);
    }
    return true;
  }
}
