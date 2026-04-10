# Architecture

`primitive-sdks` is a multi-language repository for Primitive webhook SDKs.

The repository is organized around one shared webhook contract and three language packages that implement the same core workflow.

## Core Flow

Each SDK is responsible for the same high-level behavior:

1. verify the `Primitive-Signature` header
2. parse the raw request body
3. validate the payload against the canonical schema
4. expose a typed `email.received` event model
5. preserve forward compatibility for unknown future event types

## Shared Contract

The shared contract lives in two places:

- `json-schema/email-received-event.schema.json`
- `test-fixtures/`

The schema defines the payload shape.

The shared fixtures define behavioral parity expectations across SDKs, including:

- schema validation outcomes
- signature verification behavior
- auth classification behavior
- raw-content helper behavior
- `parseWebhookEvent` parity
- `handleWebhook` parity

## SDK Layers

### Node

- package path: `sdk-node/`
- published modules: root webhook entrypoint plus `webhook`, `contract`, and `parser` subpaths
- runtime validation: generated AJV standalone validator
- generated artifacts: schema module, TypeScript types, validator module
- Node-only modules: `contract` and `parser`

### Python

- package path: `sdk-python/`
- runtime validation: schema-driven validation plus generated Pydantic models
- generated artifacts: packaged schema copy, generated models

### Go

- package path: `sdk-go/`
- runtime validation: embedded schema plus Go validation helpers
- generated artifacts: embedded schema source

## Forward Compatibility

Known event types such as `email.received` are validated strictly.

Unknown future event types are intentionally preserved instead of rejected so SDK consumers can continue receiving new webhook events before a package update ships.

That behavior is part of the shared compatibility suite and should stay aligned across languages.

## Tooling Model

The repository separates orchestration from environment setup.

- `Makefile` provides root-level workflows such as `make check`, `make shared-check`, and `make build`
- each SDK keeps its native package tooling inside its own directory

## CI Model

`.github/workflows/sdk-checks.yml` runs four categories of checks:

- Node SDK checks
- Python SDK checks
- Go SDK checks
- shared fixture compatibility checks across all three SDKs

CI uses the same root `make` targets that contributors use locally. That keeps the documented workflow and the enforced workflow aligned.

## Change Strategy

When changing shared webhook behavior:

1. update the canonical schema if the payload contract changes
2. regenerate language-specific artifacts
3. update shared fixtures when expected behavior changes
4. run `make check`
5. review each SDK for language-specific helper implications

When changing only one SDK's internal implementation, keep the shared fixture contract intact unless the intended public behavior is changing across all SDKs.
