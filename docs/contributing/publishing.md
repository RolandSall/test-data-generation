# Publishing

For maintainers releasing the library. See [Contributing](../../CONTRIBUTING.md) for local setup.

The package is prepared as `@integration-testing/test-data-generation@0.1.0`. It has not been published by this implementation task.

1. Use `RolandSall/test-data-generation` with `main` as the release branch. Check that package repository/homepage/issue metadata matches the actual repository before releasing.
2. Configure the npm organization and this package's trusted publisher for the GitHub repository, `release.yml` workflow and `npm` environment. Configure that GitHub environment according to the desired release policy.
3. Run `bun install --frozen-lockfile` and `bun run verify` from a clean checkout. Update the package version for later releases.
4. Dispatch the Release workflow on `main`, selecting `latest` or `beta`.

The workflow verifies the exact checkout, checks that the npm version is unpublished and repository metadata matches the actual GitHub repository, then publishes with npm provenance. It has OIDC permission and uses pinned actions. No stored npm token is required by the prepared workflow.

Local preparation:

```sh
bun run verify
cd packages/test-data
npm pack --dry-run
```

`bun run release:check` requires a clean Git checkout and registry access; it should fail on an uncommitted local development tree. `pack:check` inspects all export targets and the exact npm archive, then installs that archive in a temporary consumer to verify ESM/CommonJS, declaration resolution and actual Jest/Vitest integration.

Npm publication is separate from pushing code to GitHub. Configure the trusted publisher before releasing; checked-in workflows alone do not establish that setup or prove a successful release.

Review the specific development-tool exception in [dependency auditing](dependency-audit.md). The release gate retains that exact exception and rejects other advisories; the unrestricted audit command is also available.
