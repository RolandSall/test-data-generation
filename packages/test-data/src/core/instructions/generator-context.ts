import type { Random } from '../random.js';

export interface GeneratorContext {
  readonly random: Random;
  readonly now: Date;
  readonly path: string;
  readonly index: number;
  readonly root: unknown;
  state<T>(key: object, initialize: () => T): T;
}
