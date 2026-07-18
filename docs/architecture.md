# Architecture

`sdks` is a multi-language repository for Primitive webhook and API SDKs.

The repository is organized around two shared sources of truth:

- the webhook contract in `json-schema/`
- the HTTP API contract in `openapi/`

## Core Flow

Each SDK is responsible for the same high-level behavior:

1. verify the `Primitive-Signature` header
2. parse the raw request body
3. validate the payload against the canonical schema
4. expose a typed `email.received` event model
5. preserve forward compatibility for unknown future event types

## Shared Contracts

### Webhooks

The webhook contract lives in two places:

- `json-schema/email-received-event.schema.json`
- `test-fixtures/`

The schema defines the payload shape.

The shared fixtures define behavioral parity expectations across SDKs, including:

- schema validation outcomes
- signature verification behavior
- auth classification behavior
- sender trust decisions (domain-anchored trust check)
- raw-content helper behavior
- `parseWebhookEvent` parity
- `handleWebhook` parity

### API

The HTTP API contract lives at `openapi/primitive-api.yaml`.

That source is transformed into a generated codegen artifact so all three SDKs generate from the same normalized API description, while Node also publishes the raw OpenAPI document for other JavaScript consumers. The same operation metadata also feeds the Rust CLI command manifest.

## SDK Layers

### Node

- package path: `sdk-node/`
- published modules: root webhook entrypoint plus `webhook`, `api`, `openapi`, `contract`, `parser`, `parser/address`, `x402`, and `payloads` subpaths
- runtime validation: generated AJV standalone validator
- generated artifacts: webhook schema module, TypeScript types, validator module, generated API client, generated OpenAPI document export
- Node-only modules: `contract`, `parser`, `x402`, and `payloads`

### Node CLI

- package path: `cli-node/`
- published command: `primitive` with `prim` as a short alias
- runtime: `oclif` with official autocomplete for bash/zsh/powershell plus custom fish completion output
- API client: consumes the Node SDK and generated API client

### Rust CLI

- package path: `cli-rust/`
- local commands: `primitive-rust`, `primitive`, and `prim`
- release artifact: GitHub archive containing the user-facing `primitive` and `prim` commands
- validation: command-surface and black-box parity checks against the Node CLI
- generated artifacts: `cli-rust/src/operation-manifest.json` from the OpenAPI operation metadata

### Python

- package path: `sdk-python/`
- runtime validation: schema-driven validation plus generated Pydantic models
- generated artifacts: packaged webhook schema copy, generated webhook models, generated API client package under `primitive.api`

### Go

- package path: `sdk-go/`
- runtime validation: embedded schema plus Go validation helpers
- generated artifacts: embedded webhook schema source and generated API client package under `sdk-go/api`

## Forward Compatibility

Known event types such as `email.received` are validated strictly.

Unknown future event types are intentionally preserved instead of rejected so SDK consumers can continue receiving new webhook events before a package update ships.

That behavior is part of the shared compatibility suite and should stay aligned across languages.

## Tooling Model

The repository separates orchestration from environment setup.

- `Makefile` provides root-level workflows such as `make check`, `make shared-check`, and `make build`
- each SDK keeps its native package tooling inside its own directory

## CI Model

`.github/workflows/sdk-checks.yml` runs SDK checks plus an optional Rust CLI validation lane:

- Node SDK checks
- Node CLI checks
- Python SDK checks
- Go SDK checks
- shared fixture compatibility checks across all three SDKs
- Rust CLI checks and Node/Rust CLI parity when Rust CLI files or CLI/API parity inputs change

CI uses the same root `make` targets that contributors use locally. Default root targets cover the supported SDK and Node CLI packages; the Rust CLI port is checked explicitly with `make rust-cli-full-check`.

## Change Strategy

When changing shared webhook behavior:

1. update the canonical schema if the payload contract changes
2. regenerate language-specific artifacts
3. update shared fixtures when expected behavior changes
4. run `make check`
5. review each SDK for language-specific helper implications

When changing only one SDK's internal implementation, keep the shared fixture contract intact unless the intended public behavior is changing across all SDKs.

When changing the HTTP API contract:

1. update `openapi/primitive-api.yaml`
2. regenerate the Node, Python, and Go API clients plus the Rust CLI operation manifest
3. run `make node-check python-check go-check`
4. if the optional Rust CLI port is touched, run `make rust-cli-full-check`
5. verify the Node smoke test still exposes `api` and `openapi` (and still confirms the SDK tarball installs no `primitive` bin; the CLI bin is exercised by the separate CLI smoke test)
