import type { NodeRequest } from './node-request.js';

export interface BuildRequest extends NodeRequest {
  fields?: Record<string, unknown> | undefined;
  blank: boolean;
}
