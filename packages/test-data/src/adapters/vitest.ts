import { test as base, expect } from 'vitest';
import { fixtureRun } from '../core/recipe.js';
export { expect };
export const test = base.extend<{ data: ReturnType<typeof fixtureRun> }>({
  data: async ({ task, onTestFailed }, use) => {
    const seed = process.env.TEST_DATA_SEED ?? `${task.file.name}:${task.name}`;
    const now = process.env.TEST_DATA_NOW;
    const run = fixtureRun({ seed, ...(now === undefined ? {} : { now }) });
    onTestFailed(({ task }) => {
      for (const error of task.result?.errors ?? []) error.message += `\nTest data replay: TEST_DATA_SEED=${JSON.stringify(seed)} TEST_DATA_NOW=${JSON.stringify(run.now.toISOString())}`;
    });
    await use(run);
  },
});
