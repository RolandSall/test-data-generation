# Feed examples

The [ImportedPerson](models/imported-person.ts) interface has its own file. The [shape](shapes/imported-person-shape.ts) describes its output; the [fixture](fixtures/imported-people.ts) reads [CSV input](data/people.csv), aliases columns, converts age/booleans, generates IDs and derives the display name.

Run from the repository root:

```sh
bun run examples feeds
bun run examples shuffled-feeds
bun run examples feed-overrides
```

| Scenario | Source | Behavior |
| --- | --- | --- |
| `feeds` | [read-sequential-people.ts](scenarios/read-sequential-people.ts) | Consumes complete rows in order, cycling after the last row |
| `shuffled-feeds` | [read-shuffled-people.ts](scenarios/read-shuffled-people.ts) | Uses a seeded row order without replacement within each pass |
| `feed-overrides` | [override-imported-fields.ts](scenarios/override-imported-fields.ts) | Overrides city and active status while retaining the other values from the source row |

The [tests](feeds.test.ts) check row coherence, conversion, computed names, generated IDs, replay and field precedence. Run them with `bun run examples:test`. See the [example index](../README.md).
