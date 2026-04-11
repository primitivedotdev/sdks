# Schema Generation

The canonical source of truth for webhook payload structure lives in `json-schema/email-received-event.schema.json`.

Every SDK in this repository consumes that schema and generates or embeds language-specific artifacts from it. SDK code may add language-native helpers around the schema, but schema shape changes must begin in `json-schema/`.

## Source Of Truth

- Canonical schema: `json-schema/email-received-event.schema.json`
- Shared compatibility fixtures: `test-fixtures/`

When the schema changes, update generated artifacts in each SDK before merging.

## Generated Artifacts

### Node

Commands:

```bash
make node-generate
```

Generated files:

- `sdk-node/src/schema.generated.ts`
- `sdk-node/src/types.generated.ts`
- `sdk-node/src/generated/email-received-event.validator.generated.ts`

How it works:

- `sdk-node/scripts/generate-schema-module.ts` copies the canonical JSON schema into a typed module export
- `sdk-node/scripts/generate-types.ts` derives TypeScript types from the schema
- `sdk-node/scripts/generate-validator.ts` produces an AJV standalone validator module

### Python

Commands:

```bash
make python-generate
```

Generated files:

- `sdk-python/src/primitive_sdk/schemas/email_received_event.schema.json`
- `sdk-python/src/primitive_sdk/models_generated.py`

How it works:

- `sdk-python/scripts/generate_schema_module.py` copies the canonical schema into the package
- `sdk-python/scripts/generate_models.py` derives Pydantic models from the schema

### Go

Commands:

```bash
make go-generate
```

Generated files:

- `sdk-go/schema_generated.go`

How it works:

- `sdk-go/scripts/generate_schema_module.py` embeds the canonical JSON schema in Go source

## CI Enforcement

CI verifies generated artifacts remain in sync with the canonical schema.

- `make node-check` regenerates Node artifacts and fails if `git diff` detects drift
- `make python-check` regenerates Python artifacts and fails if `git diff` detects drift
- `make go-check` regenerates the embedded Go schema and fails if `git diff` detects drift

These checks run in `.github/workflows/sdk-checks.yml`.

## Safe Change Process

1. Update `json-schema/email-received-event.schema.json`
2. Regenerate artifacts for affected SDKs with the root `Makefile`
3. Update shared fixtures in `test-fixtures/` when the behavioral contract changes
4. Run `make check`
5. Review generated diffs to confirm the schema change propagated as expected

## Rules

- Do not hand-edit committed generated artifacts
- Do not introduce schema shape changes only in one SDK
- Prefer shared fixtures over SDK-specific fixtures when the behavior should match across languages
- Keep forward-compatibility behavior explicit when adding new event fields or validation rules
