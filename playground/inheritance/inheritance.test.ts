import { describe, expect, test } from 'vitest';
import { defineFixture, select } from '@integration-testing/test-data-generation';
import { Animal } from './models/animal.js';
import { Dog } from './models/dog.js';
import { Cat } from './models/cat.js';
import type { NamedAnimal } from './models/named-animal.js';
import { dogs, cats, households, dogHouseholds } from './fixtures.js';
import { CatShape } from './shapes.js';
import { unknownFieldsDemo } from './scenarios.js';
import { runOptions } from '../run-options.js';

describe('inheritance and polymorphism through the public package', () => {
  test('constructs subclasses with inherited fields and overridden behavior', () => {
    const dog = dogs.one(runOptions);
    expect(dog).toBeInstanceOf(Dog);
    expect(dog).toBeInstanceOf(Animal);
    expect(dog.name).toBe('Rex');
    expect(dog.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(dog.active).toBe(true);
    expect(dog.trained).toBe(true);
    expect(dog.describe()).toBe('Rex: Sit, then woof!');
    const contract: NamedAnimal = cats.one(runOptions);
    expect(contract).toBeInstanceOf(Cat);
    expect(contract.speak()).toBe('Meow!');
  });

  test('generates both registered subtypes inside nested collections deterministically', () => {
    const first = households.many(8, runOptions);
    expect(first).toEqual(households.many(8, runOptions));
    const pets = first.flatMap(household => household.pets);
    expect(pets.some(pet => pet instanceof Dog)).toBe(true);
    expect(pets.some(pet => pet instanceof Cat)).toBe(true);
    for (const pet of pets) {
      expect(pet).toBeInstanceOf(Animal);
      expect(pet.active).toBe(true);
      if (pet instanceof Dog) expect(pet.trained).toBe(true);
      else expect(pet.lives).toBeGreaterThanOrEqual(1);
      expect(pet.describe()).toContain(pet.speak());
    }
    expect(first[0]!.owner.preferences.email).toBe(true);
  });

  test('forces one concrete subtype using a nested fixture', () => {
    for (const pet of dogHouseholds.one(runOptions).pets) expect(pet).toBeInstanceOf(Dog);
    expect(cats.one({ ...runOptions, fields: { name: 'Luna' } }).name).toBe('Luna');
  });

  test('runs constructor guards instead of bypassing domain invariants', () => {
    expect(() => defineFixture(CatShape, { rules: [select(CatShape).field(cat => cat.lives).use(20)] }).one(runOptions)).toThrow(/Lives must be between 1 and 9/);
  });

  test('overrides existing inherited fields and reports three kinds of unknown field', () => {
    const result = unknownFieldsDemo();
    expect(result.existingField).toBe('Buddy');
    expect(result.errors.fieldOverride).toContain('CONFIGURATION: Unknown field missing');
    expect(result.errors.typedSelector).toContain('CONFIGURATION: Unknown selectable field missing');
    expect(result.errors.rawRule).toContain('UNUSED_RULE');
  });
});
