import type { Shape } from '../shape.js';

export type { NodeLocation } from './node-location.js';
export type { NodeRequest } from './node-request.js';
export type { BuildRequest } from './build-request.js';
export type { NodeTraversal } from './node-traversal.js';

export type GenerationMode = 'generate' | 'provided' | 'blank' | 'missing' | 'nullish' | 'rules';

export function isCollection(node: Shape): boolean {
  return ['array', 'tuple', 'map', 'set', 'record'].includes(node.kind);
}
