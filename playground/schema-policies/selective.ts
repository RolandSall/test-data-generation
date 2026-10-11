import { defineFixture, shape, integer } from '@integration-testing/test-data-generation';
import { runOptions } from '../run-options.js';
const people = defineFixture(shape.object({ name: shape.string(), age: shape.integer(),
  address: shape.object({ city: shape.string(), zip: shape.string() }), tags: shape.array(shape.string()) }));
export function selectiveDemo() {
  return {
    full: people.one({ ...runOptions, fields: { name: 'Ada' } }),
    selected: people.one({ seed: runOptions.seed, now: runOptions.now, onlyProvided: true,
      fields: { name: 'Ada', age: integer({ min: 18, max: 18 }), address: { city: 'Beirut' } } }),
    blank: people.blank({ seed: runOptions.seed }),
  };
}
