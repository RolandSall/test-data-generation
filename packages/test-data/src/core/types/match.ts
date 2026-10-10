import type { Shape } from '../shape.js';

export interface Match {
  path?: string;
  kind?: Shape['kind'];
  depth?: number | ((depth: number) => boolean);
  under?: string;
  index?: number | readonly number[] | ((index: number) => boolean);
  metadata?: Readonly<Record<string, unknown>>;
  predicate?: (node: Shape, path: string) => boolean;
}
