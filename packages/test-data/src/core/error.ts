import type { Seed } from './random.js';
export type ErrorCode = 'CONFIGURATION' | 'UNUSED_RULE' | 'CONSTRAINT' | 'RETRY_EXHAUSTED' | 'DEPTH' | 'FEED' | 'DEPENDENCY' | 'CONSTRUCTION' | 'VALIDATION';
export class GenerationError extends Error {
  override readonly name = 'GenerationError';
  constructor(readonly code: ErrorCode, message: string, readonly path = '$', readonly seed?: Seed, options?: ErrorOptions) {
    super(`${code}: ${message} (path: ${path}${seed === undefined ? '' : `, seed: ${seed}`})`, options);
  }
}
