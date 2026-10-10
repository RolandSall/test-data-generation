# Models and adapters

Runtime shapes describe fields and values. Interfaces are erased by TypeScript, so a generic type alone cannot tell the generator which fields exist.

Start with explicit shapes. The optional `/typescript` entry reads existing declarations through the compiler; `/protobuf` reads protobuf descriptors and constructs messages. `/node` handles [feed files and streams](feeds.md#files-and-bounded-streams) and [settings files](configuration.md#json-settings); it does not infer model fields.

| Input | API | Output |
| --- | --- | --- |
| Shape descriptor | `defineFixture(shape.object(...))` | Inferred plain object |
| Existing TS declaration | `/typescript`: `describeType()` | Plain object from explicitly read source metadata |
| Runtime class | `shape.class()` or `shape.transform()` | Instance constructed by your factory |
| Zod schema | `/zod`: `fromZod()` | Inferred Zod output |
| JSON Schema | `fromJsonSchema()` | Value for the supported subset |
| ORM column hints | `fromColumns()` | Object from explicit descriptors |
| Protobuf descriptor | `/protobuf`: `fromProtobuf()` | protobufjs message |

## Typed shapes

```ts
import { defineFixture, shape, type Infer, fromJsonSchema, fromColumns } from '@integration-testing/test-data-generation';

const ProductShape = shape.object({
  sku: shape.string({ pattern: /^SKU-\d{4}$/ }),
  price: shape.number({ min: 1, max: 100 }),
  tags: shape.array(shape.string(), { minSize: 1, maxSize: 3 }),
});
type Product = Infer<typeof ProductShape>;
const product: Product = defineFixture(ProductShape).one({ seed: 42 });
```

Use `integer` for safe integers, `number` for fractional values, `bigint` for arbitrary precision, and `decimalShape()` for fixed-scale decimals. [Graphs](graphs.md) cover the other shapes.

## Existing TypeScript declarations

Install the optional compiler peer in your test project:

```sh
npm install --save-dev typescript
```

Create this source file:

```ts file=order-interface.ts
export interface ExistingOrder {
  id: string;
  total: number;
  customer: { name: string; preferences: { email: boolean; sms: boolean } };
}
```

Read the named declaration explicitly. File paths resolve from the process working directory.

```ts
import { describeType } from '@integration-testing/test-data-generation/typescript';

const extractedOrders = defineFixture(describeType<import('./order-interface.js').ExistingOrder>(
  './order-interface.ts', 'ExistingOrder',
), {
  rules: [{ match: { kind: 'boolean', under: 'customer.preferences' }, use: true }],
});
const extracted = extractedOrders.one({ seed: 42 });
```

The adapter supports resolved generics, inheritance, unions, recursive types and supported collections. Pass `{ tsconfig: './tsconfig.json' }` as the third argument when needed. Extraction requires the source files and compiler peer. It returns runtime shapes, without installing a transformer or automatically generating source files. A generic annotation supplies a return type; it does not independently prove that the named declaration has the same structure. Methods, `any`/`unknown`/`never`, and unbound type parameters need explicit shapes/providers.

## Real class instances

A typed transformation can call your constructor with generated arguments:

```ts
class Invoice {
  constructor(readonly id: string, readonly total: number) {}
  describe(): string { return `${this.id}: ${this.total}`; }
}
const InvoiceInput = shape.object({ id: shape.string(), total: shape.number({ min: 1, max: 500 }) });
const invoices = defineFixture(shape.transform(InvoiceInput, input => new Invoice(input.id, input.total)));
const invoice = invoices.one({ seed: 42 });
if (!(invoice instanceof Invoice)) throw new Error('Expected a real instance');
```

For initialized fields and registered setters, use [class factories](graphs.md#class-factories-and-setters). Compiler extraction alone produces a plain object. Passing a bare constructor does not infer its declared property types.

## Zod

```sh
npm install zod
```

```ts
import * as z from 'zod';
import { fromZod } from '@integration-testing/test-data-generation/zod';

const UserSchema = z.object({ name: z.string().min(3).max(20), age: z.number().int().min(18).max(65), email: z.email() });
const users = defineFixture(fromZod(UserSchema));
const user = users.one({ seed: 42, check: 'schema' });
UserSchema.parse(user);
```

Supported containers, recognized constraints, lazy types, unions, readonly objects, object intersections, refinements and synchronous transformations are supported. Arbitrary refinements use bounded retries. Custom schemas need providers, variadic tuples need explicit recipes, and async effects need application-owned preparation. Supported formats are listed in [generators](generators.md#formats-and-checksums).

## JSON Schema

```ts
const jsonProducts = defineFixture(fromJsonSchema<{ code: string; quantity: number }>({
  type: 'object', required: ['code', 'quantity'],
  properties: {
    code: { type: 'string', pattern: '^P-[0-9]{3}$' },
    quantity: { type: 'integer', minimum: 1, maximum: 10 },
  },
}));
const jsonProduct = jsonProducts.one({ seed: 42, check: 'schema' });
```

Local references, supported scalar/container bounds, constants, enums, unions and object intersections are supported. This is not a complete JSON Schema validator/solver. External references and unsupported logical/conditional constructs need preprocessing or providers. Use an independent validator such as Ajv when full conformance is required. Generic annotations are not runtime proof.

## ORM column hints

```ts
const databaseRows = defineFixture(fromColumns({
  code: { type: 'string', length: 12 },
  amount: { type: 'decimal', precision: 20, scale: 2 },
  count: { type: 'integer', minimum: 1, maximum: 100 },
  enabled: { type: 'boolean', nullable: true },
}));
const databaseRow = databaseRows.one({ seed: 42 });
```

Descriptors are explicit and ORM-neutral. Decimal values use the library's BigInt-backed `Decimal`. Relationships use ordinary shapes/references. Your persistence code owns insertion, transactions, database-generated defaults and database uniqueness.

## Protobuf

```sh
npm install protobufjs
```

```ts
import protobuf from 'protobufjs';
import { fromProtobuf } from '@integration-testing/test-data-generation/protobuf';

const root = protobuf.parse('syntax="proto3"; message Event { string id = 1; uint64 sequence = 2; }').root;
const EventType = root.lookupType('Event');
const event = defineFixture(fromProtobuf(EventType)).one({ seed: 42 });
if (EventType.verify(event) !== null) throw new Error('Invalid message');
const wire = EventType.encode(event).finish();
const decoded = EventType.decode(wire);
```

Descriptors cover scalars, enums, repeated fields, typed maps, oneofs, nested messages and bytes. 32-bit values use safe numbers; full-width 64-bit values are represented as Long values. Reference cycles must terminate before encoding. For a self-recursive repeated message field, supply an explicit termination such as `fields: { children: [] }`; omitting values at the recursion limit can leave array entries that protobuf cannot encode.
