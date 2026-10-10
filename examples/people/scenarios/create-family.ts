import { fixtureRun } from '@integration-testing/test-data-generation';
import { people } from '../fixtures/people.js';
import { exampleOptions } from '../../run-options.js';

export function createFamily() {
  const run = fixtureRun(exampleOptions);
  const parent = run.make(people, { fields: { lastName: 'Hopper', preferences: { sms: false } } });
  const children = run.makeMany(people, 2, { case: 'child', fields: { lastName: parent.lastName } });
  return { parent, children };
}
