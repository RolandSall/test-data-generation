import { defineFixture, fixtureRun, shape, sequence } from '@integration-testing/test-data-generation';
import { runOptions } from '../run-options.js';
export function replayDemo() {
  const people = defineFixture(shape.object({ name: shape.string(), age: shape.integer() }));
  const result = people.result(runOptions);
  const replayed = people.one({ seed: result.seed, now: result.now });
  const tickets = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence() }, unique: ['id'] });
  const run = fixtureRun(runOptions);
  return { result, replayed, independent: [tickets.one(runOptions), tickets.one(runOptions)], sharedSession: [run.make(tickets), run.make(tickets)] };
}
