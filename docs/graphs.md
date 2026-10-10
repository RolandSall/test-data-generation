# Object graphs and collections

Examples reuse the [Order model](../README.md#reusable-order-model) and run together.

```ts
import {
  defineFixture, shape, listOf, value, shared, fresh, populate, omit, blank,
  reference, sequence, type Infer, type Shape,
} from '@integration-testing/test-data-generation';
import { orders } from './models.js';
```

## Collections and nested recipes

```ts
const LineShape = shape.object({ sku: shape.string(), quantity: shape.integer(), doubled: shape.integer() });
const lines = listOf(LineShape, {
  count: 3, fields: { quantity: 2 },
  computed: ({ derive }) => ({ doubled: derive(['quantity'], quantity => quantity * 2) }),
});
const lineBatch = lines.one({ seed: 42 });
if (lineBatch.length !== 3 || lineBatch.some(line => line.doubled !== 4)) throw new Error('Invalid lines');

const CollectionsShape = shape.object({
  labels: shape.set(shape.enum(['small', 'medium', 'large']), { minSize: 2, maxSize: 2 }),
  lookup: shape.map(shape.string(), shape.integer(), { minSize: 2, maxSize: 2 }),
  flags: shape.record(shape.boolean(), { minSize: 2, maxSize: 2 }),
  point: shape.tuple([shape.number(), shape.number()]),
});
const collections = defineFixture(CollectionsShape).one({ seed: 42 });
```

Nested recipes compute within each element's local scope. `listOf()` accepts `count` or `min`/`max` and element recipe options. Arrays/sets use numeric paths; maps use `lookup.*.key`/`lookup.*.value`; records use generated keys. Index rules select existing elements without resizing.

## Unions and optional values

```ts
const PaymentShape = shape.union([
  shape.object({ kind: shape.literal('cash'), amount: shape.number() }),
  shape.object({ kind: shape.literal('card'), lastFour: shape.string({ minLength: 4, maxLength: 4, alphabet: '0123456789' }) }),
]);
const payment = defineFixture(shape.object({
  payment: PaymentShape, note: shape.optional(shape.string()), processedAt: shape.nullable(shape.date()),
})).one({ seed: 42, optionalProbability: 0.5, nullProbability: 0.2 });
```

Unions select a supported variant. Supply an explicit field/variant recipe for a required branch. Optional fields populate by default; nullable fields default to 20% null probability. Absence, null, and an empty collection differ.

## References and recursion

```ts
const AddressShape = shape.object({ city: shape.string(), country: shape.string() });
type Address = Infer<typeof AddressShape>;
const shipped = defineFixture(shape.object({
  billing: AddressShape, delivery: shape.reference<Address>('billing'),
})).one({ seed: 42 });
if (shipped.billing !== shipped.delivery) throw new Error('Expected shared reference');

const sameAddress = defineFixture(shape.object({ billing: AddressShape, delivery: AddressShape }), {
  fields: { delivery: reference<Address>('billing') },
}).one({ seed: 42 });

interface Tree { label: string; children: Tree[] }
const TreeShape: Shape<Tree> = shape.object({
  label: shape.string(),
  children: shape.array(shape.lazy(() => TreeShape), { minSize: 0, maxSize: 2 }),
});
const tree = defineFixture(TreeShape).one({ seed: 42, maxDepth: 5, cycle: 'omit' });
```

References use explicit root paths and resolve after construction. Recursive cycles default to omission; `null`, `error`, and `reference` are alternatives. The last can produce actual cyclic graphs. Choose a compatible termination policy; validation/serialization can reject required-field cutoffs or cycles.

## Class factories and setters

```ts
class Customer {
  private displayName = '';
  constructor(readonly id: string) {}
  setName(name: string): void { this.displayName = name; }
  get name(): string { return this.displayName; }
}
const CustomerShape = shape.class<Customer>(
  { id: shape.string(), name: shape.string() },
  values => new Customer(String(values.id)),
  { name: (customer, next) => {
    if (!(customer instanceof Customer)) throw new Error('Expected Customer');
    customer.setName(String(next));
  } },
);
const customer = defineFixture(CustomerShape, { fields: { name: 'Ada' } }).one({ seed: 42 });
if (!(customer instanceof Customer) || customer.name !== 'Ada') throw new Error('Invalid customer');
```

Factory values are `unknown`; narrow them before construction. Initialized fields are preserved unless explicitly overridden. Register setters for controlled assignment; use [`shape.transform()`](models.md#real-class-instances) for typed constructor arguments.

## Ownership and existing values

```ts
const knownAddress: Address = { city: 'Beirut', country: 'LB' };
const copied = orders.extend({ fields: { customer: { address: value(knownAddress) } } }).many(2, { seed: 42 });
if (copied[0]!.customer.address === copied[1]!.customer.address) throw new Error('Expected separate copies');
const reused = orders.extend({ fields: { customer: { address: shared(knownAddress) } } }).one({ seed: 42 });
if (reused.customer.address !== knownAddress) throw new Error('Expected exact instance');
const factoryAddress = orders.extend({
  fields: { customer: { address: fresh(() => ({ city: 'Beirut', country: 'LB' })) } },
}).one({ seed: 42 });
const populated = orders.extend({
  fields: { customer: { address: populate(() => ({ city: 'Beirut' } as Address)) } },
}).one({ seed: 42 });
if (!populated.customer.address.country) throw new Error('Expected generated country');
```

| Instruction | Identity | Populate missing | Default completion |
| --- | --- | --- | --- |
| `value(object)` | Copy per occurrence | No | No |
| `shared(object)` | Exact instance | No | No |
| `fresh(factory)` | Factory decides | No | No |
| `populate(factory)` | Factory decides | Yes | Yes |
| `generator(fn)` | Generated value | No | Yes |

`populate()` deliberately asserts an incomplete factory result: its type describes the completed value. Prefer typed partial field trees for simple customization. Copies support plain objects, dates, bytes, decimals and collections. Opaque classes require `shared()`/`fresh()` to preserve private state.

## Fill, omit, and blank

```ts
const incomplete = { total: 0, customer: { name: 'Ada' } };
const filled = orders.fill(incomplete, { seed: 42 });
if (filled !== incomplete || filled.total !== 0 || filled.customer.name !== 'Ada') throw new Error('Unexpected fill');
const empty = orders.blank({ seed: 42 });
const partiallyEmpty = orders.extend({
  fields: { customer: { address: blank<Address>() }, refunded: omit() },
}).one({ seed: 42 });
```

`fill()` mutates the root and fills missing fields, preserving initialized values and collection counts. `mode: 'nullish'` also fills nulls; `mode: 'rules'` only applies explicit instructions. Existing `0`/`false` stay intact. Frozen objects cannot be populated; collection instances can change while retaining size.

`blank()` returns a partial object with absent scalars, nested blank objects and empty collections. `omit()` omits a node. These can violate the declared output; use `check: 'schema'` when validity matters.

## Completion transformations

```ts
const normalized = orders.extend({ complete: [{
  match: { path: 'customer.name' }, transform: current => String(current).toUpperCase(),
}] }).one({ seed: 42 });
if (normalized.customer.name !== normalized.customer.name.toUpperCase()) throw new Error('Not normalized');
```

Return replacements for immutable objects. Transformations compose after dependencies/references. Supplied opaque values are excluded unless `includeSupplied: true`; null/undefined are skipped. Strict callbacks matching only excluded values are unused.

## Filters and uniqueness

```ts
const tickets = defineFixture(shape.object({ id: shape.integer(), amount: shape.integer({ min: 1, max: 100 }) }), {
  fields: { id: sequence({ start: 100 }) }, unique: ['id'], filter: ticket => ticket.amount >= 50,
}).many(10, { seed: 42 });
const people = defineFixture(shape.object({ first: shape.string(), age: shape.integer() }), {
  unique: [{ paths: ['first', 'age'], scope: 'composite' }],
}).many(10, { seed: 42 });
```

Root filters retry roots; rule filters retry nodes. Batch uniqueness tracks fields across one execution; composite scope tracks tuples; shared scope shares a domain across paths. Rule `unique: 'group-name'` shares a domain across nodes.

Retries stop at `maxAttempts` (default 100). Finite set/unique-array domains are checked up front. Impossible requests fail without undersized results. Use explicit key paths for cyclic graphs. See [budgets and errors](usage.md).
