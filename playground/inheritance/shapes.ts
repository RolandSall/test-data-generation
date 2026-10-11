import { shape } from '@integration-testing/test-data-generation';
import { Dog } from './models/dog.js';
import { Cat } from './models/cat.js';

// Inherited constructor arguments are explicit runtime metadata, shared by both subtypes.
const animalFields = { id: shape.string(), name: shape.string({ minLength: 1 }), active: shape.boolean() };
export const DogInput = shape.object({ ...animalFields, trained: shape.boolean() });
export const CatInput = shape.object({ ...animalFields, lives: shape.integer({ min: 1, max: 9 }) });
export const DogShape = shape.transform(DogInput, data => new Dog(data.id, data.name, data.active, data.trained));
export const CatShape = shape.transform(CatInput, data => new Cat(data.id, data.name, data.active, data.lives));
export const AnimalShape = shape.union([DogShape, CatShape]);
export const HouseholdShape = shape.object({
  owner: shape.object({ name: shape.string(), preferences: shape.object({ email: shape.boolean() }) }),
  pets: shape.array(AnimalShape, { minSize: 8, maxSize: 8 }),
});
