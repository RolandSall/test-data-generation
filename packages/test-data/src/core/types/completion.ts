import type { Match } from './match.js';
import type { GeneratorContext } from '../instructions/generator-context.js';

export interface Completion {
  readonly match: Match;
  readonly transform: (value: unknown, context: GeneratorContext) => unknown;
  readonly includeSupplied?: boolean;
  readonly optional?: boolean;
}
