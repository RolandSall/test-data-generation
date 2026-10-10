import { people } from '../fixtures/people.js';
import { exampleOptions } from '../../run-options.js';

export function createPerson() {
  return people.one(exampleOptions);
}
