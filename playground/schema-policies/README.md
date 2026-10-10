# Schema policies

Run `bun run playground defaults` to compare normal generation, preservation of declared defaults, omission of optional properties, and supplied empty strings. See [defaults.ts](defaults.ts) and the [configuration guide](../../docs/configuration.md#schema-defaults-and-optional-properties).

Run `bun run playground schema-modes` for nested transformation input/output examples in [modes.ts](modes.ts). See [Zod models](../../docs/models.md#zod).

Run `bun run playground selective` to compare full generation, explicit partial selection, and blank objects in [selective.ts](selective.ts). See [only provided properties](../../docs/graphs.md#only-provided-properties).
