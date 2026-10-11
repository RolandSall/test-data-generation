import { defineFixture, fixtureRun, GenerationError, sequence, shape } from '@integration-testing/test-data-generation';
import { describe, expect, test } from 'vitest';
import { orders } from './recipes/orders.js';
import { contactsFromCsv } from './recipes/contacts.js';
import { AccountSchema, accounts } from './recipes/accounts.js';
import { runOptions } from './run-options.js';
import { propertyOrders } from './recipes/property-selectors.js';
import { Customer } from './models/customer.js';

describe('public package playground', () => {
  test('property selectors generate an actual nested Customer with typed class references', () => {
    const first = propertyOrders.one(runOptions);
    expect(first).toEqual(propertyOrders.one(runOptions));
    expect(first.customer).toBeInstanceOf(Customer);
    expect(first.customer.name).toBe('Ada');
    expect(first.customer.age).toBeGreaterThanOrEqual(18);
    expect(first.customer.age).toBeLessThanOrEqual(65);
    expect(first.customer.greet()).toBe('Hello, Ada');
    expect(first.preferences).toEqual({ email: true, security: { rememberMe: true } });
  });
  test('generates nested orders and replays seed and clock exactly', () => {
    const first = orders.one(runOptions);
    expect(first).toEqual(orders.one(runOptions));
    expect(first.customer.address.city).toBe('Beirut');
    expect(first.customer.address.postalCode).not.toBe('');
    expect(['Ada', 'Grace', 'Linus']).toContain(first.customer.name);
    expect(first.items).toHaveLength(2);
    expect(first.createdAt).toBeInstanceOf(Date);
  });

  test('matches booleans throughout a subtree and allows individual overrides', () => {
    const order = orders.one({ ...runOptions, fields: { customer: { preferences: { sms: false } } } });
    expect(order.customer.preferences).toEqual({ email: true, sms: false, security: { rememberMe: true } });
  });

  test('derives each order total and cancellation flag in a batch', () => {
    const batch = orders.many(4, { ...runOptions, case: 'cancelled' });
    expect(new Set(batch.map(order => order.id)).size).toBe(4);
    for (const order of batch) {
      expect(order.refunded).toBe(true);
      expect(order.total).toBe(order.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    }
    expect(orders.one({ ...runOptions, case: 'shipped' }).refunded).toBe(false);
  });

  test('reads coherent CSV rows, converts columns and cycles within a batch', async () => {
    const contacts = await contactsFromCsv();
    const batch = contacts.many(3, runOptions);
    expect(batch.map(({ name, age, active }) => ({ name, age, active }))).toEqual([
      { name: 'Ada Lovelace', age: 36, active: true },
      { name: 'Grace Hopper', age: 85, active: false },
      { name: 'Ada Lovelace', age: 36, active: true },
    ]);
    expect(new Set(batch.map(contact => contact.id)).size).toBe(3);
    expect(contacts.many(3, runOptions)).toEqual(batch);
    expect(contacts.one({ ...runOptions, fields: { name: 'Custom name' } }).name).toBe('Custom name');
  });

  test('advances a sequence in an explicit session and resets in a new session', () => {
    const tickets = defineFixture(shape.object({ id: shape.integer() }), { fields: { id: sequence({ start: 100 }) } });
    const run = fixtureRun(runOptions);
    expect([run.make(tickets).id, run.make(tickets).id, run.make(tickets).id]).toEqual([100, 101, 102]);
    expect(fixtureRun(runOptions).make(tickets).id).toBe(100);
  });

  test('generates accounts that pass the original Zod schema', () => {
    for (const account of accounts.many(10, runOptions)) {
      expect(AccountSchema.safeParse(account).success).toBe(true);
    }
  });

  test('reports impossible unique collection requests instead of returning fewer elements', () => {
    const flags = defineFixture(shape.set(shape.boolean(), { minSize: 3, maxSize: 3 }));
    expect(() => flags.one(runOptions)).toThrow(GenerationError);
  });
});
