# SDK Development Rules

## Never push directly to main

Always create a feature branch and open a PR. No exceptions.

## Run full CI checks locally before every push

Schema changes affect all 3 SDKs. After any change, run the full pipeline before pushing:

```bash
# Regenerate all SDKs from JSON schema
make node-generate python-generate go-generate

# Run all checks (lint, typecheck, tests, generated-file-sync)
make node-check
make python-check
make go-check

# Run shared fixture compatibility tests
make shared-check

# Build all packages
make node-build
make go-build
make python-build
```

At minimum, run `make node-check go-check shared-check` before every push. If you changed the JSON schema, you MUST also run `make python-check`.

## Schema is the source of truth

`json-schema/email-received-event.schema.json` is the canonical schema. All SDK types, validators, and models are generated from it:

- Node: `pnpm --dir sdk-node generate` (produces types, validator, schema module)
- Python: `cd sdk-python && uv run python scripts/generate_models.py` (produces Pydantic models + schema copy)
- Go: `cd sdk-go && python3 scripts/generate_schema_module.py` (produces embedded schema)

If you edit the JSON schema, regenerate ALL SDKs and commit the generated files.

## Cross-SDK consistency

All 3 SDKs must behave identically for the same input. Shared test fixtures in `test-fixtures/` enforce this. If you change behavior in one SDK, update all three.

## Warnings are errors

There are no warnings in this codebase — every diagnostic fails the build. Any warning is a bug to fix, not a signal to tolerate.

- Biome lint runs with `--error-on-warnings` in `pnpm lint` and in `make node-check`. A single biome warning (unused import, unused variable, etc.) exits non-zero.
- TypeScript typechecking uses `tsconfig.typecheck.json`, which covers both `src/**/*` and `tests/**/*`. Test fixtures must satisfy the same type contracts as production code.
- Do NOT silence warnings with `// biome-ignore`, `@ts-ignore`, `@ts-expect-error`, or similar escape hatches. Fix the underlying issue. If an escape hatch is genuinely necessary (external type bug, etc.), document WHY in the same line and link to the upstream issue.
