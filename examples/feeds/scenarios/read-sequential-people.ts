import { importedPeople } from '../fixtures/imported-people.js';
import { exampleOptions } from '../../run-options.js';

export async function readSequentialPeople() {
  return (await importedPeople()).many(3, exampleOptions);
}
