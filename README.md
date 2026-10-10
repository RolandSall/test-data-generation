# Test Data Generation

`@integration-testing/test-data-generation` creates deterministic test objects from typed recipes: nested graphs, custom fields, scoped type rules, dependent values, and coherent CSV/JSON feeds.

Requires Node.js 22.22+. ESM and CommonJS are supported; integrations are optional. The package is prepared for npm publication. The npm command below applies after the first publication.

## Quick start

```sh
npm install @integration-testing/test-data-generation
```

Create a typed Person, customize its name, and generate the remaining properties:

```ts file=quick-start.ts standalone
import { defineFixture, select, shape } from '@integration-testing/test-data-generation';

const PersonShape = shape.object({
  name: shape.string(),
  age: shape.integer({ min: 18, max: 65 }),
  active: shape.boolean(),
});
const selectors = select(PersonShape);
const people = defineFixture(PersonShape, {
  rules: [selectors.field(person => person.name).use('Ada')],
});

const person = people.one({ seed: 42 });
console.log(person);

const selectedPerson = people.one({
  seed: 42, onlyProvided: true, fields: { name: 'Ada' },
});
// { name: 'Ada' }; unselected properties are absent; the type is partial.

```

Output with seed `42`:

```text
{ name: 'Ada', age: 30, active: true }
```

`person` is inferred as `{ name: string; age: number; active: boolean }`. The name is fixed; age and active status generate automatically. This example uses only `rules`; `fields` is optional. Full generation is the default, including when you override some fields. `onlyProvided: true` selects only properties in the merged `fields` tree and returns a partial type. Omit the customization to generate every property, or use `people.many(3, { seed: 42 })` for a batch.

## Find your use case

