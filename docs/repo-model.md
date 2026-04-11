# Repository Model

This repository is a polyglot monorepo that contains independent SDK packages for Node, Python, and Go.

The repository shares a canonical webhook schema and a shared compatibility test suite, but each SDK keeps its native packaging, build, and release conventions.

## Package Boundaries

- `sdk-node/` is an npm package managed with `pnpm`
- `sdk-python/` is a Python package managed with `uv` and `pyproject.toml`
- `sdk-go/` is a Go module managed with `go.mod`

No root-level language workspace owns all three SDKs.

## Root Responsibilities

The repository root provides coordination, not packaging.

- `Makefile` is the shared task interface for checks, generation, and builds
- `.github/workflows/sdk-checks.yml` runs the same high-level tasks in CI
- `json-schema/` and `test-fixtures/` define the shared contract across SDKs

## Tooling Model

Use the root for orchestration:

```bash
make check
make shared-check
make build
```

Use SDK directories for language-native work:

- Node: `pnpm --dir sdk-node ...`
- Python: `cd sdk-python && uv ...`
- Go: `cd sdk-go && go ...`

## Why This Model

This keeps the repo easy to operate without forcing one language ecosystem to become the control plane for the others.

- Node tooling does not own Python or Go workflows
- Python tooling does not need to wrap Node or Go commands
- Go tooling remains standard Go module tooling
- shared checks still run consistently from the root

## Notes

- `sdk-node/pnpm-workspace.yaml` is package-local Node configuration, not a repo-wide workspace definition
- changes to the webhook contract should usually touch `json-schema/`, generated artifacts, and `test-fixtures/` together
- SDK-specific helpers can remain local to a package as long as shared webhook behavior stays consistent across languages
