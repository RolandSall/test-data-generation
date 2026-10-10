import { column, defineFixture, uuid, type FeedOptions } from '@integration-testing/test-data-generation';
import { readCsvFile } from '@integration-testing/test-data-generation/node';
import { fileURLToPath } from 'node:url';
import { ImportedPersonShape } from '../shapes/imported-person-shape.js';

export async function importedPeople(options: FeedOptions = {}) {
  const source = await readCsvFile(fileURLToPath(new URL('../data/people.csv', import.meta.url)), {
    onEnd: 'cycle', ...options,
  });
  return defineFixture(ImportedPersonShape, {
    source,
    columns: {
      firstName: 'first', lastName: 'last', age: column('age', raw => Number(raw)),
      city: 'city', active: 'active',
    },
    fields: { id: uuid() },
    computed: ({ derive }) => ({
      displayName: derive(['firstName', 'lastName'], (first, last) => `${first} ${last}`),
    }),
  });
}
