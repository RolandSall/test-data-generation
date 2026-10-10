# API behavior and troubleshooting

For worked examples, start with the [documentation index](README.md). This reference describes runtime contracts and limitations.

## Runtime shapes

`shape` describes strings, numbers, safe integers, arbitrary-precision bigint, booleans, dates, bytes, literals, enums, objects, arrays, tuples, maps, sets, records, unions, optional/nullable fields, lazy recursive types, references and transformations. `decimalShape()` returns BigInt-backed fixed-scale `Decimal` values. `constrain()`, `annotate()` and `refine()` attach constraints, domain metadata and bounded custom validation. `shape.class()` constructs real class instances through an explicit factory and optional registered setters.


An optional property, nullable value, omitted property and empty collection are distinct. Optional fields are populated by default; set `optionalProbability` to exercise absence. Nullable fields use `nullProbability` (default 0.2). Configuring an explicit `null` preserves that choice. Use `omit()` to omit a node and `blank()` to build an empty subtree. Blank roots have absent scalar properties, nested blank objects and empty collections. Full generation remains the default. `onlyProvided: true` on a generation call returns a partial data object containing only merged `fields` selections; unselected properties are absent. See [selective generation](graphs.md#only-provided-properties).

## Recipes and dependent fields

Field trees are typed against the shape's output. Unspecified fields are generated. Object field trees configure partial generation; `value(object)` replaces a whole object. Arrays used as values are copied per occurrence. Cases and `extend()` merge nested field instructions without changing the original recipe.


`derive()` checks dependency paths and argument types. Computations run in topological order within the current object. In collections, each element has its own local computation scope. Missing inputs, dependency cycles and a field declared both computed and independently overridden fail. Use explicit root paths for `shape.reference()` or `reference()` to declare shared graph edges. Mutable graphs can use `cycle: 'reference'`; default recursion cuts off by omission. `cycle: 'null'` and `'error'` are alternatives. Final schema validation detects cutoffs incompatible with required types.

## Global rules and precedence


Rules support exact/wildcard paths, kinds, subtree scope, depth, indices, metadata and predicates. Paths are relative to their recipe insertion point. More specific path/index matches beat broad kind matches; the last equally specific match wins. Recipe/call fields beat feed values; feed values beat generation rules. Rules that match nothing fail in strict mode; set `optional: true` on reusable optional rules or `strict: false` for a run. Collection index rules do not silently resize collections; set the desired count with `listOf()` or size constraints.

## Ownership and completion

| Instruction | Ownership | Further population | Default completion |
| --- | --- | --- | --- |
| `shared(object)` | Exact instance | No | No |
| `value(object)` | Copied per occurrence | No | No |
| `fresh(factory)` | Factory controls identity | No | No |
| `populate(factory)` | Factory controls identity | Fill missing fields | Yes |
| `generator(fn)` | Generated value | Treated as completed value | Yes |

Use `populate(ctx => yourGenerator.generate(ctx))` when a generated object's fields need further population. Completion transformations run after graph construction and references are wired. Returning a replacement supports immutable objects. `includeSupplied: true` explicitly includes opaque supplied values. Callbacks are skipped for null/undefined. A strict callback matching only excluded opaque values is unused.

Completion replacements compose in registration order. Map paths use `mapName.*.key` and `mapName.*.value`; set/array paths use numeric indices, and record values use their actual keys. Copied values support plain objects and the library's date/bytes/decimal/collection values. Opaque class instances require `shared()` or `fresh()` so private state remains valid.

`fill(existing)` mutates the provided root while preserving initialized values and collection sizes. `mode: 'missing'` fills undefined/absent fields, `'nullish'` also fills nulls, and `'rules'` applies only explicit instructions. Existing zero and false are preserved. Frozen input cannot be populated; class factories must preserve construction invariants.

## Filters and uniqueness

Node rules can supply a `filter` or `unique` group. Named groups share one domain across matching fields. A recipe's `unique: ['id']` tracks a field across a batch; `{ paths: ['name', 'age'], scope: 'composite' }` tracks tuple keys. `scope: 'shared'` shares a domain across several fields. Composite paths avoid trying to structurally compare cyclic objects.

Retries are bounded by `maxAttempts` (default 100). Known finite-domain set/unique-array requests are checked before generation. Impossible requirements fail; the library does not return silently undersized collections. Generated graph size is limited by `maxNodes` and `maxDepth`.

## Feeds

`rows()`, `readCsv()` and `readJson()` build reusable immutable source specifications. `/node` adds async files and streams. Sources support sequential traversal, seeded sampling with replacement, seeded shuffle without replacement, filtering and fail/cycle end policies. Each execution owns its cursor. Random sampling has no sequential exhaustion.

`columns` maps fields to source names or typed column specs. `column()` decodes strings; `template()` and `combineColumns()` resolve dependencies in one row; `generatedColumn()` supplements values with the run's RNG; `transformColumn()` preserves processing order; `nullableColumn()` injects seeded nulls. Feed-column dependency cycles fail. Without a mapping, source columns map by name. Unmapped source columns fail unless `unmatched: 'ignore'` is set. Scalar conversion handles strings, enums, strict booleans, integers, floating-point numbers, bigint, decimals and dates; custom decoders handle other formats.

## Constraints and generators

The [generator catalogue](generators.md) covers numeric ranges, text and patterns, UUIDs, email, URLs, dates, decimals, checksums and other formats. Use `sample()` to generate standalone values with a seed and clock. The currency catalogue is curated and zoned date strings use UTC. Supply application-specific formats and business rules through custom generators or providers.

Provider registries match shape kind or metadata and receive the same execution context. No generator uses process-global random state. Opaque supplied overrides can intentionally violate constraints. `check: 'schema'` validates the completed root after computations and completion transformations. Regex constructs or arbitrary refinements that cannot be generated within a bounded budget fail rather than promise universal constraint solving.

## Adapters

- `fromZod()` uses the documented Zod core definitions and Zod's independent validator. It supports object/container schemas, primitives, recognized constraints, refinements, unions, lazy types, readonly objects, intersections and synchronous pipeline transformations. Output is the default; `{ mode: 'input' }` produces raw input. Overrides use the selected mode, and parsed output is not revalidated as raw input. Unrepresentable custom schemas require providers; variadic tuples require an explicit collection recipe. Async transforms/refinements require application-owned async preparation rather than synchronous generation.
- `fromJsonSchema()` supports local references, supported scalar/object/container constraints, optional properties, constants, enums, unions and object intersections. External references and advanced logical keywords need explicit preprocessing/providers.
- `describeType()` explicitly reads source files through the TypeScript compiler and returns runtime shapes. Call it during test setup or from build tooling; it requires source-file access and the optional compiler peer. It handles resolved generics, inheritance, unions, arrays, tuples, maps, sets, records and recursive types. It does not install a compiler transformer or generate source files automatically. Unbound generic parameters, any/unknown/never and methods require explicit metadata/factories. Class metadata does not bypass constructors; use `shape.class()` for runtime class instances.
- `fromColumns()` consumes ORM-neutral column descriptors. Precision/scale use `Decimal`; relationships are ordinary shape/reference instructions. Database insertion, transactions and database uniqueness are outside generation.
- `fromProtobuf()` uses protobufjs descriptors, message builders, repeated fields, typed map keys, enums, oneofs and bytes. Wire integers use safe numbers for 32-bit types and string-to-Long construction for full-width 64-bit fields. Reference cycles must terminate before encoding.

## Replay and runners

`resolveSettings({ defaults, environment, overrides })` merges explicit layers. Passing `process.env` opts into `TEST_DATA_*` settings; it is never read implicitly by core generation. `/node` supplies `readSettingsFile()` for JSON configuration; `parseSettings()` also accepts a JSON string. Unknown settings fail. Kind defaults such as `defaults: { string: { minLength: 4, maxLength: 12 }, array: { minSize: 1, maxSize: 3 } }` apply across a graph; explicit descriptor constraints take precedence. Patterns in JSON use regex source strings and bigint bounds use decimal strings.

See the [compatibility matrix and replay contract](compatibility.md) for tested peer versions, stable replay inputs, and exact uniqueness/session scopes.

Standalone `one()` resets RNG/counters/cursors; `many()` and `stream()` advance one execution context. `fixtureRun()` advances state across several recipes. `result()` records seed and clock. Supply a fixed `now` for relative-date replay; external source contents, recipes and generator versions must remain unchanged. Streams are unbounded: use finite iteration or stop explicitly.

A session owns its seed, clock, budgets and kind defaults. Set these on `fixtureRun()`; individual `make()` calls accept fields, cases, strictness and schema checking. Standalone calls merge recipe settings, selected case settings, then call settings.

The optional Vitest entry exports `test` with a typed `data` session. The optional Jest entry exports `given(name, recipes, body, options)` with inferred arguments. Both provide isolated per-test sessions. Failures report `TEST_DATA_SEED` and `TEST_DATA_NOW`; set both for replay. See [test runner examples](testing.md).

## Troubleshooting

| Error code | Check first |
| --- | --- |
| `CONFIGURATION` | Unknown cases/settings, invalid budgets, unsupported adapter metadata |
| `UNUSED_RULE` | Path/kind/subtree matches; use `optional: true` only for intentionally reusable rules |
| `CONSTRAINT` | Finite domains, collection bounds, unsupported generation constraints |
| `RETRY_EXHAUSTED` | Filters/refinements/uniqueness too restrictive for the budget |
| `DEPTH` | Recursion policy and `maxDepth` |
| `FEED` | Row exhaustion, missing/unmapped columns, malformed input |
| `DEPENDENCY` | Computed/reference/column paths and cycles |
| `CONSTRUCTION` | Factory invariants, assignment/setters, opaque class ownership |
| `VALIDATION` | Completed output versus declared shape; explicit overrides and cutoffs |

Errors carry a code/path and, when available, seed. Runtime validation catches contract violations; increasing budgets cannot solve logically impossible requirements.
