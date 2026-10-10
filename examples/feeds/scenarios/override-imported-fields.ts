import { importedPeople } from '../fixtures/imported-people.js';
import { exampleOptions } from '../../run-options.js';

export async function overrideImportedFields() {
  return (await importedPeople()).one({ ...exampleOptions, fields: { city: 'Beirut', active: false } });
}
