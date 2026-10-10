import type { Match } from './match.js';

export interface Rule {
  readonly match: Match;
  readonly use?: unknown;
  readonly optional?: boolean;
  readonly filter?: (value: unknown) => boolean;
  readonly unique?: string | boolean;
  readonly nullable?: number;
}
