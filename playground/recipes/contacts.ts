import { column, defineFixture, shape, template, uuid } from '@integration-testing/test-data-generation';
import { readCsvFile } from '@integration-testing/test-data-generation/node';
import { fileURLToPath } from 'node:url';

export async function contactsFromCsv() {
  const source = await readCsvFile(fileURLToPath(new URL('../data/contacts.csv', import.meta.url)), { onEnd: 'cycle' });
  return defineFixture(shape.object({
    id: shape.string(),
    name: shape.string(),
    age: shape.integer({ min: 0, max: 120 }),
    active: shape.boolean(),
  }), {
    source,
    columns: {
      name: template('${first} ${last}'),
      age: column('age', raw => Number(raw)),
      active: 'active',
    },
    fields: { id: uuid() },
  });
}
