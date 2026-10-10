# Features and limitations

Use the library to build repeatable test data from runtime shapes, existing schemas or explicitly read TypeScript declarations.

| Use case | Supported behavior | Guide |
| --- | --- | --- |
| Describe your model | Typed shapes, existing TypeScript declarations, Zod, JSON Schema, column hints and protobufjs | [Models](models.md) |
| Generate nested data | Objects, arrays, sets, maps, tuples, unions, recursive models and shared references | [Object graphs](graphs.md) |
| Construct class instances | Your constructor factories, transformations and registered setters | [Class factories](graphs.md#class-factories-and-setters) |
| Customize values | Typed field overrides, custom generators and path/type/subtree rules | [Recipes](recipes.md) |
| Reuse scenarios | Recipe extension, named cases, nested fixtures and finite combinations | [Scenarios](recipes.md#reuse-recipes-and-define-scenarios) |
| Keep fields consistent | Typed dependent values, including per-element computations | [Derived fields](recipes.md#derive-dependent-values) |
| Reuse or fill existing data | Copied/shared values, factories, filling, omission and blank objects | [Ownership](graphs.md#ownership-and-existing-values) |
| Filter and deduplicate | Bounded filtering, field/composite uniqueness and collection size checks | [Filters and uniqueness](graphs.md#filters-and-uniqueness) |
| Import data | Coherent CSV/JSON rows, column mappings, transforms, sequential/random/shuffle access | [Feeds](feeds.md) |
| Generate standalone values | Strings, numbers, dates, decimals, formats, sequences and custom providers | [Generators](generators.md) |
| Configure generation | Seed, clock, defaults, limits, explicit environment layers and JSON settings | [Configuration](configuration.md) |
| Replay tests | Recorded seed/clock, reusable sessions and optional Vitest/Jest integration | [Testing](testing.md) |
| Diagnose failures | Error codes, field paths, seeds, retry limits and optional tracing | [Troubleshooting](usage.md#troubleshooting) |

## Choose explicit behavior

- TypeScript interfaces need source extraction or runtime shapes; a generic argument alone cannot discover their fields.
- Class instances require your factory or transformation. Generation does not bypass constructor invariants.
- Use `optional` and `nullable` shapes for absent and null values. `omit()` and `blank()` can deliberately create incomplete fixtures.
- Explicit field overrides can create invalid input for negative tests. Set `check: 'schema'` to validate the completed result.
- Fix the seed, clock, recipe, options, source contents and library version to replay an execution.
- An impossible fixed collection size fails. Filters and uniqueness stop at the configured retry limit.

## Integration limits

The schema adapters support the subsets described in [Models](models.md). Arbitrary regexes/refinements, async schema effects, external JSON Schema references and unsupported TypeScript constructs need explicit generators, providers or preparation.

Database startup, insertion, transactions, foreign keys and database uniqueness belong to your integration-test setup and persistence code. Generated fixtures can be passed to those operations; generation does not execute them.

The package supports ESM and CommonJS with matching TypeScript declarations; the Vitest integration is ESM. Install optional peers only for the integrations you use. See the [quick start](../README.md#quick-start) and [API behavior](usage.md) for examples and detailed contracts.
