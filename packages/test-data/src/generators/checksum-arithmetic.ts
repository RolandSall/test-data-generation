import type { GeneratorContext } from '../core/instructions.js';

export const DECIMAL_RADIX = 10;
export const MODULO_ELEVEN = 11;
const DECIMAL_ALPHABET = '0123456789';

export function randomDigits(context: GeneratorContext, length: number): string {
  return context.random.text(length, DECIMAL_ALPHABET);
}

/** Each weight belongs to the digit in the corresponding left-to-right position. */
export function weightedSum(payload: string, weights: readonly number[]): number {
  if (!/^\d+$/.test(payload) || payload.length !== weights.length) {
    throw new RangeError('Checksum payload must have one digit per weight');
  }
  return [...payload].reduce((total, digit, index) => total + Number(digit) * weights[index]!, 0);
}
