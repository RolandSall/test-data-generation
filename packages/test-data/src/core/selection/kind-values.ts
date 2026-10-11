import type { Decimal } from '../shape.js';

/** Runtime scalar kinds and the values their selectors accept. */
export interface KindValues {
  string: string;
  number: number;
  integer: number;
  bigint: bigint;
  boolean: boolean;
  date: Date;
  bytes: Uint8Array;
  decimal: Decimal;
}
