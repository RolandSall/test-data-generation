import type { AttemptCheckpoint } from './attempt-checkpoint.js';
export type { AttemptCheckpoint } from './attempt-checkpoint.js';
import { getPath, setPath } from '../path.js';
import type { Completion, GeneratorContext } from '../instructions.js';
import type { UniquenessTransaction } from './uniqueness.js';

interface CompletionCall { callback: Completion; path: string; index: number }


/** Rejected attempts discard pending callbacks and provisional unique keys together. */
export class AttemptEffects {
  private readonly completions: CompletionCall[] = [];

  constructor(readonly uniqueness: UniquenessTransaction) {}

  checkpoint(): AttemptCheckpoint {
    return { completions: this.completions.length, uniqueness: this.uniqueness.checkpoint() };
  }

  rollback(checkpoint: AttemptCheckpoint): void {
    this.completions.length = checkpoint.completions;
    this.uniqueness.rollback(checkpoint.uniqueness);
  }

  queue(callbacks: readonly Completion[], path: string, index: number): void {
    this.completions.push(...callbacks.map(callback => ({ callback, path, index })));
  }

  complete(root: unknown, context: (path: string, index: number) => GeneratorContext, replaceRoot: (root: unknown) => void): unknown {
    for (const { callback, path, index } of this.completions) {
      const current = getPath(root, path);
      const transformed = callback.transform(current, context(path, index));
      if (transformed === undefined || transformed === current) continue;
      if (path === '$') {
        root = transformed;
        replaceRoot(root);
      } else setPath(root, path, transformed);
    }
    return root;
  }
}
