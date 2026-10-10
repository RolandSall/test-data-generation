import { expect, test } from 'vitest';
import { Person, createPerson, createFamily, fillPersonDetails, people } from './index.js';
import { exampleOptions } from '../run-options.js';

test('creates real Person instances with methods and generated nested data', () => {
  const person = createPerson();
  expect(person).toBeInstanceOf(Person);
  expect(person.fullName).toBe(`${person.firstName} ${person.lastName}`);
  expect(person.isAdult()).toBe(true);
  expect(person.home.city).toBe('Beirut');
  expect(person.home.postalCode).toMatch(/^\d{5}$/);
  expect(person.contacts).toHaveLength(2);
  for (const contact of person.contacts) {
    expect(contact.value).toMatch(contact.kind === 'phone' ? /^\+[1-9]\d{9}$/ : /^[^@]+@[^@]+\.test$/);
  }
  expect(person).toEqual(createPerson());
});

test('applies boolean rules deeply while preserving an explicit override', () => {
  const person = people.one({ ...exampleOptions, fields: { preferences: { sms: false } } });
  expect(person.preferences).toEqual({
    email: true, sms: false, security: { rememberMe: true, requireTwoFactor: true },
  });
});

test('creates related adults and children with a shared surname in one session', () => {
  const { parent, children } = createFamily();
  expect(parent.isAdult()).toBe(true);
  expect(children).toHaveLength(2);
  for (const child of children) {
    expect(child).toBeInstanceOf(Person);
    expect(child.isAdult()).toBe(false);
    expect(child.lastName).toBe(parent.lastName);
  }
  expect(new Set([parent.id, ...children.map(child => child.id)]).size).toBe(3);
});

test('fills existing details in place and preserves zero and false', () => {
  const { existing, completed } = fillPersonDetails();
  expect(completed).toBe(existing);
  expect(completed.firstName).toBe('Ada');
  expect(completed.age).toBe(0);
  expect(completed.preferences.email).toBe(false);
  expect(completed.home.postalCode).toMatch(/^\d{5}$/);
});
