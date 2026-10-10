# Recipes and customization

These examples reuse the [README's Order model](../README.md#quick-start). Keep this setup when running the snippets together.

```ts
import { defineFixture, shape, generator, boolean, integer, oneOf, uuid, annotate } from '@integration-testing/test-data-generation';
import { OrderShape, orders } from './models.js';
```

## Customize individual and nested fields

```ts
const custom = orders.extend({
  fields: {
    id: uuid(), total: integer({ min: 100, max: 500 }),
    customer: { name: oneOf(['Ada', 'Grace']), address: { city: 'Beirut' } },
  },
});
const customOrder = custom.one({ seed: 42 });
```

`fields` accepts literal values, generators, nested field trees, and nested recipes. A property tree partially configures an object: country, preferences and items still generate. Unknown fields and mismatched instruction types fail type checking. Use `value(object)` for complete replacement; see [ownership](graphs.md#ownership-and-existing-values).

## Write a custom generator

```ts
const numbered = orders.extend({
  fields: {
    id: generator(({ random }) => `ORD-${random.int(1000, 9999)}`),
    customer: { name: generator(({ random }) => random.pick(['Ada', 'Grace'])) },
  },
});
const numberedOrder = numbered.one({ seed: 42 });
```

The context supplies a seeded RNG, execution clock, path, index, current root, and per-execution `state()` store. Avoid `Math.random()` and reading the wall clock when replay matters. A generated object is completed; use `populate()` around a partial factory when its missing fields should generate.

## Match types throughout a subtree

```ts
const preferenceRecipe = orders.extend({
  rules: [{ match: { kind: 'boolean', under: 'customer.preferences' }, use: boolean(0.8) }],
});
const preferenceOrder = preferenceRecipe.one({ seed: 42 });
```

This reaches `email`, `sms`, the deeper `security.rememberMe`, and booleans in any collection elements below that subtree. Fields use the same strategy but are sampled independently. Use a literal for identical values; omit `under` for the whole graph.

```ts
const allEnabled = orders.extend({ rules: [{ match: { kind: 'boolean', under: 'customer.preferences' }, use: true }] });
const globallyDisabled = orders.extend({ rules: [{ match: { kind: 'boolean' }, use: false }] });
const enabledOrder = allEnabled.one({ seed: 42 });
const disabledOrder = globallyDisabled.one({ seed: 42 });
```

Matching uses runtime kinds. Fixed boolean literals are `literal` shapes and retain their domain. Compiler-extracted boolean fields normalize to boolean shapes. Complete supplied objects are opaque to child generation rules.

## Target paths and collection elements

```ts
const targeted = orders.extend({ rules: [
  { match: { path: 'customer.address.city' }, use: 'Paris' },
  { match: { path: 'items.*.quantity', index: [0, 1] }, use: 1 },
] });
const targetedOrder = targeted.one({ seed: 42 });
```

`*` matches one path segment. Paths are relative to the recipe insertion point; `$` targets its root. `under` includes descendants at any depth. Index rules do not enlarge collections. Set the collection size if a particular index must exist.

| Match property | Meaning |
| --- | --- |
| `path` | Exact path or one-segment wildcards |
| `kind` | Runtime kind such as `boolean`, `string`, `integer`, `object` |
| `under` | A subtree and its descendants |
| `depth` | Depth or predicate |
| `index` | Index, index list, or predicate |
| `metadata` | Exact metadata key/value matches |
| `predicate` | Custom shape/path predicate |

## Match domain types with metadata

Use metadata to distinguish domain values that share a primitive type.

```ts
const AccountShape = shape.object({ accountId: annotate(shape.string(), { domain: 'account-id' }), label: shape.string() });
const accounts = defineFixture(AccountShape, {
  rules: [{ match: { metadata: { domain: 'account-id' } }, use: generator(({ random }) => `ACC-${random.int(1, 9999)}`) }],
});
const account = accounts.one({ seed: 42 });
```

## Precedence and strict matching

Explicit field instructions, including decoded feed values, beat generation rules. Among rules, path/index specificity wins, then the last equally specific match. Recipe/call fields beat feed values. Strict rules with no matches raise `UNUSED_RULE`; set `optional: true` for a reusable rule that may not apply.

```ts
const precedence = orders.extend({
  fields: { customer: { preferences: { email: false } } },
  rules: [
    { match: { kind: 'boolean', under: 'customer.preferences' }, use: true },
    { match: { path: 'customer.preferences.sms' }, use: false },
    { match: { path: 'legacyField' }, use: 1, optional: true },
  ],
});
const precedenceOrder = precedence.one({ seed: 42 });
// email === false; sms === false; security.rememberMe === true
```

## Derive dependent values

```ts
const consistent = orders.extend({ computed: ({ derive }) => ({
  refunded: derive(['status'], status => status === 'cancelled'),
}) });
const refundedOrder = consistent.one({ seed: 42, fields: { status: 'cancelled' } });
```

Paths and callback arguments are typed. Computations run in dependency order after ordinary fields, within the current object. Nested/list recipes keep local derivation scopes. A field cannot be both computed and independently overridden. Dependency cycles and unresolved inputs fail.

For example, `derive(['customer.name', 'total'], (name, total) => ...)` infers `name` as string and `total` as number. The compiler checks path names and the computed field's return type. Dependency paths cover up to five object levels by default; dates and collections are whole-value dependencies. This compile-time limit is separate from the run's `maxDepth`. You do not need to construct the path utility types yourself.

## Reuse recipes and define scenarios

```ts
const scenarios = consistent.extend({ cases: {
  cancelled: { fields: { status: 'cancelled' } },
  expensive: { fields: { total: 900 } },
} });
const cancelled = scenarios.one({ seed: 42, case: 'cancelled' });
const expensive = scenarios.one({ seed: 42, case: 'expensive' });
const overridden = scenarios.one({ seed: 42, case: 'expensive', fields: { total: 250 } });
```

`extend()` preserves the base recipe. Nested field trees merge by property. Cases can supply rules and execution settings; call overrides have final precedence. See [configuration](configuration.md).

## Enumerate finite combinations

```ts
const combinations = defineFixture(OrderShape).cartesian({
  status: ['pending', 'shipped', 'cancelled'], total: [100, 500],
}, { seed: 42, limit: 10 });
// Six roots; remaining fields generate for each root.
```

Dimensions select top-level field values. The default product guard is 10,000 roots. Use a bounded product for exhaustive combinations and a batch for ordinary randomized data.
