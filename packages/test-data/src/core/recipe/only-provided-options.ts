import type { RunOptions } from './run-options.js';
/** Select properties from merged recipe/call fields, returning a partial data object. */
export interface OnlyProvidedOptions<Model = unknown> extends Omit<RunOptions<Model>, 'onlyProvided'> {
  onlyProvided: true;
}
