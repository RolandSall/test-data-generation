/** Override these values as a whole; field trees and dotted paths stop here. */
export type LeafValue =
  | Date
  | readonly unknown[]
  | Map<unknown, unknown>
  | Set<unknown>;
