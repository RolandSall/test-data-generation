# Choose a customization style

Run these commands from the repository root:

```sh
bun run playground quick-start
bun run playground fields-only
bun run playground rules-only
bun run playground combined
bun run playground automatic
bun run playground:test
```

The [quick-start recipe](../recipes/quick-start.ts) matches the small example at the top of the [README](../../README.md#quick-start): set the name with a property selector and generate age and active status automatically.

The [model](model.ts) adds nested address and preference fields. The [fixtures](fixtures.ts) show four independent choices:

| Demo | Configuration | What it does |
| --- | --- | --- |
| `fields-only` | Only `fields` | Set name and address city; generate everything else |
| `rules-only` | Only `rules` | Set the same properties through typed property callbacks |
| `combined` | Both | Set every preference boolean to true, with an explicit false override for SMS |
| `automatic` | Neither | Generate every declared property from the shape |

You do not need both `fields` and `rules`. Combining them is useful when a broad rule has a specific exception. In that case the explicit `fields` generation instruction takes precedence for that property.

All demos use the [fixed seed and clock](../run-options.ts) and validate the completed model. The [tests](customization.test.ts) verify the standalone styles, untouched properties and combined precedence. The playground is excluded from npm packaging.
