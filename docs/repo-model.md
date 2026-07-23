# Repository Model

This repository is a polyglot monorepo that contains independent SDK packages for Node, Python, and Go plus CLI packages for the public Node-distributed CLI and the Rust CLI port.

The repository shares a canonical webhook schema, a canonical OpenAPI spec, and a shared compatibility test suite, while each SDK keeps its native packaging, build, and release conventions.

## Package Boundaries

- `sdk-node/` is an npm package managed with `pnpm`
- `cli-node/` is the supported public CLI package managed with `pnpm`
- `cli-rust/` is the Rust CLI port managed with Cargo and released as GitHub archives
- `sdk-python/` is a Python package managed with `uv` and `pyproject.toml`
- `sdk-go/` is a Go module managed with `go.mod`

No root-level language workspace owns all packages.

## Root Responsibilities

The repository root provides coordination, not packaging.

- `Makefile` is the shared task interface for checks, generation, and builds
- `.github/workflows/sdk-checks.yml` runs the same high-level tasks in CI
- `json-schema/`, `openapi/`, and `test-fixtures/` define the shared contracts across SDKs
- CLI parity fixtures in `test-fixtures/cli-parity/` define black-box behavior parity between the Node and Rust CLIs

## Tooling Model

Use the root for orchestration:

```bash
make check
make shared-check
make build
```

Use SDK directories for language-native work:

- Node: `pnpm --dir sdk-node ...`
- Node CLI: `pnpm --dir cli-node ...`
- Rust CLI: `cargo test --manifest-path cli-rust/Cargo.toml --locked`
- Python: `cd sdk-python && uv ...`
- Go: `cd sdk-go && go ...`

For CLI parity:

```bash
make rust-cli-full-check
```

## Why This Model

This keeps the repo easy to operate without forcing one language ecosystem to become the control plane for the others.

- Node tooling does not own Python or Go workflows
- Python tooling does not need to wrap Node or Go commands
- Go tooling remains standard Go module tooling
- Rust CLI tooling remains standard Cargo tooling
- shared checks still run consistently from the root

## Notes

- the root `pnpm-workspace.yaml` defines a pnpm workspace covering only the Node packages (`cli-node`, `sdk-node`, `packages/*`); it does not govern the Python or Go SDKs
- changes to the webhook contract should usually touch `json-schema/`, generated artifacts, and `test-fixtures/` together
- changes to the HTTP API contract should usually touch `openapi/` and the generated API clients in all three SDKs together
- changes to CLI commands should keep the Node registry, Rust command manifest, help surfaces, and black-box CLI parity fixtures aligned
- SDK-specific helpers can remain local to a package as long as shared webhook behavior stays consistent across languages
