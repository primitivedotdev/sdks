# AGENTS.md

Instructions for AI coding agents working in this repository. This is the [agentskills.io / agents-md](https://agentskills.io) convention for tool-agnostic agent guidance; per-tool files like `CLAUDE.md` may add tool-specific rules on top.

## What this repo is

The Primitive SDKs monorepo. Four published artifacts, all generated from the same OpenAPI spec at `openapi/primitive-api.yaml`:

| Path | Package | Install |
|---|---|---|
| `sdk-node/` | `@primitivedotdev/sdk` | `npm install @primitivedotdev/sdk` |
| `sdk-python/` | `primitivedotdev` (PyPI) | `pip install primitivedotdev` |
| `sdk-go/` | `github.com/primitivedotdev/sdks/sdk-go` | `go get github.com/primitivedotdev/sdks/sdk-go@latest` |
| `cli-node/` | `primitive` | `npm install -g primitive` |

Plus one workspace-internal package at `packages/api-core/` that ships the generated TypeScript API client and is bundled inline into the Node SDK + CLI.

The CLI consumes the Node SDK and exposes `primitive <verb>` commands. The SDKs are the canonical programmatic interface to `https://api.primitive.dev/v1`.

## Source of truth

`openapi/primitive-api.yaml` is the single source for the API surface. Everything else regenerates from it:

- `openapi/primitive-api.codegen.json` (normalized JSON form for codegen tools)
- `packages/api-core/src/api/` (Node fetch client + types via `@hey-api/openapi-ts`)
- `packages/api-core/src/openapi/openapi.generated.ts` (the OpenAPI document embedded as a TS constant)
- `sdk-python/src/primitive/api/` (via `openapi-python-client`)
- `sdk-go/api/` (via in-repo Python scripts)

Touching `primitive-api.yaml` means regenerating each downstream artifact in this list.

The other source-of-truth file is `json-schema/email-received-event.schema.json`, the inbound webhook event payload schema. It is independent of the OpenAPI spec; touching it regenerates a separate set of artifacts:

- `sdk-node/src/schema.generated.ts` + `src/types.generated.ts` + `src/generated/email-received-event.validator.generated.ts`
- `sdk-python/src/primitive/models_generated.py` + `src/primitive/schemas/email_received_event.schema.json`
- `sdk-go/schema_generated.go`

The two sources do not overlap: an edit to `primitive-api.yaml` will not refresh `models_generated.py`, and an edit to the JSON schema will not refresh `api/`. Both regen targets are wired into `make node-generate python-generate go-generate`.

## Build, test, lint

The Makefile orchestrates per-language targets. The common ones an agent will reach for:

```bash
# Regenerate everything from the spec (run after editing primitive-api.yaml)
make node-generate python-generate go-generate

# Run the per-language full check (includes generated-file-sync gate)
make node-check          # @primitivedotdev/sdk + packages/api-core
make cli-check           # primitive
make python-check        # primitivedotdev (PyPI)
make go-check            # sdk-go

# Cross-SDK behavior parity tests
make shared-check

# Build artifacts
make node-build cli-build python-build go-build

# Convenience aggregator
make check               # runs all of the above except the smokes
```

Before pushing any branch, the minimum is `make node-check cli-check go-check shared-check`. If you touched the JSON schema OR the OpenAPI spec, also run `make python-check`.

## Generated files are committed

This is intentional. Every regen target writes back into `git` and CI uses `git diff --exit-code` to assert the committed artifacts match a fresh regen. If you forget to commit a regenerated file, CI fails with a clear diff.

Do not edit any file marked `generated` in its header. Edit the source (the YAML spec or the JSON schema), run the regen target, commit both.

## Cross-SDK consistency

All three language SDKs must behave identically for the same input. Shared fixtures in `test-fixtures/` are the contract; the `make shared-check` target runs the same fixtures against all three SDKs. If you change behavior in one, update all three.

## Style and quality bar

- Zero warnings. Lints run with `--error-on-warnings` (Biome for TS, ruff + basedpyright for Python, gofmt + go vet for Go). A single warning fails the build.
- Do not silence warnings with `// biome-ignore`, `@ts-ignore`, `@ts-expect-error`, or equivalents. Fix the underlying issue. If a true escape hatch is needed, document the WHY inline and link to the upstream bug.
- No `any` in TypeScript without a documented reason.
- New endpoints need typed schemas in the OpenAPI spec, including response schemas; the regen relies on them.

## Branching and PRs

- Never push to `main`. Always branch + open a PR.
- Branch names: plain descriptive (`add-foo-verb`), not Conventional-Commit-prefixed.
- Commit messages: plain descriptive ("Add foo verb"), not `feat: add foo verb`.
- After opening a PR, expect Greptile to auto-review within ~1-3 minutes. Address every finding (inline threads AND summary table) before merging.
- The CI surface lives in `.github/workflows/sdk-checks.yml`. The `ci` aggregator job gates on every language job.

## Public-repo writing

This repo is **public**. Anything that lands in `git log`, PR descriptions, issue bodies, or code comments is visible to users, competitors, and anyone evaluating the product.

- Do not reference internal Primitive repos by URL, PR number, branch name, or as a noun.
- Do not leak infrastructure details (cluster ARNs, internal hostnames, vendor specifics).
- Commit messages and PR titles describe WHAT changed and WHY, not HOW our infra is wired.
- Flag anything that reads as a business decision (pricing, roadmap timing, SLA commitments) before merging -- those need a human call.

## Adding a new API verb

1. Add the operation to `openapi/primitive-api.yaml` with operationId, summary, full request/response schemas.
2. `make node-generate python-generate go-generate` to regenerate clients in all three languages.
3. If the verb deserves a CLI shortcut, add a command under `cli-node/src/oclif/commands/` and a test under `cli-node/tests/oclif/`.
4. Add or update test fixtures in `test-fixtures/` if cross-SDK behavior parity matters for this verb.
5. `make check` to confirm everything passes locally.
6. Commit the SOURCE changes (yaml, command, fixtures) AND the regenerated files in the same commit.

## Where to find more

- `CLAUDE.md` -- project-specific rules layered on top of this file. Same content philosophy, Claude-Code-tuned vocabulary.
- `RELEASE.md` -- how SDK releases are cut.
- `docs/` -- design notes and architecture decisions.
- Each language directory has its own README with install + quickstart for that surface.

## Primitive itself

If you need to understand the product behind the SDKs (what the email layer for AI agents is, how the API is shaped, where to sign up), the canonical agent-readable surfaces:

- https://www.primitive.dev/llms.txt -- orientation index
- https://www.primitive.dev/llms-full.txt -- full docs bundle
- https://www.primitive.dev/openapi.yaml -- the OpenAPI 3.1 spec (same one this repo's `openapi/primitive-api.yaml` ships)
- https://www.primitive.dev/auth.md -- agent auth walkthrough
- https://www.primitive.dev/mcp -- hosted Model Context Protocol endpoint
- https://www.primitive.dev/docs -- human-readable docs
