import { defineFixture, type Fixture, type RecipeConfig } from '../core/recipe.js';
import { constrain, shape, type Shape } from '../core/shape.js';
export function listOf<T>(element: Shape<T>, options: RecipeConfig<T> & { count?: number; min?: number; max?: number; unique?: never } = {}): Fixture<T[]> {
  const collection = constrain(shape.array(element), { minSize: options.count ?? options.min ?? 2, maxSize: options.count ?? options.max ?? Math.max(options.min ?? 2, 6) });
  return defineFixture(collection, { rules: [{ match: { path: '*' }, use: defineFixture(element, options) }] });
}
