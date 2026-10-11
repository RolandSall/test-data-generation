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
import { defineFixture, shape, type Infer, fromJsonSchema, fromColumns, select } from '@integration-testing/test-data-generation';

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

### Branded primitives

The compiler adapter recognizes string/number intersections whose additional members are required, readonly unique-symbol properties with string or number literal markers. It generates the underlying primitive, including in nested objects and collections; `describeType<YourModel>()` retains your declared branded output type. A brand does not imply numeric bounds, uniqueness or domain validation. Primitive literals retain their literal constraint.

```ts
// In your model source file:
declare const brand: unique symbol;
type Identifier = number & { readonly [brand]: 'Identifier' };
```

String-key brands, mutable/optional markers and arbitrary intersections with additional requirements require explicit shapes/providers. They are rejected rather than silently reduced to a primitive. As with all compiler extraction, the generic annotation must match the declaration you ask to read.

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

Selectors can refer to the actual class members:

```ts
const invoiceSelectors = select(invoices.shape);
const fixedInvoices = invoices.extend({ rules: [
  invoiceSelectors.field(invoice => invoice.total).use(100),
] });
const fixedInvoice = fixedInvoices.one({ seed: 42 });
```

The callback is typed as `Invoice`. An IDE rename of `Invoice.total` can update this member access. Your runtime input shape must also describe the renamed field; arbitrary constructor transformations are not automatically mapped. Static access such as `Invoice.total` is not an instance-field reference in TypeScript.

For initialized fields and registered setters, use [class factories](graphs.md#class-factories-and-setters). Compiler extraction alone produces a plain object. Passing a bare constructor does not infer its declared property types.

## Inheritance and polymorphism

`extends` gives a class runtime inheritance. `implements` checks that a class satisfies a TypeScript contract; it does not create fields, constructors or a prototype relationship. The generator needs runtime shapes for inherited and concrete fields, plus a factory to construct real instances.

```ts
abstract class Animal {
  constructor(readonly name: string, readonly active: boolean) {}
  abstract speak(): string;
}
class Dog extends Animal {
  constructor(name: string, active: boolean, readonly trained: boolean) { super(name, active); }
  override speak(): string { return 'Woof!'; }
}
class Cat extends Animal {
  override speak(): string { return 'Meow!'; }
}
const animalFields = { name: shape.string(), active: shape.boolean() };
const DogInput = shape.object({ ...animalFields, trained: shape.boolean() });
const DogShape = shape.transform(DogInput, data => new Dog(data.name, data.active, data.trained));
const CatShape = shape.transform(shape.object(animalFields), data => new Cat(data.name, data.active));
const animals = defineFixture(shape.array(shape.union([DogShape, CatShape])));
const pets = animals.one({ seed: 42 });
for (const pet of pets) {
  if (!(pet instanceof Animal)) throw new Error('Expected inherited prototype');
  pet.speak(); // Dispatches to the selected subclass implementation.
}
```

The union samples the concrete shapes you register; it does not discover subclasses or construct an abstract class. A concrete shape forces that subtype. Constructors and `super()` run normally, including your invariant checks. Compiler extraction includes inherited data fields but still generates plain objects; declarations with methods require an explicit class factory or provider.

The [inheritance playground](../playground/inheritance/README.md) demonstrates an implemented contract, inherited fields/methods, overridden behavior, both subtypes in a nested collection, a forced subtype, typed selectors and missing-field errors. Each class and exported interface has its own file.

## Zod

The optional adapter supports Zod **4.3+ within v4**. See the [compatibility matrix](compatibility.md) for exact versions covered by CI.

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

`fromZod(schema)` generates parsed output. `fromZod(schema, { mode: 'input' })` generates raw values accepted by the schema. Both retain the corresponding Zod type. Nested transformations and pipelines are supported; generated parsed children are validated as output rather than passed back into an input parser.

```ts file=zod-modes.ts standalone
import { defineFixture } from '@integration-testing/test-data-generation';
import { fromZod } from '@integration-testing/test-data-generation/zod';
import { z } from 'zod';
const schema = z.object({ amount: z.literal('42').transform(Number) });
const output = defineFixture(fromZod(schema)).one({ seed: 42, check: 'schema' });
// { amount: 42 }; inferred as z.output<typeof schema>.
const input = defineFixture(fromZod(schema, { mode: 'input' })).one({ seed: 42, check: 'schema' });
// { amount: '42' }; inferred as z.input<typeof schema>.
const parsed = schema.parse(input);
```

Overrides/generators supply values in the selected mode: output values in output mode, raw values in input mode. Pipeline input constraints guide generation; output checks and refinements can reject candidates within `maxAttempts`. Failures retain the failing path and validation message and explain how to supply a field generator/provider. Known formats include email, UUID, URL, IPv4, IPv6 and ISO date/time/datetime; unsupported formats fail explicitly and need a generator/provider.

`schemaDefaults: 'preserve'` in output mode returns the declared output default or parsed prefault. In input mode, a default is represented by undefined/absence so the caller's parser can apply it; a prefault supplies its raw fallback. See [schema policies](configuration.md#schema-defaults-and-optional-properties).

Supported containers, recognized constraints, lazy types, unions, readonly objects, object intersections, refinements and synchronous transformations are supported. Arbitrary refinements use bounded retries, not automatic solving. Validation can execute schema callbacks; keep those callbacks deterministic and free of external side effects. Arbitrary transformations cannot be reversed, and their output structure is not inferred for selectors; target the described generation-input fields or supply the complete transformed value. An explicit output override of an arbitrary transform has no inferred output validator unless the pipeline declares one. Custom schemas and unrepresentable preprocess inputs need providers, variadic tuples need explicit recipes, and async effects need caller-owned preparation. See the runnable [schema playground](../playground/schema-policies/README.md).

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
