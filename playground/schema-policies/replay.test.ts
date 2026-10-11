import { expect, test } from 'vitest';
import { replayDemo } from './replay.js';
test('result replay and isolated versus shared execution state', () => {
  const result = replayDemo();
  expect(result.replayed).toEqual(result.result.value);
  expect(result.independent).toEqual([{ id: 1 }, { id: 1 }]);
  expect(result.sharedSession).toEqual([{ id: 1 }, { id: 2 }]);
});
