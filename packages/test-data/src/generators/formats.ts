import { generator, type Generator } from '../core/instructions.js';
import { date, email, ipv4, url, uuid } from './values.js';
import { checksum, luhnDigit } from './checksums.js';
import { checksumId, IDENTIFIER_KINDS } from './identifiers/index.js';
import { randomDigits } from './checksum-arithmetic.js';
export { checksum, luhnDigit, mod10Digit, mod11Digit } from './checksums.js';
export { checksumId, type Identifier } from './identifiers/index.js';

const VISA_PREFIX = '4';
const VISA_PAYLOAD_RANDOM_LENGTH = 14;
export const creditCard = (): Generator<string> => generator(context => {
  const payload = VISA_PREFIX + randomDigits(context, VISA_PAYLOAD_RANDOM_LENGTH);
  return payload + luhnDigit(payload);
});

export const currency = (): Generator<string> => generator(c => c.random.pick(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL', 'PLN', 'LBP']));
export const atomicInteger = (): Generator<Int32Array> => generator(c => { const array = new Int32Array(new SharedArrayBuffer(4)); Atomics.store(array, 0, c.random.int(-2147483648, 2147483647)); return array; });
export const atomicBigint = (): Generator<BigInt64Array> => generator(c => { const array = new BigInt64Array(new SharedArrayBuffer(8)); Atomics.store(array, 0, c.random.bigint(-(2n ** 63n), 2n ** 63n - 1n)); return array; });
export type TemporalKind = 'instant' | 'localDate' | 'localDateTime' | 'localTime' | 'offsetDateTime' | 'offsetTime' | 'zonedDateTime' | 'year' | 'yearMonth' | 'duration' | 'period';
export function temporal(kind: TemporalKind, options: Parameters<typeof date>[0] = {}): Generator<string> {
  return generator(c => {
    const iso = date(options).generate(c).toISOString();
    switch (kind) {
      case 'instant': case 'offsetDateTime': return iso;
      case 'zonedDateTime': return `${iso}[UTC]`;
      case 'localDate': return iso.slice(0, 10);
      case 'localDateTime': return iso.slice(0, -1);
      case 'localTime': return iso.slice(11, -1);
      case 'offsetTime': return iso.slice(11);
      case 'year': return iso.slice(0, 4);
      case 'yearMonth': return iso.slice(0, 7);
      case 'duration': return `PT${c.random.int(1, 86400)}S`;
      case 'period': return `P${c.random.int(1, 365)}D`;
    }
  });
}
export function formatGenerator(format: string): Generator<string> | undefined {
  const known: Record<string, () => Generator<string>> = { email, uuid, url, uri: url, ipv4,
    'credit-card': creditCard, luhn: () => checksum('luhn'), mod10: () => checksum('mod10'), mod11: () => checksum('mod11'),
    date: () => temporal('localDate'), 'date-time': () => temporal('instant'), time: () => temporal('offsetTime'),
    duration: () => temporal('duration'), currency };
  if (known[format]) return known[format]();
  const id = IDENTIFIER_KINDS.find(id => id.toLowerCase() === format.toLowerCase());
  return id ? checksumId({ kind: id }) : undefined;
}
