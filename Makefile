.PHONY: node-install node-generate node-check-generated node-test node-check node-build node-smoke node-coverage
.PHONY: python-sync python-generate python-check-generated python-test python-check python-build python-smoke python-coverage
.PHONY: go-generate go-check-generated go-check go-build go-coverage
.PHONY: shared-check check build release-check

PYTHON := $(shell if command -v python3 >/dev/null 2>&1; then printf python3; else printf python; fi)

node-install:
	pnpm --dir sdk-node install --frozen-lockfile

node-generate:
	pnpm --dir sdk-node generate

node-check-generated:
	cd sdk-node && pnpm generate && git diff --exit-code -- src/schema.generated.ts src/types.generated.ts src/generated/email-received-event.validator.generated.ts

node-test:
	pnpm --dir sdk-node test

node-check: node-check-generated
	if command -v biome >/dev/null 2>&1; then cd sdk-node && biome check src/ tests/; else pnpm --dir sdk-node lint; fi
	pnpm --dir sdk-node typecheck
	$(MAKE) node-test

node-build:
	pnpm --dir sdk-node build

node-smoke: node-build
	pack_dir=$$(mktemp -d) && smoke_dir=$$(mktemp -d) && tarball=$$(cd sdk-node && npm pack --pack-destination "$$pack_dir") && cd "$$smoke_dir" && npm init -y && npm install "$$pack_dir/$$tarball" && node --input-type=module -e "const root = await import('@primitivedotdev/sdk-node'); const webhook = await import('@primitivedotdev/sdk-node/webhook'); const contract = await import('@primitivedotdev/sdk-node/contract'); const parser = await import('@primitivedotdev/sdk-node/parser'); if (typeof root.handleWebhook !== 'function') throw new Error('missing root handleWebhook export'); if (typeof webhook.handleWebhook !== 'function') throw new Error('missing webhook handleWebhook export'); if (typeof contract.buildEmailReceivedEvent !== 'function') throw new Error('missing contract buildEmailReceivedEvent export'); if (typeof parser.parseEmail !== 'function') throw new Error('missing parser parseEmail export');"

node-coverage:
	pnpm --dir sdk-node test:coverage

python-sync:
	cd sdk-python && uv sync --dev

python-generate:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py

python-check-generated:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py && git diff --exit-code -- src/primitive_sdk/schemas/email_received_event.schema.json src/primitive_sdk/models_generated.py

python-test:
	cd sdk-python && uv run pytest tests -k "not shared_fixtures"

python-check: python-check-generated
	if command -v ruff >/dev/null 2>&1; then cd sdk-python && ruff check .; else cd sdk-python && uv run ruff check .; fi
	if command -v basedpyright >/dev/null 2>&1; then cd sdk-python && basedpyright; else cd sdk-python && uv run basedpyright; fi
	$(MAKE) python-test

python-build:
	rm -rf sdk-python/dist
	cd sdk-python && uv run python -m build && uv run twine check dist/*

python-smoke: python-build
	smoke_dir=$$(mktemp -d) && wheel_path=$$($(PYTHON) -c "from pathlib import Path; wheels = sorted(Path('sdk-python/dist').glob('*.whl')); assert len(wheels) == 1, wheels; print(wheels[0])") && $(PYTHON) -m venv "$$smoke_dir/venv" && "$$smoke_dir/venv/bin/pip" install "$$wheel_path" && "$$smoke_dir/venv/bin/python" -c "import primitive_sdk; primitive_sdk.handle_webhook"

python-coverage:
	cd sdk-python && uv run pytest tests --cov=primitive_sdk --cov-report=term-missing

go-generate:
	cd sdk-go && $(PYTHON) scripts/generate_schema_module.py

go-check-generated:
	cd sdk-go && $(PYTHON) scripts/generate_schema_module.py && git diff --exit-code -- schema_generated.go

go-check: go-check-generated
	cd sdk-go && test -z "$$(gofmt -l .)"
	cd sdk-go && go vet ./...
	cd sdk-go && go test ./...

go-build:
	cd sdk-go && go build ./...

go-coverage:
	cd sdk-go && raw_coverage_file=$$(mktemp) && filtered_coverage_file=$$(mktemp) && go test ./... -coverprofile="$$raw_coverage_file" && { IFS= read -r header && printf '%s\n' "$$header" > "$$filtered_coverage_file" && while IFS= read -r line; do case "$$line" in *"/schema_generated.go:"*|*"/doc.go:"*) ;; *) printf '%s\n' "$$line" >> "$$filtered_coverage_file" ;; esac; done; } < "$$raw_coverage_file" && go tool cover -func="$$filtered_coverage_file" && rm -f "$$raw_coverage_file" "$$filtered_coverage_file"

shared-check:
	cd sdk-node && pnpm exec vitest run tests/webhook/shared-fixtures.test.ts
	cd sdk-python && uv run pytest tests/test_shared_fixtures.py
	cd sdk-go && go test -run TestSharedCompatibilityFixtures ./...

check: node-check python-check go-check shared-check

build: node-build python-build go-build

release-check: node-check node-build node-smoke python-check python-build python-smoke go-check go-build shared-check
