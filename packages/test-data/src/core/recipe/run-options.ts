import type { Seed } from '../random.js';
import type { Constraints, Kind } from '../shape.js';
import type { Fields } from '../types/field-overrides.js';
import type { TraceEvent } from './trace-event.js';

export interface RunOptions<Model = unknown> {
  seed?: Seed;
  now?: Date | string;
  case?: string;
  fields?: Fields<Model>;
  /** Full generation is the default. Use OnlyProvidedOptions on a generation call to opt out. */
  onlyProvided?: false;
  check?: 'none' | 'schema';
  strict?: boolean;
  maxDepth?: number;
  maxAttempts?: number;
  maxNodes?: number;
  cycle?: 'omit' | 'null' | 'reference' | 'error';
  nullProbability?: number;
  optionalProbability?: number;
  schemaDefaults?: 'generate' | 'preserve';
  trace?: (event: TraceEvent) => void;
  defaults?: Partial<Record<Kind, Constraints>>;
}
