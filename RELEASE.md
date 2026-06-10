# Release Process

This repository publishes three language SDKs plus a Node-only CLI from one shared webhook contract and one shared API contract.

- Node SDK: `@primitivedotdev/sdk`
- Node CLI: `@primitivedotdev/cli` (also mirrored unscoped as `primitivecli`)
- Python: `primitivedotdev`
- Go: `github.com/primitivedotdev/sdks/sdk-go`

Use this process when cutting a release for one or more packages.

Releases are automated from `main`.

- If a PR merges with a new `sdk-node/package.json` version, GitHub Actions publishes the Node SDK.
- If a PR merges with a new `cli-node/package.json` version, GitHub Actions publishes the CLI.
- If a PR merges with a new `sdk-python/pyproject.toml` version, GitHub Actions publishes the Python SDK.
- If a PR merges with a new `sdk-go/VERSION` value, GitHub Actions creates the Go module tag and GitHub release.

## Before Releasing

1. Confirm the working tree is clean.
2. Update the relevant SDK version metadata in a release PR.
3. If the webhook contract or API contract changed, regenerate artifacts for each affected SDK.
4. Ensure the release PR passes the required `SDK Checks` workflow.
5. Review the SDK README and changelog notes for any public API changes.
6. Merge the release PR into `main`.

## Node Release

1. Open a PR that bumps `sdk-node/package.json` to the target version.
2. Merge that PR into `main`.
3. The `Node Release` workflow verifies the version bump, publishes to npm through trusted publishing/OIDC, and creates the `sdk-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view @primitivedotdev/sdk version`.
5. Confirm the packed artifact exposes `@primitivedotdev/sdk`, `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/api`, `@primitivedotdev/sdk/openapi`, `@primitivedotdev/sdk/contract`, and `@primitivedotdev/sdk/parser`, and that it does NOT install a `primitive` bin (the CLI lives in `@primitivedotdev/cli`).

## CLI Release

1. Open a PR that bumps `cli-node/package.json` to the target version.
2. Merge that PR into `main`.
3. The `CLI Release` workflow verifies the version bump, publishes to npm through trusted publishing/OIDC, and creates the `cli-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view @primitivedotdev/cli version`.
5. Confirm the packed artifact exposes the `primitive` bin and that `primitive list-operations` succeeds in a fresh install.

The same workflow also publishes the CLI a second time under the unscoped name `primitivecli` (via `scripts/cli-mirror-publish.sh`). The mirror is the identical build with only the package `name` changed, locked to the same version, so `npm install -g primitivecli` and `npm install -g @primitivedotdev/cli` are interchangeable. The mirror publish is a no-op when that version already exists, so a re-run is safe. After a release, verify with `npm view primitivecli version`.

Coordinate Node SDK and CLI releases when both ship in the same cycle: cut the SDK first (so its npm version is available), then bump CLI's `@primitivedotdev/sdk` dep range if needed and ship CLI.

Both npm packages use npm trusted publishing from GitHub Actions. Do not add npm API tokens; configure npmjs trusted publishers for `@primitivedotdev/sdk` with `.github/workflows/node-release.yml` and `@primitivedotdev/cli` with `.github/workflows/cli-release.yml`.

The unscoped `primitivecli` mirror needs its own npm trusted publisher (same `.github/workflows/cli-release.yml`). Because npm trusted publishing requires the package to already exist, the first `primitivecli` publish is a one-time manual `npm publish` to claim the name; after that, configure the trusted publisher and the workflow keeps it in lockstep.

## Python Release

1. Open a PR that bumps `sdk-python/pyproject.toml` to the target version.
2. Merge that PR into `main`.
3. The `Python Release` workflow verifies the version bump, publishes to PyPI, and creates the `sdk-python/vX.Y.Z` tag plus a GitHub release.
4. Verify the release on PyPI.

## Go Release

1. Ensure the `sdk-go/` module contents are ready to tag.
2. Open a PR that updates `sdk-go/VERSION` to the target version, for example `0.1.0`.
3. Merge that PR into `main`.
4. The `Go Release` workflow creates the subdirectory-prefixed `sdk-go/vX.Y.Z` tag plus a GitHub release.
5. Verify the subdirectory-prefixed tag resolves correctly through the Go module proxy.

The repository initializes `sdk-go/VERSION` with `unreleased` so the first automation PR does not publish a Go tag. The first real Go release happens when that file changes to a semantic version.

## Shared Contract Changes

If a release includes schema or shared-fixture changes:

1. Update `json-schema/email-received-event.schema.json`.
2. Regenerate SDK artifacts.
3. Update `test-fixtures/` if the behavioral contract changed.
4. Ensure the PR passes `SDK Checks` again before merging.

If a release includes API spec changes:

1. Update `openapi/primitive-api.yaml`.
2. Regenerate the Node, Python, and Go API clients.
3. Ensure the PR passes `SDK Checks` again before merging.
