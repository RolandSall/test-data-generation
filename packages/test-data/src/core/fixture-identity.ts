import type { Fixture } from './recipe.js';

const fixtures = new WeakSet<object>();

/** Recognize constructed fixtures without importing the recipe class at runtime. */
export function registerFixture(fixture: object): void { fixtures.add(fixture); }

export function isFixture(value: unknown): value is Fixture<unknown> {
  return typeof value === 'object' && value !== null && fixtures.has(value);
}
