# Library playground

Run these commands from the repository root after `bun install --frozen-lockfile`:

```sh
bun run playground
bun run playground quick-start
bun run playground fields-only
bun run playground rules-only
bun run playground combined
bun run playground automatic
bun run playground orders
bun run playground cancelled
bun run playground batch
bun run playground feeds
bun run playground sessions
bun run playground zod
bun run playground inheritance
bun run playground polymorphism
bun run playground unknown-fields
bun run playground property-selectors
bun run playground:test
```

`playground` builds the package and prints all demos, or the selected demo. `playground:test` builds it, checks the playground's TypeScript, and runs behavioral assertions. Both import the public package name and its Node/Zod entry points, resolving the local workspace package's built output. No source aliases or private engine imports are used.

Edit [the Order model](models/order.ts), [the order recipe](recipes/orders.ts), [the CSV data](data/contacts.csv), or [the Zod schema](recipes/accounts.ts) and rerun. Output uses a fixed seed and clock from [run-options.ts](run-options.ts).

The [tests](playground.test.ts) cover nested generation, custom fields, deep boolean rules, override precedence, derived values, scenarios, coherent feeds, sessions, schema validation and impossible collection sizes. The [inheritance examples](inheritance/README.md) add real subclasses, an implemented interface, polymorphic nested collections, typed selectors and missing-field errors, with [dedicated tests](inheritance/inheritance.test.ts).

The playground is repository-only and excluded from the npm package. See the [user guides](../docs/README.md) for more examples, or [Contributing](../CONTRIBUTING.md) to work on the library itself.

The [property-selector recipe](recipes/property-selectors.ts) references the actual [Customer class](models/customer.ts) through callbacks, including nested fields and subtree scopes. These member accesses support autocomplete and IDE rename, without a dotted path string.

Start with [customization choices](customization/README.md) to compare `fields` only, `rules` only, both, and neither. The [small quick-start recipe](recipes/quick-start.ts) mirrors the standalone example at the top of the root README. The [customization tests](customization/customization.test.ts) verify untouched fields and precedence.

[Schema policies](schema-policies/README.md) demonstrate defaults, optional properties and supplied values.
