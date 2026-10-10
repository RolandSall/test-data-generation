# Repository scripts and verification

For contributors maintaining the library. The `scripts/` directory contains repository maintenance and verification tools. These tools are excluded from the npm package. Start with [Contributing](../../CONTRIBUTING.md) for setup.

| File | Purpose | Command |
| --- | --- | --- |
| `sync-readme.ts` | Copies the root README into the package, rewriting documentation links for npm readers. `--check` reports a stale copy. | `bun run docs:sync` |
| `check-docs.ts` | Checks local links, compiles TypeScript snippets, runs guide programs and runs the documented Jest/Vitest examples against the built package. | `bun run docs:check` |
| `prepare-dual-types.ts` | Copies generated declarations into a CommonJS declaration tree so both ESM and CommonJS imports have the right types. | Runs inside `bun run build` |
| `verify-package.ts` | Packs the library, checks every export and the payload, installs it into temporary consumers, and verifies ESM/CommonJS, optional adapters and runner replay reports. Temporary consumers are removed afterward. | `bun run pack:check` |
| `verify-release.ts` | Checks the version, repository metadata in CI, clean Git checkout and availability of that version on npm. It does not publish. | `bun run release:check` |

## Everyday commands

```sh
bun install --frozen-lockfile
bun run build
bun run test
bun run examples
bun run examples:test
bun run playground
bun run playground:test
bun run verify
```

`typecheck` checks library/tests/tooling; `lint` checks repository TypeScript, including examples and the playground. `test` and `test:coverage` run the library unit suite. `examples:test` and `playground:test` each build the public package, type-check their consumer code and run behavior tests. They are separate from the initial type check because their public imports require the built declarations. `verify` runs the dependency audit, type checking, lint, library coverage, example checks, playground checks, documentation checks and packed-consumer checks. Package checks install temporary npm consumers and require network access.

`audit` applies the single documented [development dependency exception](dependency-audit.md); `audit:all` shows the unrestricted report.

## Maintain documentation

The root README is the source for the npm README. Run `bun run docs:sync` after editing it. The generated copy rewrites documentation links to repository URLs.

Keep package usage in `docs/` and contributor material in `docs/contributing/`. The documentation checker visits both directories, the root README, `CONTRIBUTING.md`, all example READMEs and all playground READMEs. It validates links, compiles TypeScript snippets, executes guide examples and runs the documented Jest/Vitest tests. Temporary files are removed afterward.

For a self-contained example such as the quick start, mark its fence `ts file=quick-start.ts standalone`. The checker compiles and runs that snippet as a separate module. Ordinary TypeScript blocks in a guide run together in reading order.

User examples should import public package entry points. The [playground guide](../playground.md) describes the runnable demos; its assertions are included in `verify`.

## Package boundaries

The root workspace and `examples/*` packages are private. Only `packages/test-data` is published, with a `files` allowlist of `dist`, `README.md` and `LICENSE` (npm also includes the manifest). Examples and the playground are outside that package and are never imported by library source. The package checker additionally rejects any tarball path containing an `examples` or `playground` directory.
