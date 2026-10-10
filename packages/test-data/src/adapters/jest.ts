import { test, expect } from '@jest/globals';
import { Fixture, fixtureRun, isFixture, type RunOptions } from '../core/recipe.js';
export { expect };
type Given<F> = { [K in keyof F]: F[K] extends Fixture<infer T> ? T : never };
export function given<F extends Record<string, unknown>>(name: string, fixtures: F, body: (data: Given<F>) => void | Promise<void>, options: RunOptions = {}): void {
  test(name, async () => {
    const seed = options.seed ?? process.env.TEST_DATA_SEED ?? name;
    const now = options.now ?? process.env.TEST_DATA_NOW;
    const run = fixtureRun({ ...options, seed, ...(now === undefined ? {} : { now }) });
    const result: Record<string, unknown> = {};
    try {
      for (const [key, fixture] of Object.entries(fixtures)) {
        if (!isFixture(fixture)) throw new TypeError(`Given value ${key} must be a fixture recipe`);
        result[key] = run.make(fixture);
      }
      await body(result as Given<F>);
    }
    catch (error) { if (error instanceof Error) error.message += `\nTest data replay: seed=${JSON.stringify(seed)} TEST_DATA_SEED=${JSON.stringify(seed)} TEST_DATA_NOW=${JSON.stringify(run.now.toISOString())}`; throw error; }
  });
}
