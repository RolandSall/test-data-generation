import { defineFixture } from '@integration-testing/test-data-generation';
import { PersonDetailsShape } from '../shapes/person-details-shape.js';
import { exampleOptions } from '../../run-options.js';

export function fillPersonDetails() {
  const existing = { firstName: 'Ada', age: 0, preferences: { email: false } };
  const completed = defineFixture(PersonDetailsShape).fill(existing, exampleOptions);
  return { existing, completed };
}
