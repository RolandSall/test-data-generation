import { importedPeople } from '../fixtures/imported-people.js';
import { exampleOptions } from '../../run-options.js';

export async function readShuffledPeople() {
  return (await importedPeople({ access: 'shuffle' })).many(4, exampleOptions);
}
