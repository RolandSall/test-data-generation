# Test runners, sessions, and replay

## Runner-independent sessions

Reuse the [Order model](../README.md#quick-start).

```ts
import { fixtureRun, defineFixture, shape, sequence, mapValue } from '@integration-testing/test-data-generation';
import { orders, type Order } from './models.js';
const numberedOrders = orders.extend({ fields: { id: mapValue(sequence(), next => String(next)) } });
const run = fixtureRun({ seed: 42, now: '2026-01-01T00:00:00Z' });
const first = run.make(numberedOrders);
const second = run.make(numberedOrders);
if (first.id !== '1' || second.id !== '2') throw new Error('Expected advancing session');
const more = run.makeMany(orders, 3, { fields: { status: 'pending' } });
```

Sessions advance RNG/counters/cursors across recipes. Set seed, clock, budgets/defaults on `fixtureRun()`; `make()` accepts fields/case/check/strictness.

## Vitest

Install Vitest alongside the library. Complete test file:

```ts runner=vitest
import { defineFixture, shape } from '@integration-testing/test-data-generation';
import { test, expect } from '@integration-testing/test-data-generation/vitest';
const orders = defineFixture(shape.object({ id: shape.string(), total: shape.number({ min: 1, max: 100 }) }));
test('creates an order with a known total', ({ data }) => {
  const order = data.make(orders, { fields: { total: 75 } });
  expect(order.total).toBe(75);
  expect(order.id.length).toBeGreaterThan(0);
});
```

`data` is isolated per test. Default seed uses file/test names; `TEST_DATA_SEED` overrides it. Failures include seed and clock. Vitest integration is ESM.

## Jest

Install Jest and `@jest/globals`. Complete test file:

```ts runner=jest
import { defineFixture, shape } from '@integration-testing/test-data-generation';
import { given, expect } from '@integration-testing/test-data-generation/jest';
const orders = defineFixture(shape.object({ id: shape.string(), total: shape.number({ min: 1, max: 100 }) }), { fields: { total: 75 } });
given('creates a typed order', { order: orders }, ({ order }) => {
  expect(order.total).toBe(75);
  expect(order.id.length).toBeGreaterThan(0);
}, { seed: 42, now: '2026-01-01T00:00:00Z' });
```

`given()` infers named recipe arguments and supports async bodies. Each test owns a session. Default seed is the test name; options override environment. Failures include replay values.

## Reproduce failures

```ts
const recorded = orders.result({ seed: 'order-test-42', now: '2026-01-01T00:00:00Z' });
const reproduced = orders.one({ seed: recorded.seed, now: recorded.now });
if (JSON.stringify(recorded.value) !== JSON.stringify(reproduced)) throw new Error('Replay differs');
const finite: Order[] = [];
for (const order of orders.stream({ seed: 42 })) {
  finite.push(order);
  if (finite.length === 3) break;
}
```

Keep recipe/options/source/version stable. `one()` starts fresh; `many()`/`stream()` advance one execution. Streams are unbounded: stop explicitly.

Use the runner's reported seed/clock:

```sh
TEST_DATA_SEED='order-test-42' TEST_DATA_NOW='2026-01-01T00:00:00Z' npx vitest run
TEST_DATA_SEED='order-test-42' TEST_DATA_NOW='2026-01-01T00:00:00Z' npx jest --runInBand
```

## Schema checks and negative fixtures

```ts
const validated = orders.one({ seed: 42, check: 'schema' });
const SmallShape = shape.object({ amount: shape.integer({ min: 1, max: 100 }) });
const intentionallyInvalid = defineFixture(SmallShape, { fields: { amount: -1 } }).one({ seed: 42 });
// one({ check: 'schema' }) would reject this invalid override.
```

Schema checks validate the completed graph. Explicit overrides support application-validation inputs. Use an independent application validator when runtime descriptors are insufficient.

## Integration tests and persistence

Your `@integration-testing/testcontainers` and data-isolation setup can own database startup/transactions.

```ts
async function createTestOrder(save: (input: Order) => Promise<Order>): Promise<Order> {
  const input = orders.one({ seed: 42, fields: { status: 'pending' } });
  return save(input);
}
const saved = await createTestOrder(async input => input);
```

The callback illustrates the application boundary without starting a database. Pass a real repository insert function in integration tests. Database-generated IDs, uniqueness, foreign keys, cleanup and rollback belong to persistence/isolation.
