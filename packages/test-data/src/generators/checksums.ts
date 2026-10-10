import { generator, type Generator } from '../core/instructions.js';
import { randomDigits, DECIMAL_RADIX, MODULO_ELEVEN } from './checksum-arithmetic.js';

const LUHN_DOUBLE = 2;
const LUHN_DIGIT_FOLD = DECIMAL_RADIX - 1;
const GS1_ODD_POSITION_WEIGHT = 3;
const GS1_EVEN_POSITION_WEIGHT = 1;
const DEFAULT_MOD11_MAX_WEIGHT = 7;
const MOD11_FIRST_WEIGHT = 2;

export function luhnDigit(payload: string): number {
  if (!/^\d+$/.test(payload)) throw new RangeError('Luhn payload must contain digits');
  let total = 0;
  for (let index = payload.length - 1, position = 0; index >= 0; index--, position++) {
    let digit = Number(payload[index]);
    if (position % LUHN_DOUBLE === 0) {
      digit *= LUHN_DOUBLE;
      if (digit >= DECIMAL_RADIX) digit -= LUHN_DIGIT_FOLD;
    }
    total += digit;
  }
  return (DECIMAL_RADIX - total % DECIMAL_RADIX) % DECIMAL_RADIX;
}

/** GS1 default: alternating 3/1 weights, starting at the rightmost payload digit. */
export function mod10Digit(payload: string, multiplier = GS1_ODD_POSITION_WEIGHT, weight = GS1_EVEN_POSITION_WEIGHT): number {
  if (!/^\d+$/.test(payload)) throw new RangeError('Mod10 payload must contain digits');
  const total = [...payload].reverse().reduce((sum, digit, index) =>
    sum + Number(digit) * (index % 2 ? weight : multiplier), 0,
  );
  return (DECIMAL_RADIX - total % DECIMAL_RADIX) % DECIMAL_RADIX;
}

/** Cycling weights from 2 to the threshold; complements of 10 or 11 become zero. */
export function mod11Digit(payload: string, threshold = DEFAULT_MOD11_MAX_WEIGHT): number {
  if (!/^\d+$/.test(payload) || threshold < MOD11_FIRST_WEIGHT) throw new RangeError('Invalid Mod11 parameters');
  const total = [...payload].reverse().reduce((sum, digit, index) =>
    sum + Number(digit) * (MOD11_FIRST_WEIGHT + index % (threshold - 1)), 0,
  );
  const complement = MODULO_ELEVEN - total % MODULO_ELEVEN;
  return complement >= DECIMAL_RADIX ? 0 : complement;
}

export const checksum = (kind: 'luhn' | 'mod10' | 'mod11', length = 12): Generator<string> => {
  if (!Number.isSafeInteger(length) || length < 2) throw new RangeError('Checksum length must be at least two');
  return generator(context => {
    const payload = randomDigits(context, length - 1);
    const check = kind === 'luhn' ? luhnDigit(payload) : kind === 'mod10' ? mod10Digit(payload) : mod11Digit(payload);
    return payload + check;
  });
};
