# Generator catalogue

Generators produce values; shapes describe model requirements. Use them in `fields`, rule `use`, providers, or directly with `sample()`.

## Generate standalone values

```ts
import {
  sample, integer, text, pattern, regex, sequence, emit, mapValue, nullable, optional,
  weighted, decimal, Decimal, date, temporal, checksumId, creditCard, luhnDigit,
  generator, defineFixture, shape, annotate,
} from '@integration-testing/test-data-generation';

const numbers = sample(integer({ min: 1, max: 10 }), { seed: 42, count: 5 });
const labels = sample(text({ length: 8, alphabet: 'ABC123' }), { seed: 42, count: 3 });
const codes = sample(pattern('ORD-#d#d#d-#C#C'), { seed: 42, count: 3 });
const matching = sample(regex(/^SKU-[A-Z]{2}-\d{4}$/), { seed: 42, count: 3 });
if (matching.some(code => !/^SKU-[A-Z]{2}-\d{4}$/.test(code))) throw new Error('Regex mismatch');
```

`sample()` always returns an array. Defaults: count 1, seed 1, clock `2020-01-01T00:00:00Z`. Standalone fixtures use their own seed/clock unless configured.

## Strings, numbers, and selections

| Generator | Arguments | Output |
| --- | --- | --- |
| `integer()` | Inclusive safe `min`/`max` | number |
| `number()` | `min`/`max` | Fractional number |
| `bigint()` | bigint `min`/`max` | bigint |
| `boolean(probability)` | True probability, default 0.5 | boolean |
| `oneOf(values)` | Nonempty list | Supplied value |
| `weighted(entries)` | `{ value, weight }` | Weighted value |
| `text()` | `length` or `min`/`max`, `alphabet` | string |
| `character(alphabet)` | Optional alphabet | Character |
| `bytes()` | `length` or `min`/`max` | Uint8Array |
| `regex(expression, maxRepeat)` | RegExp; repeat cap 20 | Supported matching string |
| `pattern(template)` | Tokens below | string |
| `word()`, `lorem(count)`, `wordTemplate(template)` | `{word}` substitutions | Curated text |

Tokens: `#a` alphanumeric, `#c` lowercase, `#C` uppercase, `#d` digit, `#h` lowercase hex, `#H` uppercase hex, `##` literal `#`. Regex generation does not universally solve lookarounds/backreferences or refinements; unsupported/impossible constraints fail within bounds.

```ts
const choices = sample(weighted([{ value: 'common', weight: 9 }, { value: 'rare', weight: 1 }]), { seed: 42, count: 10 });
const ids = sample(sequence({ start: 100, step: 10 }), { seed: 42, count: 3 });
const events = sample(emit(['created', 'paid'], { onEnd: 'cycle' }), { seed: 42, count: 5 });
const formatted = sample(mapValue(integer({ min: 1, max: 99 }), next => 'ID-' + next), { seed: 42 });
const possiblyNull = sample(nullable(text(), 0.2), { seed: 42, count: 5 });
const possiblyMissing = sample(optional(text(), 0.2), { seed: 42, count: 5 });
```

Sequences/emitters own per-execution state. Default emit exhaustion fails. Wrappers suit nullable/optional shapes; required-field null/undefined overrides can deliberately invalidate fixtures.

## Dates, times, and decimals

```ts
const beforeClock = sample(date({ past: true }), { seed: 42, now: '2026-01-01T00:00:00Z', count: 3 });
const dates = sample(temporal('localDate'), { seed: 42, now: '2026-01-01T00:00:00Z', count: 3 });
const amounts = sample(decimal({
  precision: 12, scale: 2, min: Decimal.parse('1.00'), max: Decimal.parse('999.99'),
}), { seed: 42, count: 3 });
const displayedAmount = amounts[0]!.toString();
```

`date({ min, max, past, future })` returns Date; fix `now` for relative-date replay. `duration({ min, max })` returns a numeric amount. `interval(start, { min, max })` returns start/end Dates with a millisecond duration.

`temporal(kind, dateOptions)` returns strings: `instant`, `localDate`, `localDateTime`, `localTime`, `offsetDateTime`, `offsetTime`, `zonedDateTime`, `year`, `yearMonth`, `duration`, `period`. Zoned strings use UTC.

`decimal()` uses BigInt-backed fixed-scale values; default precision 8, scale 2. Bounds must share the scale. `Decimal.parse()`/`toString()` preserve exact values.

## Formats and checksums

| Generator | Scope |
| --- | --- |
| `uuid()` | UUID v4 |
| `email()` | Synthetic `.test` domains |
| `url({ protocol, host, port })`, `ipv4()` | URL/IPv4 |
| `hash(algorithm)` | sha256/sha512/md5 |
| `coordinate()` | Latitude/longitude bounds |
| `currency()` | USD/EUR/GBP/JPY/CAD/AUD/CHF/CNY/INR/BRL/PLN/LBP |
| `shuffled(items)` | Seeded reordered copy |
| `checksum(kind, length)` | luhn/mod10/mod11 |
| `luhnDigit()`, `mod10Digit()`, `mod11Digit()` | Check digit helpers |
| `creditCard()` | Synthetic 16-digit Visa-style Luhn number |
| `checksumId({ kind })` | EAN-13 (`EAN`), ISBN-13 (`ISBN`) or ISBN-10 (`ISBN10`) checksum format |
| `atomicInteger()`, `atomicBigint()` | SharedArrayBuffer-backed Int32Array/BigInt64Array |

Barcode/book generators produce synthetic checksum values; they do not allocate registered publication or publisher identifiers.

```ts
const bookNumbers = sample(checksumId({ kind: 'ISBN' }), { seed: 42 });
const card = sample(creditCard(), { seed: 42 })[0]!;
if (Number(card.at(-1)) !== luhnDigit(card.slice(0, -1))) throw new Error('Invalid checksum');
```

## Custom generators and providers

Application-specific formats and business rules belong in your own generators. Pass them through `fields`, rules or providers; use the supplied random source for reproducible results.

```ts
const serialState = {};
const serial = generator(context => {
  const counter = context.state(serialState, () => ({ value: 0 }));
  return 'SER-' + ++counter.value + '-' + context.random.int(100, 999);
});
const serials = sample(serial, { seed: 42, count: 3 });
const AccountNumberShape = annotate(
  shape.custom<string>(input => typeof input === 'string' && /^ACC-\d{4}$/.test(input) ? [] : ['Invalid account number']),
  { domain: 'account-number' },
);
const accounts = defineFixture(shape.object({ accountNumber: AccountNumberShape }), {
  providers: [{
    match: node => node.metadata?.domain === 'account-number',
    generate: generator(({ random }) => 'ACC-' + random.int(1000, 9999)),
  }],
});
const account = accounts.one({ seed: 42, check: 'schema' });
```

Context: `random`, `now`, `path`, `index`, `root`, `state(key, initialize)`. State belongs to the execution. Use its RNG/clock for replay. Providers match shape kind/metadata and share the context. Custom shapes require a provider or explicit generator; enable validation for the completed result.
