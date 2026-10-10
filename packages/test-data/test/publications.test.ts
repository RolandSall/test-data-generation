import { describe, expect, test } from 'vitest';
import validator from 'validator';
import { sample, checksumId, mod10Digit, type Identifier } from '../src/index.js';
import { isbn10CheckDigit } from '../src/generators/identifiers/publications.js';
import { weightedSum } from '../src/generators/checksum-arithmetic.js';

describe('publication checksum vectors', () => {
  // https://support.gs1.org/support/solutions/articles/43000734165-how-is-an-isbn-used-in-a-gs1-barcode-
  test('ISBN-13 uses the GS1 check digit and ISBN-10 uses its own algorithm', () => {
    expect(mod10Digit('978047138429')).toBe(8);
    expect(isbn10CheckDigit('047138429')).toBe('1');
    const withX = '080442957' + isbn10CheckDigit('080442957');
    expect(withX).toBe('080442957X');
    expect(validator.isISBN(withX, '10')).toBe(true);
  });
  test('incorrect payload lengths fail before arithmetic produces NaN', () => {
    expect(() => weightedSum('12', [1])).toThrow('one digit per weight');
    expect(() => weightedSum('1x', [1, 2])).toThrow('one digit per weight');
  });
});

const preRefactorSamples: Record<Identifier, readonly string[]> = {
  EAN: ['7653591339139', '3449556414676', '7459552563960'],
  ISBN: ['9787653591338', '9789133449559', '9786414677458'],
  ISBN10: ['7653591337', '9133449554', '6414677450'],
};

describe('publication generation preserves seeded data', () => {
  test.each(Object.entries(preRefactorSamples))('%s produces the same pre-refactor sequence', (kind, expected) => {
    expect(sample(checksumId({ kind: kind as Identifier }), {
      seed: 42, now: '2026-01-01T00:00:00Z', count: 3,
    })).toEqual(expected);
  });
});
