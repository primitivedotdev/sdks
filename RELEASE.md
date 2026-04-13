# Release Process

This repository publishes three language SDKs from one shared webhook contract.

- Node: `@primitivedotdev/sdk`
- Python: `primitivedotdev`
- Go: `github.com/primitivedotdev/sdks/sdk-go`

Use this process when cutting a release for one or more SDKs.

Releases are now automated from `main`.

- If a PR merges with a new `sdk-node/package.json` version, GitHub Actions publishes the Node SDK.
- If a PR merges with a new `sdk-python/pyproject.toml` version, GitHub Actions publishes the Python SDK.
- If a PR merges with a new `sdk-go/VERSION` value, GitHub Actions creates the Go module tag and GitHub release.

## Before Releasing

1. Confirm the working tree is clean.
2. Update the relevant SDK version metadata in a release PR.
3. If the webhook contract changed, regenerate artifacts for each affected SDK.
4. Run `make release-check` from the repository root.
5. Review the SDK README and changelog notes for any public API changes.
6. Merge the release PR into `main`.

## Node Release

1. Open a PR that bumps `sdk-node/package.json` to the target version.
2. Merge that PR into `main`.
3. The `Node Release` workflow verifies the version bump, runs `make node-check node-build node-smoke`, publishes to npm, and creates the `sdk-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view @primitivedotdev/sdk version`.
5. Confirm the packed artifact exposes `@primitivedotdev/sdk`, `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/contract`, and `@primitivedotdev/sdk/parser`.

## Python Release

1. Open a PR that bumps `sdk-python/pyproject.toml` to the target version.
2. Merge that PR into `main`.
3. The `Python Release` workflow verifies the version bump, runs `make python-check python-build python-smoke`, publishes to PyPI, and creates the `sdk-python/vX.Y.Z` tag plus a GitHub release.
4. Verify the release on PyPI.

## Go Release

1. Ensure the `sdk-go/` module contents are ready to tag.
2. Open a PR that updates `sdk-go/VERSION` to the target version, for example `0.1.0`.
3. Merge that PR into `main`.
4. The `Go Release` workflow runs `make go-check go-build`, then creates the subdirectory-prefixed `sdk-go/vX.Y.Z` tag plus a GitHub release.
5. Verify the subdirectory-prefixed tag resolves correctly through the Go module proxy.

The repository initializes `sdk-go/VERSION` with `unreleased` so the first automation PR does not publish a Go tag. The first real Go release happens when that file changes to a semantic version.

## Shared Contract Changes

If a release includes schema or shared-fixture changes:

1. Update `json-schema/email-received-event.schema.json`.
2. Regenerate SDK artifacts.
3. Update `test-fixtures/` if the behavioral contract changed.
4. Run `make release-check` again before publishing.
