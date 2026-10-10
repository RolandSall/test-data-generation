import type { Seed } from '../random.js';

export interface GenerationResult<Model> {
  value: Model;
  seed: Seed;
  now: string;
}
