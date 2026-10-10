# CSV, JSON, and row feeds

Feeds supply coherent rows. Unmapped fields generate. Batches/sessions advance cursors; standalone `one()` starts a new execution.

## Project a complete row

```ts
import {
  defineFixture, shape, rows, readCsv, readJson, writeCsv, column, template,
  combineColumns, generatedColumn, transformColumn, nullableColumn, uuid,
} from '@integration-testing/test-data-generation';

const ContactShape = shape.object({
  id: shape.string(), name: shape.string(), age: shape.integer({ min: 0, max: 120 }),
  active: shape.boolean(), initials: shape.string(), nickname: shape.nullable(shape.string()),
});
const contacts = defineFixture(ContactShape, {
  source: rows([
    { first: 'Ada', last: 'Lovelace', age: '36', active: 'true', nickname: 'ada' },
    { first: 'Grace', last: 'Hopper', age: '85', active: 'false', nickname: 'grace' },
  ]),
  columns: {
    id: generatedColumn(uuid()), name: template('${first} ${last}'),
    age: column('age', raw => Number(raw)), active: 'active',
    initials: combineColumns(['first', 'last'], (first, last) => String(first)[0]! + String(last)[0]!),
    nickname: nullableColumn(transformColumn(column('nickname'), raw => String(raw).toUpperCase()), 0.2),
  },
});
const contactBatch = contacts.many(2, { seed: 42, check: 'schema' });
if (contactBatch[0]!.name !== 'Ada Lovelace' || contactBatch[0]!.initials !== 'AL') throw new Error('Mixed row');
```

Templates/combined columns resolve dependencies within one row. Transformations run before nullable wrapping. Generated columns use the run RNG. Cyclic dependencies fail.

Scalar conversion handles strings/enums, strict booleans, integers, numbers, bigint, decimals and dates. Custom decoders handle other formats. Explicit recipe/call fields beat feed values; feed values beat rules.

## Read CSV or JSON

```ts
const SimpleContactShape = shape.object({ name: shape.string(), age: shape.integer() });
const csvContacts = defineFixture(SimpleContactShape, {
  source: readCsv('name,age\nAda,36\nGrace,85'),
}).many(2, { seed: 42 });
const jsonContacts = defineFixture(SimpleContactShape, {
  source: readJson('[{"name":"Ada","age":36},{"name":"Grace","age":85}]'),
}).many(2, { seed: 42 });
const exportedCsv = writeCsv(csvContacts);
```

Without `columns`, names map directly. CSV supports quoting, escaped quotes, multiline cells, BOM/CRLF, one-character `delimiter`, `commentPrefix`, and `trim: false`. Headers must be unique/nonempty; widths must match. JSON must be an array of objects.

Every source column must be consumed directly or through dependencies. Set `unmatched: 'ignore'` for intentional extras.

## Traversal, filtering, and exhaustion

```ts
const selected = rows([
  { name: 'Ada', age: 36, enabled: true },
  { name: 'Grace', age: 85, enabled: true },
  { name: 'Excluded', age: 10, enabled: false },
], { where: row => row.enabled === true, unmatched: 'ignore', access: 'shuffle', onEnd: 'cycle' });
const repeatedContacts = defineFixture(SimpleContactShape, { source: selected }).many(6, { seed: 42 });
const sampledContacts = defineFixture(SimpleContactShape, {
  source: selected.configure({ access: 'random' }),
}).many(10, { seed: 42 });
```

| Setting | Behavior |
| --- | --- |
| `access: 'sequential'` | Input order; default |
| `access: 'shuffle'` | Seeded order without replacement per pass |
| `access: 'random'` | Sampling with replacement |
| `onEnd: 'fail'` | Exhaustion raises `FEED`; default |
| `onEnd: 'cycle'` | Repeat ordered rows |
| `where` | Filter before generation |

Shuffle cycling repeats the same execution's order. Random access has no exhaustion. Immutable feed specifications own no execution cursor. Empty/fully filtered feeds fail.

## Files and bounded streams

Save as `customers.csv`:

```csv file=customers.csv
name,age
Ada,36
Grace,85
```

```ts
import { readCsvFile, readStream, filePath, materializeFile } from '@integration-testing/test-data-generation/node';
import { sample } from '@integration-testing/test-data-generation';

const fileContacts = defineFixture(SimpleContactShape, {
  source: await readCsvFile('./customers.csv'),
}).many(2, { seed: 42 });

async function* csvChunks(): AsyncIterable<string> {
  yield 'name,age\n';
  yield 'Ada,36\n';
}
const streamSource = await readStream(csvChunks(), { format: 'csv', maxBytes: 1024 });
const streamedContact = defineFixture(SimpleContactShape, { source: streamSource }).one({ seed: 42 });
const outputPath = sample(filePath({ directory: './generated', extension: 'csv' }), { seed: 42 })[0]!;
await materializeFile(outputPath, exportedCsv);
const reopened = await readCsvFile(outputPath);
```

`readJsonFile()` handles JSON files similarly. Node helpers are async preparation. `readStream()` buffers with a default 10 MB cap; it is not a streaming row cursor. `filePath()` only generates a path. `materializeFile()` explicitly writes and refuses overwrites. Stable input contents are required for replay.
