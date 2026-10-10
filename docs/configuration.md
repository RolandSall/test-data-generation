# Configuration and defaults

## Per-run options and kind defaults

Reuse the [Order model](../README.md#reusable-order-model).

```ts
import { resolveSettings, parseSettings, fixtureRun } from '@integration-testing/test-data-generation';
import { orders } from './models.js';
const configured = orders.one({
  seed: 42, now: '2026-01-01T00:00:00Z',
  defaults: { string: { minLength: 4, maxLength: 12 }, array: { minSize: 1, maxSize: 3 } },
  maxDepth: 8, maxAttempts: 100, maxNodes: 100000, check: 'schema',
});
```

Defaults apply across graphs; explicit shape constraints take precedence. Fields/cases/rules/providers belong in recipes. Sessions own seed/clock/budgets/defaults; `make()` accepts fields/case/check/strictness.

## Schema defaults and optional properties

Normal generation creates values and populates optional properties. `schemaDefaults: 'preserve'` opts into declared Zod or JSON Schema defaults; it is separate from the `defaults` setting, which configures generation constraints by kind.

```ts file=schema-policies.ts standalone
import { defineFixture } from '@integration-testing/test-data-generation';
import { fromZod } from '@integration-testing/test-data-generation/zod';
import { z } from 'zod';
const accounts = defineFixture(fromZod(z.object({
  status: z.string().default('pending'),
  nickname: z.string().optional(),
})));
const generated = accounts.one({ seed: 42 }); // Both properties generate.
const declared = accounts.one({ seed: 42, schemaDefaults: 'preserve', optionalProbability: 1 });
// { status: 'pending' }; nickname is absent.
```

`optionalProbability: 0` always populates optional fields; `1` omits them; intermediate values exercise both cases. Explicit field values/generators and matching providers take precedence over schema defaults. An optional wrapper can still omit its inner default when omission is requested. Supplied `null`, `false`, zero, empty strings and empty arrays/maps/sets are preserved. `fill()` preserves initialized values; `mode: 'nullish'` additionally replaces null.

Zod defaults supply output values; prefaults pass their input fallback through parsing. Default factories execute only when preservation is requested and that default is needed. Mutable defaults are copied. Factories using external state, randomness or time must be controlled separately for replay. The policy does not preserve database defaults or infer defaults from TypeScript declarations.

## Explicit configuration layers

```ts
const settings = resolveSettings({
  defaults: { seed: 1, maxAttempts: 100 },
  environment: { TEST_DATA_SEED: 'ci-job-42', TEST_DATA_NOW: '2026-01-01T00:00:00Z' },
  overrides: { maxAttempts: 200 },
});
const run = fixtureRun(settings);
const fromSettings = run.make(orders);
```

Precedence: defaults, environment, explicit overrides. Core never implicitly reads `process.env`; pass `environment: process.env` to opt in. Runners read documented seed/clock variables.

| Environment variable | Type |
| --- | --- |
| `TEST_DATA_SEED` | String seed |
| `TEST_DATA_NOW` | ISO date/time |
| `TEST_DATA_MAX_DEPTH` | Nonnegative integer |
| `TEST_DATA_MAX_ATTEMPTS` | Positive integer |
| `TEST_DATA_MAX_NODES` | Positive integer |
| `TEST_DATA_NULL_PROBABILITY` | Number in [0, 1] |
| `TEST_DATA_OPTIONAL_PROBABILITY` | Number in [0, 1] |
| `TEST_DATA_STRICT` | `true` or `false` |

Standalone calls combine recipe settings, selected case settings, then call options. Trees merge by property. See [precedence](recipes.md#precedence-and-strict-matching).

## JSON settings

Save as `test-data.json`:

```json file=test-data.json
{
  "seed": 42,
  "now": "2026-01-01T00:00:00Z",
  "check": "schema",
  "maxAttempts": 100,
  "defaults": {
    "string": { "minLength": 4, "maxLength": 12 },
    "array": { "minSize": 1, "maxSize": 3 }
  }
}
```

```ts
import { readSettingsFile } from '@integration-testing/test-data-generation/node';
const fileSettings = await readSettingsFile('./test-data.json', { overrides: { seed: 'local-replay' } });
const fromFile = orders.one(fileSettings);
const inlineSettings = parseSettings('{"seed":42,"defaults":{"bigint":{"bigMin":"1","bigMax":"999999999999999999"}}}');
```

Unknown settings fail. JSON regexes are source strings; bigint bounds are decimal strings. Callbacks/fields/cases/providers remain in code.

## Defaults and limits

| Option | Default | Purpose |
| --- | --- | --- |
| `seed` | Generated for standalone fixtures | Replay |
| `now` | Execution creation time | Relative dates |
| `strict` | `true` | Fail unused rules/completion |
| `check` | `none` | Final schema check |
| `schemaDefaults` | `generate` | Generate values or preserve declared schema defaults |
| `maxDepth` | 8 | Recursion depth |
| `maxAttempts` | 100 | Retry budget |
| `maxNodes` | 100000 | Graph size |
| `cycle` | `omit` | Recursive cycles |
| `nullProbability` | 0.2 | Nullable nulls |
| `optionalProbability` | 0 | Optional absence |
| Cartesian `limit` | 10000 | Product guard |

Limits bound work without making impossible requirements successful. Specify collection bounds for finite domains. Cutoffs can produce partial graphs that fail validation. `trace` accepts a callback with path/kind/action events; trace sequences can change with versions.
