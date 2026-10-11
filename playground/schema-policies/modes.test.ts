import { expect, test } from 'vitest';
import { modesDemo } from './modes.js';
test('raw input and parsed output with nested transforms', () => {
  const result = modesDemo();
  expect(result.raw).toEqual({ order: { amount: '42' } });
  expect(result.output).toEqual({ order: { amount: 42 } });
  expect(result.parsedByCaller).toEqual(result.output);
});
