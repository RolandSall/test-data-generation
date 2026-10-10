import type { NodeLocation } from './node-location.js';
import type { ResolvedConfig } from '../recipe/contracts.js';

/** One request describes a visit; child visits explicitly replace their location. */
export interface NodeRequest extends NodeLocation {
  input?: unknown;
  existing?: unknown;
  provided?: boolean;
  config?: ResolvedConfig<unknown> | undefined;
  skipUse?: boolean;
}
