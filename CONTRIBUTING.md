# Contributing

This guide is for changing, testing and releasing the library. To use the package in an application, start with the [README](README.md) and [user guides](docs/README.md).

## Local setup

Use Node.js 22.22+ and Bun 1.3.5. Run these commands from the repository root:

```sh
bun install --frozen-lockfile
bun run verify
```

`verify` runs the dependency audit, type checking, lint, library coverage, example-package tests, playground tests, documentation checks and packed-consumer checks. The package checks install temporary npm consumers and require network access. See [scripts and verification](docs/contributing/development.md) for focused commands.

## Contributor guides

| Guide | Purpose |
| --- | --- |
| [Architecture](docs/contributing/architecture.md) | Internal abstractions, module ownership, execution state and extension points |
| [Scripts and verification](docs/contributing/development.md) | Build tooling, package checks, documentation maintenance and package boundaries |
| [Dependency audit](docs/contributing/dependency-audit.md) | The specific development dependency exception and how to remove it |
| [Publishing](docs/contributing/publishing.md) | Repository setup, trusted publishing and release checks |

Keep consumer examples in the [user guides](docs/README.md) and [playground](playground/README.md). Keep engine internals, CI, audits and release procedures in `docs/contributing/`. Documentation checks include both audiences.
