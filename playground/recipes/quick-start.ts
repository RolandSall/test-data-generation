import { defineFixture, select, shape } from '@integration-testing/test-data-generation';

const PersonShape = shape.object({
  name: shape.string(),
  age: shape.integer({ min: 18, max: 65 }),
  active: shape.boolean(),
});
const selectors = select(PersonShape);
export const quickStartPeople = defineFixture(PersonShape, {
  rules: [selectors.field(person => person.name).use('Ada')],
});
