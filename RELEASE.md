# Release Process

This repository publishes three language SDKs and the official Node-distributed CLI from one shared webhook contract and one shared API contract. The Rust CLI port can also produce GitHub release archives, but that release path is manual while the port remains optional.

- Node SDK: `@primitivedotdev/sdk`
- Node CLI: `primitive` (also mirrored as `primcli` and the legacy scoped `@primitivedotdev/cli`)
- Rust CLI: `cli-rust/`, optional GitHub release archives exposing `primitive` and `prim`
- Python: `primitivedotdev`
- Go: `github.com/primitivedotdev/sdks/sdk-go`

Use this process when cutting a release for one or more packages.

Releases are automated from `main`.

- If a PR merges with a new `sdk-node/package.json` version, GitHub Actions publishes the Node SDK.
- If a PR merges with a new `cli-node/package.json` version, GitHub Actions publishes the Node-distributed CLI.
- Rust CLI archives are created only by manually running the `Rust CLI Release` workflow.
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
5. Confirm the packed artifact exposes `@primitivedotdev/sdk`, `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/api`, `@primitivedotdev/sdk/openapi`, `@primitivedotdev/sdk/contract`, `@primitivedotdev/sdk/parser`, `@primitivedotdev/sdk/parser/address`, `@primitivedotdev/sdk/x402`, and `@primitivedotdev/sdk/payloads`, and that it does NOT install a `primitive` bin (the CLI lives in the separate `primitive` package).

## Node CLI Release

1. Open a PR that bumps `cli-node/package.json` to the target version.
2. Merge that PR into `main`.
3. The `CLI Release` workflow verifies the version bump, publishes to npm through trusted publishing/OIDC, and creates the `cli-node/vX.Y.Z` tag plus a GitHub release.
4. Verify the package contents with `npm view primitive version`.
5. Confirm the packed artifact exposes the `primitive` bin and that `primitive list-operations` succeeds in a fresh install.

The same workflow also publishes the CLI under two mirror names (via `scripts/cli-mirror-publish.sh`): `primcli` and the legacy scoped `@primitivedotdev/cli` (kept so existing scoped installs keep receiving releases). Each mirror is the identical build with only the package `name` changed, locked to the same version, so `npm install -g primitive`, `npm install -g primcli`, and `npm install -g @primitivedotdev/cli` are interchangeable. The mirror publishes are no-ops when that version already exists, so a re-run is safe. After a release, verify with `npm view primcli version` and `npm view @primitivedotdev/cli version`.

The unscoped name `primcli` is used because npm normalizes package names by stripping `-`/`_`/`.` before checking for collisions, so an all-one-word `primitivecli` collides with the unrelated existing `primitive-cli` and is rejected at publish.

Coordinate Node SDK and CLI releases when both ship in the same cycle: cut the SDK first (so its npm version is available), then bump CLI's `@primitivedotdev/sdk` dep range if needed and ship CLI.

Both npm packages use npm trusted publishing from GitHub Actions. Do not add npm API tokens; configure npmjs trusted publishers for `@primitivedotdev/sdk` with `.github/workflows/node-release.yml` and `primitive` with `.github/workflows/cli-release.yml`.

Each mirror (`primcli` and `@primitivedotdev/cli`) needs its own npm trusted publisher (same `.github/workflows/cli-release.yml`). All three names already have trusted publishers configured for this workflow (each published from it before or after the rename), so no npm-side changes are needed; the workflow keeps the mirrors in lockstep. For any future new mirror name: npm trusted publishing requires the package to already exist, so claim the name with a one-time manual `npm publish` first (`primcli` was claimed at `primcli@1.2.0`).

## Rust CLI Release

1. Open a PR that bumps `cli-rust/Cargo.toml` to the target version.
2. Merge that PR into `main`.
3. Manually run the `Rust CLI Release` workflow from `main`. The workflow verifies the version, runs the Rust CLI checks on each release platform, runs authenticated live smoke against the packaged Linux x64 release artifact, creates the `cli-rust-vX.Y.Z` tag plus a GitHub release, and uploads Linux x64, Linux arm64, macOS x64, macOS arm64, and Windows x64 archives plus their `.sha256` checksums. Linux archives are built from musl Rust targets while keeping the public `linux-x64` and `linux-arm64` archive names. Each archive keeps the top-level `primitive`/`prim` binaries and includes `LICENSE` plus a concise `README.md` install note.
4. Install the archive for your platform with `scripts/install-rust-cli.sh --version X.Y.Z` on macOS/Linux or `scripts/install-rust-cli.ps1 -Version X.Y.Z` on Windows. If the installer reports that the install directory is not on `PATH`, add it or invoke the full printed path, then confirm `primitive --version`, `prim --version`, and `primitive list-operations` succeed.

The release workflow requires a `PRIMITIVE_API_KEY` repository secret for the live smoke gate. Keep that gate read-only; run mutating or email E2E smoke manually with a disposable account when needed.

Every CLI-facing release PR should keep the Rust port green:

```bash
make rust-cli-check
make rust-cli-package
make rust-cli-smoke
make rust-cli-release-smoke
make rust-cli-linux-portability-smoke
make rust-cli-archive-smoke
make rust-cli-windows-archive-smoke
make rust-cli-install-smoke
make rust-cli-dist
make cli-parity
make cli-archive-parity
```

`rust-cli-linux-portability-smoke` checks Linux release binaries for unexpected OpenSSL/libz linkage and can enforce a static musl binary for release-platform builds. `rust-cli-archive-smoke` validates the release binary after packaging it as extracted `primitive` and `prim` commands, with `README.md` and `LICENSE` present. `rust-cli-windows-archive-smoke` validates the Windows `.zip` archive, checksum shape, and bundled `README.md`/`LICENSE` files. `rust-cli-install-smoke` validates the macOS/Linux installer against that archive and checksum shape. `cli-archive-parity` runs the full Node/Rust help sweep and request/response parity suite against the extracted release archive binary. `rust-cli-dist` writes the same archive shape to `cli-rust/dist/` for release uploads.

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
2. Regenerate the Node, Python, and Go API clients plus `cli-rust/src/operation-manifest.json`.
3. Ensure the PR passes `SDK Checks` again before merging.
