import type { LeafValue } from './leaf-values.js';

/** Partial plain objects for blank/fill operations; collections and dates retain their type. */
export type DeepPartial<Value> =
  Value extends LeafValue ? Value :
  Value extends object ? { [Key in keyof Value]?: DeepPartial<Value[Key]> } :
  Value | undefined;
