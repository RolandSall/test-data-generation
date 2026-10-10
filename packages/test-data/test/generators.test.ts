import { describe, expect, test } from 'vitest';
import validator from 'validator';
import { Random, sample, integer, number, bigint, boolean, text, uuid, email, url, ipv4, date, decimal, Decimal, regex, pattern, sequence, emit, oneOf, weighted, mapValue, nullable, shuffled, hash, coordinate, word, lorem, wordTemplate, checksum, checksumId, creditCard, currency, atomicInteger, temporal } from '../src/index.js';
const options = { seed: 42, now: '2026-01-01Z', count: 100 };
describe('independent seeded random sources', () => {
  test('replay, forks and interleaved source isolation', () => {
    const a = new Random(42), b = new Random(42), other = new Random(7);
    for (let i = 0; i < 100; i++) { other.next(); expect(a.uint32()).toBe(b.uint32()); }
    expect(a.fork('test').next()).toBe(b.fork('test').next()); expect(a.fork('first').next()).not.toBe(a.fork('second').next());
  });
  test('closed integer ranges include zero, negatives and large safe values', () => {
    const r = new Random('bounds'); expect(r.int(0, 0)).toBe(0); expect(r.int(-8, -8)).toBe(-8);
    const values = Array.from({ length: 1000 }, () => r.int(-1, 1)); expect(new Set(values)).toEqual(new Set([-1, 0, 1]));
    for (let i = 0; i < 100; i++) { const n = r.int(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER); expect(Number.isSafeInteger(n)).toBe(true); }
  });
  test('arbitrary precision bigint bounds avoid floating-point conversion', () => {
    const r = new Random(42), min = 10n ** 50n, max = min + 1000n;
    for (let i = 0; i < 100; i++) { const n = r.bigint(min, max); expect(n >= min && n <= max).toBe(true); }
    expect(r.bigint(0n, 0n)).toBe(0n);
  });
  test('float and Bernoulli domains', () => { const r = new Random(42); expect(r.boolean(0)).toBe(false); expect(r.boolean(1)).toBe(true); expect(r.float(2, 2)).toBe(2); for (let i = 0; i < 100; i++) expect(r.next()).toBeLessThan(1); });
  test.each([() => new Random(NaN), () => new Random(1.5), () => new Random(0).int(2, 1), () => new Random(0).int(0, 1.5), () => new Random(0).bigint(3n, 2n), () => new Random(0).float(0, Infinity), () => new Random(0).boolean(2), () => new Random(0).pick([]), () => new Random(0).text(-1), () => new Random(0).text(1, '')])('invalid random parameters reject', action => expect(action).toThrow());
});
describe('value generators and execution state', () => {
  test('numeric generators and mapped output', () => { expect(sample(integer({ min: 1, max: 1 }))).toEqual([1]); expect(sample(number({ min: -1, max: -1 }))).toEqual([-1]); expect(sample(bigint({ min: 10n, max: 10n }))).toEqual([10n]); expect(sample(boolean(1))).toEqual([true]); expect(sample(mapValue(integer({ min: 3, max: 3 }), n => n * 2))).toEqual([6]); });
  test('text alphabets, patterns and regex construction', () => {
    sample(text({ length: 4, alphabet: 'ab' }), options).forEach(v => expect(v).toMatch(/^[ab]{4}$/));
    expect(sample(pattern('#d#d-#C#C-##'))[0]).toMatch(/^\d{2}-[A-Z]{2}-#$/);
    sample(regex(/^(foo|bar)-[A-Z]{2}\d{3}$/), options).forEach(v => expect(v).toMatch(/^(foo|bar)-[A-Z]{2}\d{3}$/)); expect(() => sample(pattern('#Z'))).toThrow('Unknown pattern');
  });
  test('emit cycles or fails; sequence advances inside a context', () => {
    expect(sample(sequence({ start: 10, step: 2 }), { count: 3 })).toEqual([10, 12, 14]);
    expect(sample(emit(['A', 'B'], { onEnd: 'cycle' }), { count: 5 })).toEqual(['A', 'B', 'A', 'B', 'A']); expect(() => sample(emit(['A']), { count: 2 })).toThrow('exhausted'); expect(() => emit([])).toThrow();
  });
  test('weighted choice, null injection and shuffle preserve domains', () => {
    expect(sample(weighted([{ value: 'never', weight: 0 }, { value: 'always', weight: 1 }]), { count: 20 })).toEqual(Array(20).fill('always'));
    expect(sample(nullable(oneOf(['x']), 1))).toEqual([null]); expect(new Set(sample(shuffled([1, 2, 3]))[0])).toEqual(new Set([1, 2, 3])); expect(() => weighted([{ value: 1, weight: -1 }])).toThrow();
  });
  test('network and identifier values pass independent validation', () => {
    sample(uuid(), options).forEach(v => expect(validator.isUUID(v, 4)).toBe(true)); sample(email(), options).forEach(v => expect(validator.isEmail(v)).toBe(true));
    sample(ipv4(), options).forEach(v => expect(validator.isIP(v, 4)).toBe(true)); sample(url({ host: 'example.test', port: 8443 }), options).forEach(v => expect(new URL(v).port).toBe('8443'));
  });
  test('explicit date bounds and injected past/future clocks', () => {
    const fixed = new Date('2020-01-01Z'); expect(sample(date({ min: fixed, max: fixed }), options)[0]).toEqual(fixed);
    sample(date({ past: true }), options).forEach(v => expect(v.getTime()).toBeLessThan(Date.parse(options.now))); sample(date({ future: true }), options).forEach(v => expect(v.getTime()).toBeGreaterThan(Date.parse(options.now)));
  });
  test('decimal precision, scale and exact bigint bounds', () => {
    const values = sample(decimal({ precision: 30, scale: 8 }), options); expect(values.some(v => v.units > BigInt(Number.MAX_SAFE_INTEGER))).toBe(true); values.forEach(v => expect(v.scale).toBe(8));
    expect(sample(decimal({ min: Decimal.parse('1.00'), max: Decimal.parse('1.00'), scale: 2 }))[0]!.toString()).toBe('1.00');
    expect(() => decimal({ scale: 3, precision: 2 })).toThrow(); expect(() => Decimal.parse('bad')).toThrow();
  });
  test('hash, coordinates, currency, words and atomic wrapper', () => {
    expect(sample(hash('sha256'))[0]).toMatch(/^[a-f0-9]{64}$/); const p = sample(coordinate())[0]!; expect(Math.abs(p.latitude)).toBeLessThanOrEqual(90); expect(Math.abs(p.longitude)).toBeLessThanOrEqual(180);
    expect(sample(currency())[0]).toMatch(/^[A-Z]{3}$/); expect(sample(word())[0]).toBeTruthy(); expect(sample(lorem(5))[0]!.split(' ')).toHaveLength(5); expect(sample(wordTemplate('Hello {word}'))[0]).toMatch(/^Hello \w+$/);
    const atomic = sample(atomicInteger())[0]!; const before = Atomics.load(atomic, 0); expect(Atomics.add(atomic, 0, 1)).toBe(before);
  });
  test.each(['instant', 'localDate', 'localDateTime', 'localTime', 'offsetDateTime', 'offsetTime', 'year', 'yearMonth', 'duration', 'period'] as const)('temporal %s is seeded', kind => {
    const value = sample(temporal(kind), options); expect(value).toEqual(sample(temporal(kind), options)); expect(value.every(v => v.length > 0)).toBe(true);
  });
});
describe('checksum formats verified independently', () => {
  test.each(['EAN', 'ISBN', 'ISBN10'] as const)('%s passes validator.js barcode/book checks', kind => {
    sample(checksumId({ kind }), options).forEach(v => expect(kind === 'EAN' ? validator.isEAN(v) : validator.isISBN(v)).toBe(true));
  });
  test('credit-card and generic Luhn values pass validator.js', () => { sample(creditCard(), options).forEach(v => expect(validator.isCreditCard(v)).toBe(true)); sample(checksum('luhn'), options).forEach(v => expect(validator.isLuhnNumber(v)).toBe(true)); });
  test('generic mod10 and mod11 checksums', () => {
    sample(checksum('mod10'), options).forEach(v => expect(validator.isEAN(`0${v}`)).toBe(true)); expect(sample(checksum('mod11'), options).every(v => /^\d{12}$/.test(v))).toBe(true);
  });
});
