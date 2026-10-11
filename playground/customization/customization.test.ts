import { describe, expect, test } from 'vitest';
import { automaticPeople, peopleUsingBoth, peopleUsingFields, peopleUsingRules } from './fixtures.js';
import { quickStartPeople } from '../recipes/quick-start.js';
import { runOptions } from '../run-options.js';

describe('customization choices through the public package', () => {
  test('the small quick-start recipe generates unspecified properties', () => {
    const person = quickStartPeople.one(runOptions);
    expect(person.name).toBe('Ada');
    expect(person.age).toBeGreaterThanOrEqual(18);
    expect(person.age).toBeLessThanOrEqual(65);
    expect(person.active).toEqual(expect.any(Boolean));
    expect(person).toEqual(quickStartPeople.one(runOptions));
  });

  test('neither customization style is required to generate a complete nested model', () => {
    for (const person of automaticPeople.many(3, runOptions)) {
      expect(person.name.length).toBeGreaterThan(0);
      expect(person.age).toBeGreaterThanOrEqual(18);
      expect(person.age).toBeLessThanOrEqual(65);
      expect(person.active).toEqual(expect.any(Boolean));
      expect(person.address.city.length).toBeGreaterThan(0);
      expect(person.address.country.length).toBeGreaterThan(0);
      expect(person.preferences.email).toEqual(expect.any(Boolean));
      expect(person.preferences.sms).toEqual(expect.any(Boolean));
      expect(person.preferences.security.rememberMe).toEqual(expect.any(Boolean));
    }
  });

  test('fields-only and rules-only customize the same properties and generate the rest', () => {
    for (const recipe of [peopleUsingFields, peopleUsingRules]) {
      const person = recipe.one(runOptions);
      expect(person.name).toBe('Ada');
      expect(person.address.city).toBe('Beirut');
      expect(person.address.country.length).toBeGreaterThan(0);
      expect(person.age).toBeGreaterThanOrEqual(18);
      expect(person.age).toBeLessThanOrEqual(65);
      expect(person.preferences.security.rememberMe).toEqual(expect.any(Boolean));
    }
  });

  test('combining styles applies a general rule with a single explicit exception', () => {
    const person = peopleUsingBoth.one(runOptions);
    expect(person.preferences).toEqual({ email: true, sms: false, security: { rememberMe: true } });
    expect(person.name.length).toBeGreaterThan(0);
    expect(person.address.country.length).toBeGreaterThan(0);
  });
});
