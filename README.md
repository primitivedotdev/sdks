# Primitive SDKs

[![SDK Checks](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml/badge.svg?branch=main)](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml)

Monorepo for Primitive SDKs.

The repository currently contains:

- `sdk-node/` for the Node.js SDK
- `sdk-python/` for the Python SDK
- `sdk-go/` for the Go SDK
- `openapi/` for the canonical Primitive API specification
- `json-schema/` for the canonical webhook schema
- `test-fixtures/` for shared cross-SDK compatibility fixtures

## SDKs

| SDK | Install target | README |
| --- | --- | --- |
| Node.js | `npm install @primitivedotdev/sdk` | `sdk-node/README.md` |
| Python | `pip install primitivedotdev` | `sdk-python/README.md` |
| Go | `go get github.com/primitivedotdev/sdks/sdk-go@latest` | `sdk-go/README.md` |

## Purpose

Each SDK exposes a webhook module and an API module:

- `webhook` handles inbound Primitive webhook verification and parsing
- `api` handles outbound calls to the Primitive HTTP API

The Node SDK also ships:

- `@primitivedotdev/sdk/openapi` for the canonical OpenAPI document
- `@primitivedotdev/sdk/contract` for producer-side webhook construction
- `@primitivedotdev/sdk/parser` for raw email parsing helpers
- the `primitive` CLI powered by `oclif`

## Repository Layout

```text
sdks/
  .github/workflows/
  openapi/
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
make node-generate python-generate go-generate
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
