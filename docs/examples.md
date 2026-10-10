# Application examples

The repository's [example packages](../examples/README.md) show larger models and fixtures split into focused files. All packages are private and excluded from the npm package.

| Package | Examples |
| --- | --- |
| [People](../examples/people/README.md) | A `Person` class implementing a separate interface, nested models, type rules, family scenarios and filling existing data |
| [Orders](../examples/orders/README.md) | Nested class instances, line-item recipes, dependent totals/discounts, shared addresses, filtering and session state |
| [Feeds](../examples/feeds/README.md) | CSV rows, aliases, conversion, computed names, seeded shuffle and field overrides |

Every interface has its own named file under `models/`. `shapes/` supplies runtime descriptions, `fixtures/` defines reusable generation recipes, and `scenarios/` contains small runnable use cases.

From a local checkout, use Node.js 22.22+ and Bun 1.3.5:

```sh
bun install --frozen-lockfile
bun run examples
bun run examples person
bun run examples order
bun run examples:test
```

The commands build the local library and import its public package entry points. Change a model, shape, fixture or scenario and rerun. The shared seed and clock make the examples repeatable. For smaller individual demos, use the [playground](playground.md).
