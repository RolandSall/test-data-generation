import { expect, test } from 'vitest';
import { selectiveDemo } from './selective.js';
test('full generation is default; explicit selection excludes unselected properties', () => {
  const result = selectiveDemo();
  expect(Object.hasOwn(result.full, 'tags')).toBe(true);
  expect(result.selected).toEqual({ name: 'Ada', age: 18, address: { city: 'Beirut' } });
  expect(Object.hasOwn(result.selected.address!, 'zip')).toBe(false);
  expect(result.blank).toEqual({ address: {}, tags: [] });
});
