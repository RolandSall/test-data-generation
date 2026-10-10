import { fixtureRun } from '@integration-testing/test-data-generation';
import { Person } from '@integration-testing/examples-people';
import { expect, test } from 'vitest';
import { createOrder, createDiscountedBatch, orders } from './index.js';
import { exampleOptions } from '../run-options.js';

test('composes a Person class, nested recipes and shared address references', () => {
  const order = createOrder();
  expect(order.customer).toBeInstanceOf(Person);
  expect(order.customer.isAdult()).toBe(true);
  expect(order.billingAddress).toBe(order.customer.home);
  expect(order.shippingAddress).toBe(order.billingAddress);
  expect(order.status).toBe('shipped');
  expect(order).toEqual(createOrder());
});

test('computes each line, then subtotal, discount and total in dependency order', () => {
  const order = createOrder();
  expect(order.lines).toHaveLength(3);
  for (const line of order.lines) expect(line.lineTotal).toBe(line.quantity * line.unitPrice);
  expect(order.subtotal).toBe(order.lines.reduce((sum, line) => sum + line.lineTotal, 0));
  expect(order.discountTotal).toBe(Math.round(order.subtotal * 0.1));
  expect(order.total).toBe(order.subtotal - order.discountTotal);
});

test('filters discounted orders and keeps IDs unique across the batch', () => {
  const batch = createDiscountedBatch();
  expect(batch).toHaveLength(3);
  expect(new Set(batch.map(order => order.id)).size).toBe(3);
  for (const order of batch) {
    expect(order.total).toBeGreaterThanOrEqual(100);
    expect(order.discountRate).toBe(20);
    expect(order.total).toBe(order.subtotal - Math.round(order.subtotal * 0.2));
  }
});

test('advances nested line sequences across roots in a session and applies cases', () => {
  const run = fixtureRun(exampleOptions);
  const first = run.make(orders, { case: 'cancelled' });
  const second = run.make(orders);
  expect(first.total).toBe(first.subtotal);
  expect(first.status).toBe('cancelled');
  expect(first.lines.map(line => line.sku)).toEqual(['SKU-100', 'SKU-101', 'SKU-102']);
  expect(second.lines.map(line => line.sku)).toEqual(['SKU-103', 'SKU-104', 'SKU-105']);
});
