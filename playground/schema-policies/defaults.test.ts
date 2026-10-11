import { expect, test } from 'vitest';
import { defaultsDemo } from './defaults.js';
test('default policies and supplied empty strings', () => {
  const values = defaultsDemo();
  expect(values.generated.status).not.toBe('pending');
  expect(Object.hasOwn(values.generated, 'nickname')).toBe(true);
  expect(values.declared).toEqual({ status: 'pending' });
  expect(values.supplied).toEqual({ status: '', nickname: '' });
});
