# Release Process

This repository publishes three language SDKs plus a Node-only CLI from one shared webhook contract and one shared API contract.

- Node SDK: `@primitivedotdev/sdk`
- Node CLI: `primitive` (also mirrored as `primcli` and the legacy scoped `@primitivedotdev/cli`)
- Python: `primitivedotdev`
- Go: `github.com/primitivedotdev/sdks/sdk-go/v3`

## One version for every package

Every release bumps all four packages to the same version, in the same PR:

- `sdk-node/package.json`
- `cli-node/package.json`
- `sdk-python/pyproject.toml` (and the `primitivedotdev` entry in `sdk-python/uv.lock`)
- `sdk-go/VERSION`

The reason is that there is one source: all four are generated from the one
OpenAPI spec in `openapi/primitive-api.yaml` and the shared webhook schemas, so
a change to that spec changes every package at once. One version means that
`3.1.0` of any of them was built from the same spec as `3.1.0` of the others,
and a user moving between languages, or between the SDK and the CLI, can match
them by number. Bump all four even when only one package has code changes.

`scripts/check-release-versions.sh` (`make versions-check`) fails when the four
versions differ, when the `primitivedotdev` entry in `sdk-python/uv.lock`
does not match, and when `SDK_VERSION_RANGE` or `CLI_VERSION_RANGE` is on
another major. It runs on every pull request in `SDK Checks`, outside the path
filter, and in `make check`, `make release-check` and `make ci`.

When the shared version crosses a major, also update:

- the Go module path in `sdk-go/go.mod` and every import of it (see Go Release);
- `SDK_VERSION_RANGE` and `CLI_VERSION_RANGE` in
  `cli-node/src/oclif/function-templates.ts`, the ranges that `primitive
  functions init` writes into scaffolded projects.

Releases are automated from `main`.

npm may accept a publication while the package is still processing. The release
workflow waits up to 20 minutes for the version to become installable before
creating its GitHub release. If that wait expires, check the registry and rerun
the failed workflow after the version appears; an existing version is not
republished.

- If a PR merges with a new `sdk-node/package.json` version, GitHub Actions publishes the Node SDK.
- If a PR merges with a new `cli-node/package.json` version, GitHub Actions publishes the CLI.
- If a PR merges with a new `sdk-python/pyproject.toml` version, GitHub Actions publishes the Python SDK.
- If a PR merges with a new `sdk-go/VERSION` value, GitHub Actions creates the Go module tag and GitHub release.

## Before Releasing

1. Confirm the working tree is clean.
2. Bump all four package versions to the new version in a release PR (see One version for every package).
3. If the webhook contract or API contract changed, regenerate artifacts for each affected SDK.
4. Ensure the release PR passes the required `SDK Checks` workflow.
5. Add the release's entry to `CHANGELOG.md`, and review the SDK READMEs for any public API changes.
6. Merge the release PR into `main`.

## Node Release

1. Open a PR that bumps `sdk-node/package.json` to the target version, together with the other three packages.
2. Merge that PR into `main`.
3. The `Node Release` workflow verifies the version bump, publishes to npm through trusted publishing/OIDC, and creates the `sdk-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view @primitivedotdev/sdk version`.
5. Confirm the packed artifact exposes `@primitivedotdev/sdk`, `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/api`, `@primitivedotdev/sdk/openapi`, `@primitivedotdev/sdk/contract`, and `@primitivedotdev/sdk/parser`, and that it does NOT install a `primitive` bin (the CLI lives in the separate `primitive` package).

## CLI Release

1. Open a PR that bumps `cli-node/package.json` to the target version, together with the other three packages.
2. Merge that PR into `main`.
3. The `CLI Release` workflow verifies the version bump, publishes to npm through trusted publishing/OIDC, and creates the `cli-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view primitive version`.
5. Confirm the packed artifact exposes the `primitive` bin and that `primitive list-operations` succeeds in a fresh install.

### Bundled primitive-connect skill

`primitive agent connect --session` installs the primitive-connect skill from files bundled in the CLI package, so an installed skill always matches the CLI that installed it. The skill's source is `skills/primitive-connect` in the public [skills repository](https://github.com/primitivedotdev/skills). Before a CLI release that should carry skill changes, vendor the merged commit from a clean checkout of that repository:

```bash
node cli-node/scripts/vendor-connect-skill.mjs --from ../skills
```

This copies the skill (without its tests) into `cli-node/vendor/skills/primitive-connect` and records the commit and content version in `primitive-connect.source.json`. The build copies that snapshot into `dist/skills` with a manifest, and fails if the vendored files were edited by hand. CI checks out the recorded commit and fails if the vendored copy differs from it.

