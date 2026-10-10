import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineFixture, sequence, shape } from '../src/index.js';
const registry = vi.hoisted(() => [] as { name: string; body: () => Promise<void> }[]);
vi.mock('@jest/globals', () => ({ test: (name: string, body: () => Promise<void>) => registry.push({ name, body }), expect }));
import { given } from '../src/adapters/jest.js';
beforeEach(() => { registry.splice(0); });
describe('Jest registration and fixture context', () => {
  test('registers typed generated arguments with an isolated session', async () => {
    const fixture = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() } });
    given('session', { first: fixture, second: fixture }, ({ first, second }) => { expect(first.id).toBe(1); expect(second.id).toBe(2); }, { seed: 42 });
    expect(registry[0]!.name).toBe('session'); await registry[0]!.body();
  });
  test('body failures retain their error and gain replay context', async () => {
    const error = new Error('intentional'); given('failure', {}, () => { throw error; }, { seed: 8532 });
    await expect(registry[0]!.body()).rejects.toBe(error); expect(error.message).toContain('seed=8532');
  });
  test('rejects non-recipe arguments clearly', async () => { given('bad', { bad: 3 }, () => {}); await expect(registry[0]!.body()).rejects.toThrow('must be a fixture'); });
});
