# User guides

Start with the complete [README quick start](../README.md#quick-start). The detailed guides reuse the [Order model](../README.md#reusable-order-model); save that model as `models.ts` when needed. Each guide's TypeScript blocks form a complete example in reading order. Runner examples stand alone. File fences name additional files to create.

| Guide | Questions it answers |
| --- | --- |
| [Models and adapters](models.md) | Shapes or existing interfaces? Real class instances? Zod, JSON Schema, column hints, protobuf? |
| [Recipes](recipes.md) | Custom fields, nested type rules, metadata, precedence, derived values, scenarios? |
| [Object graphs](graphs.md) | Collections, references, recursion, factories, ownership, filling, callbacks, uniqueness? |
| [Data feeds](feeds.md) | Coherent rows, source mapping, templates, transformations, generated columns, access, files? |
| [Generators](generators.md) | Which generators and parameters exist? How do custom generators share seeded state? |
| [Testing](testing.md) | Vitest/Jest setup, seed/clock replay, using generated data with database tests? |
| [Configuration](configuration.md) | Kind defaults, settings precedence, environment variables, JSON files? |
| [API behavior and troubleshooting](usage.md) | Exact behavior, limits, errors and troubleshooting? |
| [Features and limitations](capabilities.md) | Which use cases and integrations are supported? |
| [Playground](playground.md) | How do I run and change the examples locally? |
| [Application examples](examples.md) | How do I organize classes, separate interfaces and complex fixtures? |

To change or release the library itself, use the separate [contributor documentation](../CONTRIBUTING.md).
