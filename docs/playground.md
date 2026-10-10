# Try the library in the playground

The repository includes runnable examples that import the library's public package entry points. Open a local checkout, then run these commands from its root using Node.js 22.22+ and Bun 1.3.5:

```sh
bun install --frozen-lockfile
bun run playground
bun run playground orders
bun run playground:test
```

`playground` builds the local package and prints every demo. Add a demo name to run just that example. `playground:test` checks the examples' types and runs assertions.

| Demo | What it shows |
| --- | --- |
| `orders` | Nested generation, custom fields, boolean rules and a computed total |
| `cancelled` | A named scenario and dependent refund flag |
| `batch` | Several generated orders in one execution |
| `feeds` | CSV rows, converted columns, generated IDs and cycling |
| `sessions` | A sequence advancing across calls in one session |
| `zod` | Generation from an existing Zod schema |
| `inheritance` | Inherited fields and methods, a real subclass and an implemented interface |
| `polymorphism` | Registered concrete subclasses in a nested collection and overridden behavior |
| `unknown-fields` | Existing-field overrides, unknown fields and typed selector errors |

Change the [Order model](../playground/models/order.ts), [order recipe](../playground/recipes/orders.ts), [CSV input](../playground/data/contacts.csv), or [Zod schema](../playground/recipes/accounts.ts), then rerun. The [seed and clock](../playground/run-options.ts) are fixed so you can replay the output.

The playground is available in the repository and excluded from the npm package. See its [README](../playground/README.md) for all demo commands.

For application-style code with separate interfaces, classes and composed fixtures, explore the [example packages](examples.md).

For runtime class behavior and a typed selection DSL, start with the [inheritance playground](../playground/inheritance/README.md), its [recipes](../playground/inheritance/fixtures.ts), and [tests](../playground/inheritance/inheritance.test.ts).
