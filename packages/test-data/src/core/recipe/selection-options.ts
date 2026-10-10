import { GenerationError } from '../error.js';
import type { RunOptions } from './run-options.js';
import type { OnlyProvidedOptions } from './only-provided-options.js';
import type { FixtureOverrides } from './contracts.js';
import type { OnlyProvidedOverrides } from './only-provided-overrides.js';

export function selectionOptions<T>(options: RunOptions<T> | OnlyProvidedOptions<T>) {
  const { onlyProvided, ...runOptions } = options;
  if (onlyProvided !== undefined && typeof onlyProvided !== 'boolean') throw new GenerationError('CONFIGURATION', 'onlyProvided must be a boolean');
  return { runOptions, mode: onlyProvided ? 'provided' as const : 'generate' as const };
}
export function selectionOverrides<T>(overrides: FixtureOverrides<T> | OnlyProvidedOverrides<T>) {
  for (const key of Object.keys(overrides)) {
    if (!['case', 'fields', 'check', 'strict', 'onlyProvided'].includes(key)) throw new GenerationError('CONFIGURATION', `Session option ${key} belongs on fixtureRun()`);
  }
  return selectionOptions(overrides);
}
