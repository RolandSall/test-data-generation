import type { GeneratorContext } from '../../core/instructions.js';
import { mod10Digit } from '../checksums.js';
import { DECIMAL_RADIX, MODULO_ELEVEN, randomDigits, weightedSum } from '../checksum-arithmetic.js';

const EAN13_PAYLOAD_LENGTH = 12;
const ISBN13_BOOKLAND_PREFIX = '978';
const ISBN10_CHECK_WEIGHTS = [10, 9, 8, 7, 6, 5, 4, 3, 2] as const;
const ISBN10_CHECK_TEN = 'X';
// GS1 check digits: https://www.gs1.org/services/check-digit-calculator
// ISBN rules: https://www.isbn-international.org/content/isbn-users-manual/29

export function isbn10CheckDigit(payload: string): string {
  const check = (MODULO_ELEVEN - weightedSum(payload, ISBN10_CHECK_WEIGHTS) % MODULO_ELEVEN) % MODULO_ELEVEN;
  return check === DECIMAL_RADIX ? ISBN10_CHECK_TEN : String(check);
}

export function generateEan13(context: GeneratorContext): string {
  const payload = randomDigits(context, EAN13_PAYLOAD_LENGTH);
  return payload + mod10Digit(payload);
}

export function generateIsbn13(context: GeneratorContext): string {
  const payload = ISBN13_BOOKLAND_PREFIX + randomDigits(context, EAN13_PAYLOAD_LENGTH - ISBN13_BOOKLAND_PREFIX.length);
  return payload + mod10Digit(payload);
}

export function generateIsbn10(context: GeneratorContext): string {
  const payload = randomDigits(context, ISBN10_CHECK_WEIGHTS.length);
  return payload + isbn10CheckDigit(payload);
}
