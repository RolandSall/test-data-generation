import { expect, test } from 'vitest';
import { overrideImportedFields, readSequentialPeople, readShuffledPeople } from './index.js';

test('keeps imported rows coherent and computes names from each row', async () => {
  const batch = await readSequentialPeople();
  expect(batch.map(({ displayName, age, city, active }) => ({ displayName, age, city, active }))).toEqual([
    { displayName: 'Ada Lovelace', age: 36, city: 'London', active: true },
    { displayName: 'Grace Hopper', age: 85, city: 'New York', active: false },
    { displayName: 'Ada Lovelace', age: 36, city: 'London', active: true },
  ]);
  expect(new Set(batch.map(person => person.id)).size).toBe(3);
});

test('replays seeded shuffle and visits each input row once per pass', async () => {
  const batch = await readShuffledPeople();
  expect(batch).toEqual(await readShuffledPeople());
  expect(new Set(batch.slice(0, 2).map(person => person.firstName))).toEqual(new Set(['Ada', 'Grace']));
  expect(batch.map(person => person.firstName)).toEqual([
    batch[0]!.firstName, batch[1]!.firstName, batch[0]!.firstName, batch[1]!.firstName,
  ]);
});

test('overrides selected feed fields while retaining other values from the row', async () => {
  const person = await overrideImportedFields();
  expect(person.displayName).toBe('Ada Lovelace');
  expect(person.age).toBe(36);
  expect(person.city).toBe('Beirut');
  expect(person.active).toBe(false);
});
