import type { NodeRequest } from './node-request.js';
import type { NodeLocation } from './node-location.js';

export interface NodeTraversal {
  visit(request: NodeRequest): unknown;
  blankNode(request: NodeLocation): unknown;
}