| I want to… | Start here |
| --- | --- |
| Create an object or batch | [Quick start](#quick-start) |
| Use an existing interface, class, or Zod schema | [Models and adapters](docs/models.md) |
| Customize a field or nested field | [Field overrides](docs/recipes.md#customize-individual-and-nested-fields) |
| Choose direct overrides or selector rules | [Fields or rules](#choose-fields-or-rules) |
| Select fields and scalar types with compiler checks | [Typed selectors](docs/recipes.md#typed-selectors) |
| Generate inherited classes and polymorphic collections | [Inheritance](docs/models.md#inheritance-and-polymorphism) |
| Target every boolean under an object | [Type rules](docs/recipes.md#match-types-throughout-a-subtree) |
| Derive values and define reusable scenarios | [Recipes](docs/recipes.md) |
| Control collections, references, ownership, or existing objects | [Object graphs](docs/graphs.md) |
| Import CSV/JSON or transform columns | [Data feeds](docs/feeds.md) |
| Find a built-in generator or write my own | [Generators](docs/generators.md) |
| Use Vitest/Jest and replay failures | [Testing](docs/testing.md) |
| Configure defaults, environment settings, or JSON files | [Configuration](docs/configuration.md) |
| Understand precedence, limits, or errors | [API behavior and troubleshooting](docs/usage.md) |
| Try runnable examples | [Playground](docs/playground.md) |
| Compare fields-only, rules-only, both and neither | [Customization playground](playground/customization/README.md) |
| Organize classes, models and complex fixtures | [Application examples](docs/examples.md) |

## Reusable Order model

The examples below use this larger model. Save it as `models.ts` when following the detailed guides.

```ts file=models.ts
import { defineFixture, shape, type Infer } from '@integration-testing/test-data-generation';

export const OrderShape = shape.object({
  id: shape.string(),
  status: shape.enum(['pending', 'shipped', 'cancelled']),
  total: shape.number({ min: 0, max: 1000 }),
  refunded: shape.boolean(),
  customer: shape.object({
    name: shape.string(),
    address: shape.object({ city: shape.string(), country: shape.string() }),
    preferences: shape.object({
      email: shape.boolean(),
      sms: shape.boolean(),
      security: shape.object({ rememberMe: shape.boolean() }),
    }),
  }),
  items: shape.array(shape.object({
    sku: shape.string(),
    quantity: shape.integer({ min: 1, max: 5 }),
  })),
});

export type Order = Infer<typeof OrderShape>;
export const orders = defineFixture(OrderShape);
```

All declared fields and nested objects generate automatically; collections contain generated elements.

```ts
const order = orders.one({ seed: 42 });
const batch = orders.many(10, { seed: 42 });
const replay = orders.one({ seed: 42 }); // Same values as order
```

Interfaces disappear at runtime. Use explicit shapes or the compiler adapter to read a source declaration. Real class instances require a constructor factory; a generic type alone cannot infer fields. See [model choices](docs/models.md).

## Choose fields or rules

`fields` and `rules` are both optional. Use either on its own, combine them, or omit both to generate every declared field automatically. These two recipes customize the same properties:

```ts
import { select } from '@integration-testing/test-data-generation';

const usingFields = defineFixture(OrderShape, {
  fields: { status: 'pending', customer: { name: 'Ada' } },
});

const selectors = select(OrderShape);
const usingRules = defineFixture(OrderShape, {
  rules: [
    selectors.field(order => order.status).use('pending'),
    selectors.field(order => order.customer.name).use('Ada'),
  ],
});
```

Use `fields` for direct, typed property overrides. Use `rules` for property callbacks with autocomplete and IDE rename, or for matching many fields by scalar kind or subtree. Unspecified properties still generate. If you choose to combine both and they target the same property, its `fields` instruction takes precedence; configuring a property twice is not required. See [choosing a customization style](docs/recipes.md#choose-fields-or-rules).

## Customize fields and nested objects

```ts
import { generator, integer, uuid } from '@integration-testing/test-data-generation';

const customOrders = orders.extend({
  fields: {
    id: uuid(),
    total: integer({ min: 100, max: 500 }),
    customer: {
      name: generator(({ random }) => random.pick(['Ada', 'Grace'])),
      address: { city: 'Beirut' },
    },
  },
});
const customized = customOrders.one({ seed: 42 });
```

Unspecified fields continue to generate, including the country, preferences, and items. Overrides are checked against the output type. Use the provided RNG for replayable custom generators.

## Select fields with type checking

```ts
const selectedOrders = orders.extend({ rules: [
  selectors.field(order => order.customer.name).use('Ada'),
  selectors.field(order => order.total).use(integer({ min: 100, max: 500 })),
  selectors.all('boolean', { under: order => order.customer.preferences }).use(true),
] });
const selectedOrder = selectedOrders.one({ seed: 42 });
```

Property callbacks provide autocomplete and IDE rename support, with no dotted path string to maintain. Unknown properties and incompatible values/generators fail TypeScript checking. Paths also get checked against the runtime shape. Read [typed selectors and field errors](docs/recipes.md#typed-selectors) for details.

## Match types throughout a nested object

```ts
import { boolean } from '@integration-testing/test-data-generation';

const preferenceOrders = orders.extend({
  rules: [{
    match: { kind: 'boolean', under: 'customer.preferences' },
    use: boolean(0.8),
  }],
});
const preferences = preferenceOrders.one({ seed: 42 });
```

Every generated boolean below that subtree, including `security.rememberMe`, uses an 80% probability of `true`. Fields are sampled independently. Use `use: true` for an identical value, or remove `under` to match the whole graph. Explicit field overrides win. See [targeting and precedence](docs/recipes.md#match-types-throughout-a-subtree).

## Derive values and define scenarios

```ts
const scenarios = orders.extend({
  computed: ({ derive }) => ({
    refunded: derive(['status'], status => status === 'cancelled'),
  }),
  cases: {
    cancelled: { fields: { status: 'cancelled' } },
    expensive: { fields: { total: 900 } },
  },
});
const cancelled = scenarios.one({ seed: 42, case: 'cancelled' });
// cancelled.refunded === true
```

`extend()` creates a new recipe; the original stays reusable. Dependencies are typed and evaluated in order. [Recipes](docs/recipes.md) also cover nested scopes, metadata, strict matching, and Cartesian products.

## Runnable application examples

The repository includes private example packages with separate interfaces, classes, shapes and reusable fixtures.

| Example package | Scenarios to explore |
| --- | --- |
| [People](examples/people/README.md) | Real `Person` instances, nested contacts/preferences, deep boolean rules, related adults/children and filling existing data |
| [Orders](examples/orders/README.md) | Nested people and line-item recipes, dependent subtotal/discount/total calculations, shared address references, filtered batches and advancing sequences |
| [Feeds](examples/feeds/README.md) | Coherent CSV rows, column conversion, computed names, seeded shuffle, cycling and field overrides |

For the most involved composition, read the [order fixture](examples/orders/fixtures/orders.ts) and its [line-item fixture](examples/orders/fixtures/order-lines.ts). See the [example index](examples/README.md) for all eight runnable scenarios.

From a local checkout:

```sh
bun install --frozen-lockfile
bun run examples order
bun run examples discounted-orders
bun run examples:test
```

Examples are excluded from the npm package.

The [inheritance playground](playground/inheritance/README.md) includes real `Dog`/`Cat` subclasses, an implemented contract, polymorphic nested collections, typed selectors and unknown-field errors. Run `bun run playground inheritance` or `bun run playground polymorphism`. The [property-selector recipe](playground/recipes/property-selectors.ts) targets a real nested `Customer` class with property callbacks; run `bun run playground property-selectors`.

## Optional integrations

| Import suffix | Purpose | Peer |
| --- | --- | --- |
| `/zod` | Generate from Zod schemas | Zod 4.6+ within v4 |
| `/typescript` | Explicit compiler metadata extraction | TypeScript 5.9+ within the declared peer range |
| `/protobuf` | Generate protobufjs messages | protobufjs 8.8+ within v8 |
| `/node` | Files, streams, settings, explicit file writes | Built-in Node APIs |
| `/vitest` | Isolated `data` test sessions | Vitest 4.1+ within v4; ESM |
| `/jest` | Typed `given()` arguments | Jest 30 and `@jest/globals` |

See the [compatibility matrix](docs/compatibility.md) for minimum and current peer versions verified in CI.

JSON Schema and ORM-neutral column adapters are exported from the core. Only install peers for the integrations you use. [Models](docs/models.md) and [testing](docs/testing.md) provide complete examples. Generated data can be passed to Testcontainers/data-isolation tests through normal test code; database inserts and transactions remain application-owned operations.

## Replay and validation

```ts
const result = scenarios.result({ seed: 42, now: '2026-01-01T00:00:00Z' });
const reproduced = scenarios.one({ seed: result.seed, now: result.now });
```

Keep the seed, clock, recipe, options, generation order, source contents/order, and package/dependency versions stable for replay. Custom generators and schema callbacks must use controlled state. Independent executions do not share library-managed state or uniqueness domains; no identical-output guarantee applies across package versions. See [replay and uniqueness scope](docs/compatibility.md). `one()` resets counters/cursors; `many()`, `stream()`, and `fixtureRun()` advance them. Explicit overrides can create negative fixtures; `check: 'schema'` validates the completed graph. Strict unmatched rules and impossible constraints fail with useful errors. See [execution semantics](docs/usage.md).

Read the [user guides](docs/README.md) for complete examples or [features and limitations](docs/capabilities.md) for a supported-feature overview. MIT licensed.
