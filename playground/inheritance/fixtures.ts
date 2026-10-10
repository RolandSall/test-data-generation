import { defineFixture, select, shape, uuid } from '@integration-testing/test-data-generation';
import type { Dog } from './models/dog.js';
import type { Cat } from './models/cat.js';
import { DogShape, CatShape, HouseholdShape } from './shapes.js';

const dog = select(DogShape);
export const dogs = defineFixture(DogShape, { rules: [
  dog.field(animal => animal.id).use(uuid()),
  dog.field(animal => animal.name).use('Rex'),
  dog.all('boolean').use(true),
] });
export const cats = defineFixture(CatShape, { fields: { name: 'Misty', lives: 9 } });
const household = select(HouseholdShape);
export const households = defineFixture(HouseholdShape, { rules: [
  household.field(home => home.owner.name).use('Ada'),
  household.all('boolean').use(true),
] });
export const dogHouseholds = defineFixture(HouseholdShape, {
  // Registering this concrete shape forces every element to be a Dog.
  fields: { pets: defineFixture(shape.array<Dog | Cat>(DogShape, { minSize: 8, maxSize: 8 })) },
});
