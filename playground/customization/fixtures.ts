import { defineFixture, select } from '@integration-testing/test-data-generation';
import { PersonShape } from './model.js';

const selectors = select(PersonShape);

// Neither fields nor rules: the shape describes everything that should generate.
export const automaticPeople = defineFixture(PersonShape);

// Only fields: override specific properties; all the others still generate.
export const peopleUsingFields = defineFixture(PersonShape, {
  fields: { name: 'Ada', address: { city: 'Beirut' } },
});

// Only rules: customize the same properties using renameable property references.
export const peopleUsingRules = defineFixture(PersonShape, {
  rules: [
    selectors.field(person => person.name).use('Ada'),
    selectors.field(person => person.address.city).use('Beirut'),
  ],
});

// Both: a broad rule with one specific exception supplied through fields.
export const peopleUsingBoth = defineFixture(PersonShape, {
  rules: [selectors.all('boolean', { under: person => person.preferences }).use(true)],
  fields: { preferences: { sms: false } },
});
