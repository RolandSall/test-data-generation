import { defineFixture, GenerationError, select, shape, type Fields } from '@integration-testing/test-data-generation';
import { Animal } from './models/animal.js';
import { Dog } from './models/dog.js';
import { dogs, households } from './fixtures.js';
import { DogInput } from './shapes.js';
import { runOptions } from '../run-options.js';

export function inheritanceDemo() {
  const dog = dogs.one(runOptions);
  return { dog, isAnimal: dog instanceof Animal, isDog: dog instanceof Dog, description: dog.describe() };
}

export function polymorphismDemo() {
  const household = households.one(runOptions);
  return { owner: household.owner, pets: household.pets.map(pet => ({
    ...pet, isAnimal: pet instanceof Animal, description: pet.describe(),
  })) };
}

export function unknownFieldsDemo() {
  const errors: Record<string, string> = {};
  const capture = (label: string, action: () => unknown) => {
    try { action(); } catch (error) {
      if (!(error instanceof GenerationError)) throw error;
      errors[label] = error.message;
    }
  };
  // These casts deliberately simulate untyped JavaScript or external configuration.
  capture('fieldOverride', () => dogs.one({ ...runOptions, fields: { missing: true } as Fields<Dog> }));
  capture('typedSelector', () => select(DogInput).field('missing' as 'name'));
  capture('rawRule', () => defineFixture(shape.object({ name: shape.string() }), {
    rules: [{ match: { path: 'missing' }, use: true }],
  }).one(runOptions));
  return { existingField: dogs.one({ ...runOptions, fields: { name: 'Buddy' } }).name, errors };
}
