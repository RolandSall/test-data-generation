import { test, expect } from '../src/adapters/vitest.js';
import { defineFixture, shape } from '../src/index.js';
const fixture = defineFixture(shape.object({ value: shape.string() }));
test('test context receives a seeded fixture session', ({ data }) => {
  expect(data.seed).toBeTypeOf('string'); expect(data.make(fixture).value).toBeTruthy();
});
test.concurrent('parallel fixture contexts have their own generators', ({ data }) => {
  expect(data.makeMany(fixture, 2)).toHaveLength(2);
});
