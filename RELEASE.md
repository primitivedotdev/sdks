# Release Process

This repository publishes three language SDKs from one shared webhook contract.

- Node: `@primitivedotdev/sdk-node`
- Python: `primitive-sdk`
- Go: `github.com/primitivedotdev/sdks/sdk-go`

Use this process when cutting a release for one or more SDKs.

## Before Releasing

1. Confirm the working tree is clean.
2. Update the relevant package version metadata.
3. If the webhook contract changed, regenerate artifacts for each affected SDK.
4. Run `make release-check` from the repository root.
5. Review the SDK README and changelog notes for any public API changes.

## Node Release

1. Update `sdk-node/package.json` version.
2. Run `make node-check node-build node-smoke`.
3. Publish from `sdk-node/` with your normal npm release credentials.
4. Verify the package contents with `npm view @primitivedotdev/sdk-node version`.
5. Confirm the packed artifact exposes `@primitivedotdev/sdk-node`, `@primitivedotdev/sdk-node/webhook`, `@primitivedotdev/sdk-node/contract`, and `@primitivedotdev/sdk-node/parser`.

## Python Release

1. Update `sdk-python/pyproject.toml` version.
2. Run `make python-check python-build python-smoke`.
3. Publish the built distribution from `sdk-python/dist/` using your normal PyPI workflow.
4. Verify the release on PyPI.

## Go Release

1. Ensure the `sdk-go/` module contents are ready to tag.
2. Run `make go-check go-build`.
3. Create and push a git tag for the release.
4. Verify the tag resolves correctly through the Go module proxy.

## Shared Contract Changes

If a release includes schema or shared-fixture changes:

1. Update `json-schema/email-received-event.schema.json`.
2. Regenerate SDK artifacts.
3. Update `test-fixtures/` if the behavioral contract changed.
4. Run `make check` again before publishing.
