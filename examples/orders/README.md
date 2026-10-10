# Complex order examples

The [Order](models/order.ts) and [OrderLine](models/order-line.ts) interfaces each have their own file. The package imports the real `Person` class and people fixture from the private [people package](../people/README.md).

The [order fixture](fixtures/orders.ts) combines:

- A nested people recipe that creates a `Person` instance.
- A [line-item recipe](fixtures/order-lines.ts) with sequential SKU generators and per-item totals.
- Subtotal, discount and final total computations with typed dependencies.
- Billing and shipping references to the exact customer address instance.
- Shipped, cancelled and discounted scenarios.

Prices are whole monetary units to keep the example focused on composition. Applications requiring exact fractional money can use the library's decimal shapes and generators.

Run from the repository root:

```sh
bun run examples order
bun run examples discounted-orders
```

| Scenario | Source | Behavior |
| --- | --- | --- |
| `order` | [create-order.ts](scenarios/create-order.ts) | Creates a shipped order with three computed lines and a 10% discount |
| `discounted-orders` | [create-discounted-batch.ts](scenarios/create-discounted-batch.ts) | Creates three orders with a 20% discount, unique IDs and a final total of at least 100 |

The [tests](orders.test.ts) check class identity, shared address identity, every arithmetic dependency, filtered batches and sequences advancing across roots in one session. Run them with `bun run examples:test`. See the [example index](../README.md).