The same workflow also publishes the CLI under two mirror names (via `scripts/cli-mirror-publish.sh`): `primcli` and the legacy scoped `@primitivedotdev/cli` (kept so existing scoped installs keep receiving releases). Each mirror is the identical build with only the package `name` changed, locked to the same version, so `npm install -g primitive`, `npm install -g primcli`, and `npm install -g @primitivedotdev/cli` are interchangeable. The mirror publishes are no-ops when that version already exists, so a re-run is safe. After a release, verify with `npm view primcli version` and `npm view @primitivedotdev/cli version`.

The unscoped name `primcli` is used because npm normalizes package names by stripping `-`/`_`/`.` before checking for collisions, so an all-one-word `primitivecli` collides with the unrelated existing `primitive-cli` and is rejected at publish.

The Node SDK and the CLI ship from the same release PR. The CLI bundles the SDK at build time (it is a `workspace:*` dev dependency, not a runtime one), but projects scaffolded by `primitive functions init` depend on the published SDK, so the `CLI Release` workflow waits until npm can install the matching SDK version before it publishes the CLI.

Both npm packages use npm trusted publishing from GitHub Actions. Do not add npm API tokens; configure npmjs trusted publishers for `@primitivedotdev/sdk` with `.github/workflows/node-release.yml` and `primitive` with `.github/workflows/cli-release.yml`.

Each mirror (`primcli` and `@primitivedotdev/cli`) needs its own npm trusted publisher (same `.github/workflows/cli-release.yml`). All three names already have trusted publishers configured for this workflow (each published from it before or after the rename), so no npm-side changes are needed; the workflow keeps the mirrors in lockstep. For any future new mirror name: npm trusted publishing requires the package to already exist, so claim the name with a one-time manual `npm publish` first (`primcli` was claimed at `primcli@1.2.0`).

## Python Release

1. Open a PR that bumps `sdk-python/pyproject.toml` to the target version, together with the other three packages.
2. Merge that PR into `main`.
3. The `Python Release` workflow verifies the version bump, publishes to PyPI, and creates the `sdk-python/vX.Y.Z` tag plus a GitHub release.
4. Verify the release on PyPI.

## Go Release

1. Ensure the `sdk-go/` module contents are ready to tag.
2. Open a PR that updates `sdk-go/VERSION` to the target version, together with the other three packages.
3. Merge that PR into `main`.
4. The `Go Release` workflow creates the subdirectory-prefixed `sdk-go/vX.Y.Z` tag plus a GitHub release.
5. Verify the subdirectory-prefixed tag resolves correctly through the Go module proxy.

The module path carries the major version, as Go requires for v2 and later: `sdk-go/go.mod` declares `github.com/primitivedotdev/sdks/sdk-go/v3`, and `sdk-go/VERSION` `3.x.y` is tagged `sdk-go/v3.x.y`. The tag keeps the `sdk-go/` directory prefix; the `/v3` lives only in the module path. `scripts/check-go-module-major.sh` runs in `make go-check` and before the release tag is created, and fails when the two disagree. A future major (v4) needs both the module path and every import updated in the same PR as the `VERSION` bump. To confirm a release through the proxy, run `go list -m github.com/primitivedotdev/sdks/sdk-go/v3@v3.x.y`.

## Shared Contract Changes

If a release includes schema or shared-fixture changes:

1. Update `json-schema/email-received-event.schema.json`.
2. Regenerate SDK artifacts.
3. Update `test-fixtures/` if the behavioral contract changed.
4. Ensure the PR passes `SDK Checks` again before merging.

If a release includes API spec changes:

1. Get the OpenAPI document the API serves, as JSON, and save it anywhere on
   disk.
2. Run `make openapi-sync SERVED=<path to that JSON>`. This rewrites
   `openapi/primitive-api.yaml` from it. Do not edit that file by hand: the
   next sync overwrites any hand edit.
3. Run `make regen` (or `make node-generate python-generate go-generate`) to
   regenerate the Node, Python, and Go API clients.
4. Fix any hand-written SDK or CLI code the new spec breaks, and run the
   checks one target at a time.
5. Ensure the PR passes `SDK Checks` again before merging.

Re-running the sync on the same document is a no-op, so the diff after a sync
is exactly what changed in the served document.

The sync applies a fixed set of normalizations, listed and explained at the top
of `packages/api-core/scripts/sync-openapi.ts`. It also carries a short list of
corrections for places where the served document is known to disagree with
what the API sends; each one prints a notice when the served document no longer
needs it, and should then be deleted. Rewrites that only the code generators
need, and that are not valid OpenAPI 3.1, are applied later, when
`openapi/primitive-api.codegen.json` is derived, in
`packages/api-core/scripts/generate-openapi-artifacts.ts`.
