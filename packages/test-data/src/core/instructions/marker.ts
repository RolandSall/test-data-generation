import type { Generator } from './generator.js';
import type { Operation } from './operations.js';

export const instruction = Symbol.for('@integration-testing/test-data-generation/instruction');

export function isInstruction(value: unknown): value is Generator<unknown> | Operation<unknown> {
  return typeof value === 'object' && value !== null && instruction in value;
}
