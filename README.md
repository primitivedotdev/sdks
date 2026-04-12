# Primitive SDKs

[![SDK Checks](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml/badge.svg?branch=main)](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml)

Monorepo for Primitive SDKs.

The repository currently contains:

- `sdk-node/` for the Node.js SDK
- `sdk-python/` for the Python SDK
- `sdk-go/` for the Go SDK
- `json-schema/` for the canonical webhook schema
- `test-fixtures/` for shared cross-SDK compatibility fixtures

## SDKs

| SDK | Install target | README |
| --- | --- | --- |
| Node.js | `npm install @primitivedotdev/sdk` | `sdk-node/README.md` |
| Python | `pip install primitive-sdk` | `sdk-python/README.md` |
| Go | `go get github.com/primitivedotdev/sdks/sdk-go` | `sdk-go/README.md` |

## Purpose

Each SDK implements the same core webhook workflow:

- verify Primitive webhook signatures
- parse request bodies
- validate payloads against the canonical JSON schema
- expose typed `email.received` events in the target language

The Node SDK also ships Node-only `contract` and `parser` modules under `@primitivedotdev/sdk/contract` and `@primitivedotdev/sdk/parser`.

## Repository Layout

```text
sdks/
  .github/workflows/
  json-schema/
  sdk-go/
  sdk-node/
  sdk-python/
  test-fixtures/
```

## Development

Use the root `Makefile` as the main task interface:

```bash
make check
make shared-check
make build
make release-check
```

The `Makefile` wraps each SDK's native commands. You can still run them directly from each SDK directory when needed:

```bash
cd sdk-node && pnpm typecheck && pnpm test
cd sdk-python && uv sync --dev && uv run pytest && uv run ruff check . && uv run basedpyright
cd sdk-go && go test ./... && go test -run TestSharedCompatibilityFixtures ./...
```

## CI

`.github/workflows/sdk-checks.yml` runs:

- Node SDK checks
- Python SDK checks
- Go SDK checks
- shared fixture compatibility checks across all three SDKs

## Documentation

- `docs/architecture.md` gives the high-level repository architecture and workflow model
- `docs/schema-generation.md` documents the canonical schema and generated artifacts in each SDK
- `docs/repo-model.md` documents the monorepo task model and package boundaries
- `RELEASE.md` documents the current manual release process for each SDK
