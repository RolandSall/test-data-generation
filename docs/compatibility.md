# Compatibility and deterministic replay

The core needs Node.js 22.22+ and supports ESM/CommonJS without installing optional integrations. CI verifies a packed core-only consumer separately. Optional adapters are loaded through their own entry points; install only the peers you use.

| Integration | Declared peer range | Minimum tested | Current pinned/tested | Runtime consumer checks |
| --- | --- | --- | --- | --- |
| Zod | `>=4.3 <5` | 4.3.0 | 4.6.5 | ESM and CommonJS; full adapter regressions |
| TypeScript extraction | `>=5.9 <8` | 5.9.2 | 5.9.3 | ESM and CommonJS |
| protobufjs | `>=8.8 <9` | 8.8.0 | 8.8.0 | ESM and CommonJS |
| Vitest | `>=4.1 <5` | 4.1.0 | 4.1.11 | ESM runner |
| Jest globals | `>=30.1 <31` | 30.1.0 | 30.5.2 | Matching Jest version, CommonJS runner |

The CI matrix runs both version columns using installed package declarations and real adapter/runner calls on Node 22.22.0. Every entry checks TypeScript consumer compilation with dependency checking enabled. Consumers install Node 22 type declarations; runner consumers also include `ESNext.Disposable` in TypeScript's `lib`, as required by runner dependency declarations. The peer range permits versions between those limits; the table identifies the exact versions verified and does not imply that every permitted version or newer major has been tested. Other Node/platform versions are not part of this matrix.

Zod has an additional CI cell for **4.3.6**. All three Zod versions (4.3.0, 4.3.6 and 4.6.5) run every library regression file using Zod against an isolated installed package, including constraints, collections, defaults/factories, optional properties, input/output transforms, pipelines and path diagnostics. Those files are also compiled against the selected Zod version. Installations use the declared peer range without bypassing dependency checks. Core generation still does not require Zod.

## Replaying a result

```ts file=replay.ts standalone
import { defineFixture, shape } from '@integration-testing/test-data-generation';
const people = defineFixture(shape.object({ name: shape.string(), age: shape.integer() }));
const result = people.result({ seed: 42, now: '2026-01-01T00:00:00Z' });
// Save result.seed and result.now alongside your failing test.
const replayed = people.one({ seed: result.seed, now: result.now });
```

Replay means repeating the same execution under the same conditions:

| Keep stable | Why it matters |
| --- | --- |
| Seed | Determines the random sequence |
| Clock (`now`) | Controls relative dates and clock-dependent generators |
| Recipe and settings | Shapes, constraints, fields, rules, selected case, providers and retry budgets affect generation |
| Generation order | Field order, session call order, counts, stream consumption and retries consume random/state values in order |
| Source data | Row contents, ordering, feed configuration and external preparation must match |
| Package/dependency versions | Generator algorithms, adapter parsing and validation behavior can change |
| Custom code and external state | Factories, providers, refinements and transforms must use controlled inputs and the supplied context |

A seed alone does not promise identical output after changing the recipe or upgrading the package. No cross-version golden-output guarantee is made. Default factories using `Math.random()`, system time or external counters are outside the seeded engine's control. `result()` records seed and clock; it does not serialize the recipe, source data, custom code or a session's earlier calls. To replay a batch/session failure, repeat the same preceding calls and consume the stream to the same position.

## State and uniqueness scope

- Each independent `one()`, `result()`, `many()`, `stream()` or `fill()` execution has its own random/state/uniqueness storage. Repeated standalone calls reset that storage.
- A `many()` batch or one `stream()` iterator advances one execution. `fixtureRun()` shares execution state across its calls and recipes. Generator state is keyed by generator identity; reusing a sequence/feed instance shares its state within that execution.
- Collection uniqueness applies within that collection. Recipe `unique` keys apply to that fixture identity across its accepted roots in the execution. Separate fixture identities have separate recipe-key domains.
- Rule `unique: true` uses that rule's identity. Rule `unique: 'group-name'` shares a named domain across matching nodes and recipes within the same execution.
- Composite uniqueness compares tuples; shared scope compares individual values across its configured paths. Uniqueness is opt-in and bounded by `maxAttempts`.
- Failed candidates roll back their reservations; previously accepted values remain reserved. Independent executions never share library-managed uniqueness storage.

This provides no process-wide, cross-worker, persistent or database uniqueness guarantee. Caller-owned mutable closures and explicitly shared objects can still share external state; the library does not reset them.

See [uniqueness examples](graphs.md#filters-and-uniqueness) and the runnable [replay playground](../playground/schema-policies/README.md).
