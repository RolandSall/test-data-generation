import type { Shape } from '../shape.js';
import type { Generator } from '../instructions/generator.js';

export interface Provider {
  readonly match: (node: Shape) => boolean;
  readonly generate: Generator<unknown>;
}
