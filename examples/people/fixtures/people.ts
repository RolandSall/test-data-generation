import { defineFixture, generator, integer, uuid } from '@integration-testing/test-data-generation';
import { PersonShape } from '../shapes/person-shape.js';

export const people = defineFixture(PersonShape, {
  fields: {
    id: uuid(),
    firstName: generator(({ random }) => random.pick(['Ada', 'Grace', 'Linus'])),
    lastName: generator(({ random }) => random.pick(['Lovelace', 'Hopper', 'Torvalds'])),
    age: integer({ min: 18, max: 65 }),
    home: { city: 'Beirut' },
  },
  rules: [{ match: { kind: 'boolean', under: 'preferences' }, use: true }],
  cases: {
    child: { fields: { age: integer({ min: 3, max: 15 }) } },
  },
});
