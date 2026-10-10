# Example packages

These private workspace packages demonstrate the public library API in application-style code. Each package separates `models/`, `shapes/`, `fixtures/` and `scenarios/`. Every exported interface has its own matching file. Classes and interfaces are separate: `Person` implements `PersonDetails`, declared in another file.

Run from the repository root after `bun install --frozen-lockfile`:

```sh
bun run examples
bun run examples person
bun run examples order
bun run examples:test
```

`examples` builds the local library and prints all scenarios, or the named scenario. `examples:test` builds the package, checks example types and runs their behavior tests. The [shared seed and clock](run-options.ts) make output replayable.

| Package | Scenarios | Start here |
| --- | --- | --- |
| [People](people/README.md) | `person`, `family`, `fill` | Real `Person` instances, nested contacts/preferences, scenarios and filling |
| [Orders](orders/README.md) | `order`, `discounted-orders` | Compose people and line-item recipes, dependent totals, references and filtering |
| [Feeds](feeds/README.md) | `feeds`, `shuffled-feeds`, `feed-overrides` | Import complete rows, derive names, convert values and override columns |

The orders package depends on the people package through its workspace entry point. Each example package depends on the library's public package name. The examples are excluded from the npm archive and each package is marked `private: true`.

The smaller [playground](../playground/README.md) offers quick demos; these packages show how to organize larger models and fixtures. See the [user guides](../docs/README.md) for API details.
