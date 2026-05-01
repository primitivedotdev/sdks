.PHONY: node-install node-generate node-check-generated node-test node-check node-build node-smoke node-coverage
.PHONY: python-sync python-generate python-check-generated python-test python-check python-build python-smoke python-coverage
.PHONY: go-generate go-check-generated go-check go-build go-coverage
.PHONY: shared-check check build release-check ci

PYTHON := $(shell if command -v python3 >/dev/null 2>&1; then printf python3; else printf python; fi)

node-install:
	pnpm --dir sdk-node install --frozen-lockfile

node-generate:
	pnpm --dir sdk-node generate

node-check-generated:
	cd sdk-node && pnpm generate && git diff --exit-code -- ../openapi/primitive-api.codegen.json src/schema.generated.ts src/types.generated.ts src/generated/email-received-event.validator.generated.ts src/api/generated src/openapi/openapi.generated.ts src/openapi/operations.generated.ts

node-test:
	pnpm --dir sdk-node test

node-check: node-check-generated
	if command -v biome >/dev/null 2>&1; then cd sdk-node && biome check --error-on-warnings src/index.ts src/validation.ts src/types.ts src/webhook src/contract src/parser src/api/index.ts src/openapi/index.ts src/oclif tests/; else pnpm --dir sdk-node lint; fi
	pnpm --dir sdk-node typecheck
	$(MAKE) node-test

node-build:
	pnpm --dir sdk-node build

node-smoke: node-build
	pack_dir=$$(mktemp -d) && smoke_dir=$$(mktemp -d) && tarball=$$(cd sdk-node && npm pack --silent --pack-destination "$$pack_dir" | node -e "let data=''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => { const matches = data.match(/[A-Za-z0-9._-]+\.tgz/g); if (!matches || matches.length === 0) { throw new Error('could not locate tarball name in npm pack output'); } process.stdout.write(matches[matches.length - 1]); });") && cd "$$smoke_dir" && npm init -y && npm install "$$pack_dir/$$tarball" && node --input-type=module -e "const root = await import('@primitivedotdev/sdk'); const webhook = await import('@primitivedotdev/sdk/webhook'); const api = await import('@primitivedotdev/sdk/api'); const openapi = await import('@primitivedotdev/sdk/openapi'); const contract = await import('@primitivedotdev/sdk/contract'); const parser = await import('@primitivedotdev/sdk/parser'); if (typeof root.handleWebhook !== 'function') throw new Error('missing root handleWebhook export'); if (typeof webhook.handleWebhook !== 'function') throw new Error('missing webhook handleWebhook export'); if (typeof api.createPrimitiveApiClient !== 'function') throw new Error('missing api client factory'); if (typeof openapi.openapiDocument !== 'object') throw new Error('missing openapi document export'); if (typeof contract.buildEmailReceivedEvent !== 'function') throw new Error('missing contract buildEmailReceivedEvent export'); if (typeof parser.parseEmail !== 'function') throw new Error('missing parser parseEmail export');" && "$$smoke_dir/node_modules/.bin/primitive" list-operations >/dev/null && "$$smoke_dir/node_modules/.bin/primitive" completion fish >/dev/null && "$$smoke_dir/node_modules/.bin/primitive" completion bash >/dev/null

node-coverage:
	pnpm --dir sdk-node test:coverage

python-sync:
	cd sdk-python && uv sync --dev

python-generate:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py && uv run python scripts/generate_api_client.py

python-check-generated:
	cd sdk-python && uv run python scripts/generate_schema_module.py && uv run python scripts/generate_models.py && uv run python scripts/generate_api_client.py && git diff --exit-code -- src/primitive/schemas/email_received_event.schema.json src/primitive/models_generated.py src/primitive/api

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
	smoke_dir=$$(mktemp -d) && wheel_path=$$($(PYTHON) -c "from pathlib import Path; wheels = sorted(Path('sdk-python/dist').glob('*.whl')); assert len(wheels) == 1, wheels; print(wheels[0])") && $(PYTHON) -m venv "$$smoke_dir/venv" && "$$smoke_dir/venv/bin/pip" install "$$wheel_path" && "$$smoke_dir/venv/bin/python" -c "import primitive; import primitive.api; primitive.handle_webhook"

python-coverage:
	cd sdk-python && uv run pytest tests --cov=primitive --cov-report=term-missing

go-generate:
	cd sdk-go && $(PYTHON) scripts/generate_schema_module.py && $(PYTHON) scripts/generate_api_client.py && go mod tidy

go-check-generated:
	cd sdk-go && $(PYTHON) scripts/generate_schema_module.py && $(PYTHON) scripts/generate_api_client.py && go mod tidy && git diff --exit-code -- go.mod go.sum schema_generated.go api

go-check: go-check-generated
	cd sdk-go && test -z "$$(gofmt -l .)"
	cd sdk-go && go vet ./...
	cd sdk-go && go test ./...

go-build:
	cd sdk-go && go build ./...

go-coverage:
	cd sdk-go && raw_coverage_file=$$(mktemp) && filtered_coverage_file=$$(mktemp) && go test ./... -coverprofile="$$raw_coverage_file" && { IFS= read -r header && printf '%s\n' "$$header" > "$$filtered_coverage_file" && while IFS= read -r line; do case "$$line" in *"/schema_generated.go:"*|*"/doc.go:"*) ;; *) printf '%s\n' "$$line" >> "$$filtered_coverage_file" ;; esac; done; } < "$$raw_coverage_file" && go tool cover -func="$$filtered_coverage_file" && rm -f "$$raw_coverage_file" "$$filtered_coverage_file"

shared-check:
	cd sdk-node && pnpm exec vitest run tests/webhook/shared-fixtures.test.ts tests/api/send-payloads.test.ts
	cd sdk-python && uv run pytest tests/test_shared_fixtures.py tests/test_send_payloads.py
	cd sdk-go && go test -run 'TestSharedCompatibilityFixtures|TestSharedSendPayloadFixtures' ./...

check: node-check python-check go-check shared-check

build: node-build python-build go-build

release-check: node-check node-build node-smoke python-check python-build python-smoke go-check go-build shared-check

ci:
	$(MAKE) node-install
	$(MAKE) python-sync
	$(MAKE) node-check
	$(MAKE) node-build
	$(MAKE) node-smoke
	$(MAKE) node-coverage
	$(MAKE) python-check
	$(MAKE) python-build
	$(MAKE) python-smoke
	$(MAKE) python-coverage
	$(MAKE) go-check
	$(MAKE) go-build
	$(MAKE) go-coverage
	$(MAKE) shared-check
