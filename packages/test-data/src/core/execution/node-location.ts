import type { Shape } from '../shape.js';

export interface NodeLocation {
  node: Shape;
  path: string;
  depth: number;
  index: number;
}
