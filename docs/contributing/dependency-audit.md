# Dependency audit

For maintainers of the repository's development toolchain. See [Contributing](../../CONTRIBUTING.md).

The verification gate audits dependencies and permits one specific, currently unpatched advisory: [CVE-2026-97058 / GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c), a moderate `sprintf-js` precision-formatting error. The advisory and npm registry were checked on 2026-10-10; the advisory lists no patched release.

The dependency enters this development workspace through Jest's Istanbul configuration loader: `@jest/transform → babel-plugin-istanbul → @istanbuljs/load-nyc-config → js-yaml 3 → argparse 1 → sprintf-js`. The published core package depends only on `randexp`; optional Jest integration uses the consumer's Jest installation. Core generation does not import `sprintf-js` or accept its format strings.

`bun run audit` ignores exactly that advisory's npm identifier (`1241202`) and fails on all other reported advisories. `bun run audit:all` shows the complete report and currently returns a failure for this known advisory. This exception is not a claim that every dependency is vulnerability-free. Remove it when the upstream dependency chain has a compatible patched release; do not replace it with a blanket severity filter or incompatible major-version override.
