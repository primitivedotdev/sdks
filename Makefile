.PHONY: api-core-check node-install node-generate node-check-generated node-test node-check node-build node-smoke node-tarball-isolation node-coverage
.PHONY: cli-install cli-test cli-check cli-build cli-smoke cli-tarball-isolation cli-coverage rust-cli-generate rust-cli-manifest-bytewise rust-cli-help-snapshots-bytewise rust-cli-check-generated rust-cli-check rust-cli-doc rust-cli-package rust-cli-build rust-cli-release-build rust-cli-dist rust-cli-smoke rust-cli-release-smoke rust-cli-linux-portability-smoke rust-cli-archive-smoke rust-cli-windows-archive-smoke rust-cli-install-smoke rust-cli-live-smoke rust-cli-live-smoke-no-key rust-cli-full-check cli-command-surface-parity cli-operation-coverage cli-help-parity cli-archive-parity cli-parity
.PHONY: python-sync python-generate python-check-generated python-test python-check python-build python-smoke python-coverage
.PHONY: go-generate go-check-generated go-check go-build go-coverage
.PHONY: shared-check check build release-check ci

PYTHON := $(shell if command -v python3 >/dev/null 2>&1; then printf python3; else printf python; fi)
export COREPACK_ENABLE_AUTO_PIN := 0
NODE_GENERATED_PATHS := openapi/primitive-api.codegen.json sdk-node/src/schema.generated.ts sdk-node/src/types.generated.ts sdk-node/src/generated/email-received-event.validator.generated.ts packages/api-core/src/api packages/api-core/src/openapi/openapi.generated.ts packages/api-core/src/openapi/operations.generated.ts
RUST_CLI_GENERATED_PATHS := openapi/primitive-api.codegen.json packages/api-core/src/api packages/api-core/src/openapi/openapi.generated.ts packages/api-core/src/openapi/operations.generated.ts cli-rust/src/operation-manifest.json cli-rust/src/help_snapshots.generated.rs

api-core-check:
	pnpm --dir packages/api-core check

node-install:
	pnpm install --frozen-lockfile

node-generate:
	pnpm --filter @primitivedotdev/sdk generate

node-check-generated:
	pnpm --filter @primitivedotdev/sdk generate && git diff --exit-code -- $(NODE_GENERATED_PATHS) && test -z "$$(git status --porcelain -- $(NODE_GENERATED_PATHS))"

node-test:
	pnpm --dir sdk-node test

node-check: node-check-generated api-core-check
	if command -v biome >/dev/null 2>&1; then cd sdk-node && biome check --error-on-warnings src/index.ts src/validation.ts src/types.ts src/webhook src/contract src/parser src/api/index.ts src/x402 src/openapi/index.ts src/payloads tests/; else pnpm --dir sdk-node lint; fi
	pnpm --dir sdk-node typecheck
	$(MAKE) node-test

node-build:
	pnpm --dir sdk-node build

node-tarball-isolation:
	node scripts/assert-tarball-isolation.mjs sdk-node "primitive" "@primitivedotdev/cli"

node-smoke: node-build node-tarball-isolation
	pack_dir=$$(mktemp -d) && \
	smoke_dir=$$(mktemp -d) && \
	tarball=$$(cd sdk-node && npm pack --silent --pack-destination "$$pack_dir" | node -e "let data=''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => { const matches = data.match(/[A-Za-z0-9._-]+\.tgz/g); if (!matches || matches.length === 0) { throw new Error('could not locate tarball name in npm pack output'); } process.stdout.write(matches[matches.length - 1]); });") && \
	cd "$$smoke_dir" && \
	npm init -y && \
	npm install "$$pack_dir/$$tarball" && \
	node --input-type=module -e 'const root = await import("@primitivedotdev/sdk"); const webhook = await import("@primitivedotdev/sdk/webhook"); const api = await import("@primitivedotdev/sdk/api"); const openapi = await import("@primitivedotdev/sdk/openapi"); const contract = await import("@primitivedotdev/sdk/contract"); const parser = await import("@primitivedotdev/sdk/parser"); const parserAddress = await import("@primitivedotdev/sdk/parser/address"); const x402 = await import("@primitivedotdev/sdk/x402"); const payloads = await import("@primitivedotdev/sdk/payloads"); const sendEmail = openapi.operationManifest.find((op) => op.operationId === "sendEmail"); if (typeof root.handleWebhook !== "function") throw new Error("missing root handleWebhook export"); if (typeof webhook.handleWebhook !== "function") throw new Error("missing webhook handleWebhook export"); if (typeof api.createPrimitiveApiClient !== "function") throw new Error("missing api client factory"); if (typeof openapi.openapiDocument !== "object") throw new Error("missing openapi document export"); if (!Array.isArray(openapi.operationManifest)) throw new Error("missing openapi operation manifest export"); if (!sendEmail?.requestSchema || !sendEmail?.responseSchema || !sendEmail.headerParams.some((param) => param.name === "Idempotency-Key" && param.minLength === 1 && param.maxLength === 255)) throw new Error("missing sendEmail manifest metadata"); if (typeof contract.buildEmailReceivedEvent !== "function") throw new Error("missing contract buildEmailReceivedEvent export"); if (typeof parser.parseEmail !== "function") throw new Error("missing parser parseEmail export"); if (typeof parserAddress.parseFromHeader !== "function") throw new Error("missing parser/address parseFromHeader export"); if (typeof x402.createX402Client !== "function") throw new Error("missing x402 createX402Client export"); if (typeof payloads.pushFile !== "function" || typeof payloads.pullFile !== "function") throw new Error("missing payloads pushFile/pullFile exports");' && \
	if [ -e "$$smoke_dir/node_modules/.bin/primitive" ]; then echo "SDK tarball must not install a primitive bin (the CLI is the separate primitive package)"; exit 1; fi && \
	if [ -d "$$smoke_dir/node_modules/@primitivedotdev/api-core" ]; then echo "SDK tarball pulled @primitivedotdev/api-core into node_modules; the workspace-internal package must be bundled inline, not declared as a runtime dep."; exit 1; fi

node-coverage:
	pnpm --dir sdk-node test:coverage

cli-install:
	pnpm install --frozen-lockfile

# The CLI imports @primitivedotdev/sdk/x402 (bundled at build time). Its types
# resolve to the SDK's dist, so build the SDK first for typecheck, tests, and
# the bundle to resolve.
cli-test: node-build
	pnpm --dir cli-node test

cli-check: node-build
	if command -v biome >/dev/null 2>&1; then cd cli-node && biome check --error-on-warnings src tests; else pnpm --dir cli-node lint; fi
	pnpm --dir cli-node typecheck
	pnpm --dir cli-node test

cli-build: node-build
	pnpm --dir cli-node build

cli-tarball-isolation:
	node scripts/assert-tarball-isolation.mjs cli-node "@primitivedotdev/sdk"

cli-smoke: cli-build cli-tarball-isolation
	pack_dir=$$(mktemp -d) && \
	smoke_dir=$$(mktemp -d) && \
	tarball=$$(cd cli-node && npm pack --silent --pack-destination "$$pack_dir" | node -e "let data=''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => { const matches = data.match(/[A-Za-z0-9._-]+\.tgz/g); if (!matches || matches.length === 0) { throw new Error('could not locate tarball name in npm pack output'); } process.stdout.write(matches[matches.length - 1]); });") && \
	cd "$$smoke_dir" && \
	npm init -y && \
	npm install "$$pack_dir/$$tarball" && \
	tar -tf "$$pack_dir/$$tarball" | grep -q -- '^package/man/primitive.1$$' && \
	test -f "$$smoke_dir/node_modules/primitive/man/primitive.1" && \
	grep -q -- 'TH PRIMITIVE 1' "$$smoke_dir/node_modules/primitive/man/primitive.1" && \
	node -e 'const pkg = require(process.argv[1]); const oclif = pkg.oclif || {}; const warning = oclif["warn-if-update-available"] || {}; if (!Array.isArray(oclif.plugins) || !oclif.plugins.includes("@oclif/plugin-warn-if-update-available")) throw new Error("missing update warning plugin"); if (warning.timeoutInDays !== 1 || warning.frequency !== 1 || warning.frequencyUnit !== "days") throw new Error("update warning is not daily"); if (!String(warning.message || "").includes("npm install -g primitive@latest")) throw new Error("missing npm update command");' "$$smoke_dir/node_modules/primitive/package.json" && \
	export PRIMITIVE_SKIP_NEW_VERSION_CHECK=1 && \
	bin="$$smoke_dir/node_modules/.bin/primitive" && \
	"$$bin" list-operations >/dev/null && \
	"$$bin" completion fish >/dev/null && \
	"$$bin" completion bash >/dev/null && \
	"$$bin" send --help | grep -q -- "--attachment" && \
	"$$bin" reply --help | grep -q -- "--wait" && \
	"$$bin" reply --help | grep -q -- "--attachment" && \
	if "$$bin" reply --help | grep -q -- "--wait-timeout-ms"; then echo "reply help must not advertise unsupported --wait-timeout-ms"; exit 1; fi && \
	"$$bin" sending reply-to-email --help | grep -q -- "attachments" && \
	"$$bin" sending send-email --help | grep -q -- "attachments" && \
	"$$bin" domains list --json --help | grep -q -- "--json" && \
	"$$bin" domains list --help | grep -q -- "--json" && \
	"$$bin" sending permissions --help | grep -q -- "where you may send mail to" && \
	"$$bin" domains add --help | grep -q -- "--confirmed" && \
	"$$bin" describe addDomain >/dev/null && \
	"$$bin" describe verifyDomain >/dev/null && \
	"$$bin" describe downloadDomainZoneFile >/dev/null && \
	"$$bin" describe domains:addDomain >/dev/null && \
	"$$bin" describe domains:verifyDomain >/dev/null && \
	"$$bin" describe domains:zone-file >/dev/null && \
	"$$bin" domains zone-file --help | grep -q -- "--outbound-only" && \
	"$$bin" inbox status --help | grep -q -- "readiness" && \
	"$$bin" memories --help | grep -q -- "memories set" && \
	"$$bin" memories set --help | grep -q -- "JSON value" && \
	"$$bin" memories set --help | grep -q -- "--function" && \
	"$$bin" memories get --help | grep -q -- "--function" && \
	"$$bin" memories delete --help | grep -q -- "--if-version" && \
	"$$bin" memories search --help | grep -q -- "--metadata-only" && \
	"$$bin" describe memories:set >/dev/null && \
	"$$bin" describe memories:get >/dev/null && \
	"$$bin" describe memories:delete >/dev/null && \
	"$$bin" describe memories:search >/dev/null && \
	"$$bin" payments pay-email-step --help | grep -q -- "interaction.json" && \
	"$$bin" payments pay-email-step --help | grep -q -- "--challenge-file" && \
	"$$bin" payments create-email-challenge --help | grep -q -- "--from" && \
	"$$bin" whoami --help | grep -q -- "--json" && \
	"$$bin" signin --help | grep -q -- "signin <email>" && \
	"$$bin" signin --help | grep -q -- "signin confirm" && \
	"$$bin" login --help | grep -q -- "login <email>" && \
	"$$bin" login --help | grep -q -- "login confirm" && \
	"$$bin" login browser --help | grep -q -- "Log in with browser approval" && \
	"$$bin" login confirm --help | grep -q -- "Confirm email-code login" && \
	"$$bin" otp --help | grep -q -- "Start email-code auth" && \
	"$$bin" otp confirm --help | grep -q -- "Confirm email-code auth" && \
	"$$bin" signin confirm --help | grep -q -- "Confirm email-code sign-in" && \
	"$$bin" signin resend --help | grep -q -- "Resend email-code sign-in code" && \
	"$$bin" signin otp --help | grep -q -- "Start OTP sign-in" && \
	"$$bin" logout --help | grep -q -- "--force" && \
	force_home="$$smoke_dir/force-logout-home" && \
	force_root="$$force_home/.config" && \
	force_dir="$$force_root/primitive" && \
	mkdir -p "$$force_dir/credentials.lock" && \
	node -e 'const fs = require("node:fs"); const [credentialsPath, pendingPath] = process.argv.slice(1); fs.writeFileSync(credentialsPath, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_force", refresh_token: "prim_ort_force", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "22222222-2222-4222-8222-222222222222", org_name: "Force", api_base_url_1: "https://api.force.example/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n"); fs.writeFileSync(pendingPath, JSON.stringify({ api_base_url_1: "https://api.force.example/v1", created_at: "2026-05-25T00:00:00.000Z", email: "force@example.com", expires_at: "2099-05-25T00:00:00.000Z", expires_in: 1800, resend_after: 60, signup_token: "signup-token", verification_code_length: 6 }, null, 2) + "\n");' "$$force_dir/credentials.json" "$$force_dir/signup.json" && \
	HOME="$$force_home" XDG_CONFIG_HOME="$$force_root" PRIMITIVE_CONFIG_DIR= "$$bin" logout --force >"$$smoke_dir/force-logout.out" 2>"$$smoke_dir/force-logout.err" && \
	grep -q -- "pending email-code auth state" "$$smoke_dir/force-logout.err" && \
	test ! -e "$$force_dir/credentials.json" && \
	test ! -e "$$force_dir/signup.json" && \
	test ! -e "$$force_dir/credentials.lock" && \
	lock_home="$$smoke_dir/auth-lock-home" && \
	lock_root="$$lock_home/.config" && \
	lock_dir="$$lock_root/primitive" && \
	mkdir -p "$$lock_dir/credentials.lock" && \
	if HOME="$$lock_home" XDG_CONFIG_HOME="$$lock_root" PRIMITIVE_CONFIG_DIR= "$$bin" signin smoke@example.com --signup-code invite --accept-terms >"$$smoke_dir/auth-lock.out" 2>"$$smoke_dir/auth-lock.err"; then echo "signin should fail while credentials lock exists"; exit 1; fi && \
	grep -q -- "primitive logout --force" "$$smoke_dir/auth-lock.err" && \
	"$$bin" chat --help | grep -q -- "follow-up commands" && \
	if "$$bin" chat --help | grep -q -- "--subject"; then echo "chat help must not advertise --subject"; exit 1; fi && \
	"$$bin" chat --help | grep -q -- "--reply-to-email-id" && \
	"$$bin" chat --help | grep -q -- "--strict-only" && \
	"$$bin" chat --help | grep -q -- "--attachment" && \
	"$$bin" chat reply --help | grep -q -- "Reply in the active chat" && \
	"$$bin" chat reply --help | grep -q -- "--id" && \
	"$$bin" chat reply --help | grep -q -- "--attachment" && \
	chat_reply_home="$$smoke_dir/chat-reply-home" && \
	if HOME="$$chat_reply_home" XDG_CONFIG_HOME="$$chat_reply_home/.config" PRIMITIVE_CONFIG_DIR= "$$bin" chat reply "hello" >"$$smoke_dir/chat-reply.out" 2>"$$smoke_dir/chat-reply.err"; then echo "chat reply should require an active chat"; exit 1; fi && \
	grep -q -- "No open chat" "$$smoke_dir/chat-reply.err" && \
	if HOME="$$chat_reply_home" XDG_CONFIG_HOME="$$chat_reply_home/.config" PRIMITIVE_CONFIG_DIR= "$$bin" chat reply 0 "hello" >"$$smoke_dir/chat-reply-id.out" 2>"$$smoke_dir/chat-reply-id.err"; then echo "chat reply with a local id should require that chat"; exit 1; fi && \
	grep -q -- "No local chat 0" "$$smoke_dir/chat-reply-id.err" && \
	if HOME="$$chat_reply_home" XDG_CONFIG_HOME="$$chat_reply_home/.config" PRIMITIVE_CONFIG_DIR= "$$bin" chat reply --id 0 "hello" >"$$smoke_dir/chat-reply-flag-id.out" 2>"$$smoke_dir/chat-reply-flag-id.err"; then echo "chat reply --id should require that chat"; exit 1; fi && \
	grep -q -- "No local chat 0" "$$smoke_dir/chat-reply-flag-id.err" && \
	"$$bin" threads --help | grep -q -- "primitive threads get --id <thread-id>" && \
	"$$bin" threads get --help | grep -q -- "Get a conversation thread by id" && \
	"$$bin" threads get-thread --help | grep -q -- "Get a conversation thread by id" && \
	function_dir="$$smoke_dir/template-check" && \
	"$$bin" functions test --help | grep -q -- "completed" && \
	"$$bin" functions init template-check --out-dir "$$function_dir" >"$$smoke_dir/functions-init.txt" && \
	grep -q -- 'npm run deploy' "$$smoke_dir/functions-init.txt" && \
	grep -q -- 'npm run test:function' "$$smoke_dir/functions-init.txt" && \
	grep -qF -- 'primitive functions set-secret --id "$$PRIMITIVE_FUNCTION_ID" --key OPENAI_KEY --value-from-env OPENAI_KEY --redeploy' "$$function_dir/README.md" && \
	grep -qF -- 'primitive functions test --id $$PRIMITIVE_FUNCTION_ID --wait --show-sends' "$$function_dir/package.json" && \
	if grep -qF -- '.primitive.email' "$$function_dir/handler.ts"; then echo "function template must not hardcode managed domain suffixes"; exit 1; fi && \
	root_help_config="$$smoke_dir/root-help-config" && \
	HOME="$$root_help_config" XDG_CONFIG_HOME="$$root_help_config/.config" PRIMITIVE_CONFIG_DIR= PRIMITIVE_API_KEY= PRIMITIVE_HIDE_SIGNUP_HINT= "$$bin" >"$$smoke_dir/root-help.txt" && \
	grep -qF -- 'primitive signup <email> --accept-terms' "$$smoke_dir/root-help.txt" && \
	grep -qF -- 'Add `--signup-code <code>` if you have one.' "$$smoke_dir/root-help.txt" && \
	root_auth_home="$$smoke_dir/root-auth-home" && \
	root_auth_config="$$root_auth_home/.config/primitive" && \
	root_auth_port_file="$$smoke_dir/root-auth-port" && \
	root_auth_log="$$smoke_dir/root-auth-server.log" && \
	mkdir -p "$$root_auth_config" && \
	( \
	node -e 'const http = require("node:http"); const fs = require("node:fs"); const server = http.createServer((req, res) => { if (req.method !== "GET" || req.url !== "/v1/account" || req.headers.authorization !== "Bearer prim_oat_root") { res.writeHead(500, { "content-type": "text/plain" }); res.end("unexpected " + req.method + " " + req.url + " " + req.headers.authorization); return; } res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ success: true, data: { id: "acct-root", email: "root@example.com", plan: "pro", created_at: "2026-05-25T00:00:00.000Z", onboarding_completed: true, onboarding_step: null, stripe_subscription_status: null, subscription_current_period_end: null, subscription_cancel_at_period_end: false, spam_threshold: null, discard_content_on_webhook_confirmed: false, webhook_secret_rotated_at: null } })); }); server.listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[1], String(server.address().port)));' "$$root_auth_port_file" >"$$root_auth_log" 2>&1 & \
	root_auth_pid=$$! && \
	trap 'kill "$$root_auth_pid" 2>/dev/null || true' EXIT && \
	for i in 1 2 3 4 5 6 7 8 9 10; do test -s "$$root_auth_port_file" && break; sleep 0.1; done && \
	test -s "$$root_auth_port_file" || { cat "$$root_auth_log"; exit 1; } && \
	root_auth_port=$$(cat "$$root_auth_port_file") && \
	node -e 'const fs = require("node:fs"); const [path, port] = process.argv.slice(1); fs.writeFileSync(path, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_root", refresh_token: "prim_ort_root", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "acct-root", org_name: "Root", api_base_url_1: "http://127.0.0.1:" + port + "/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n");' "$$root_auth_config/credentials.json" "$$root_auth_port" && \
	HOME="$$root_auth_home" XDG_CONFIG_HOME="$$root_auth_home/.config" PRIMITIVE_CONFIG_DIR= PRIMITIVE_API_KEY= "$$bin" >"$$smoke_dir/root-auth-help.txt" && \
	grep -q -- 'Signed in as root@example.com (org acct-root)' "$$smoke_dir/root-auth-help.txt" \
	) && \
	config_home="$$smoke_dir/config-home" && \
	config_root="$$config_home/.config" && \
	config_dir="$$config_root/primitive" && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment default --api-base-url "https://api.default.example/v1" >/dev/null 2>&1 && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment staging --api-base-url "https://api.staging.example/v1" >/dev/null 2>&1 && \
	mkdir -p "$$config_dir" && \
	node -e 'const fs = require("node:fs"); const path = process.argv[1]; fs.writeFileSync(path, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_smoke", refresh_token: "prim_ort_smoke", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "22222222-2222-4222-8222-222222222222", org_name: "Smoke", api_base_url_1: "https://api.staging.example/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n");' "$$config_dir/credentials.json" && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config use default >"$$smoke_dir/config-use.out" 2>"$$smoke_dir/config-use.err" && \
	grep -q -- 'Primitive CLI environment default is active.' "$$smoke_dir/config-use.err" && \
	grep -q -- 'Removed saved Primitive CLI credentials' "$$smoke_dir/config-use.err" && \
	test ! -e "$$config_dir/credentials.json" && \
	node -e 'const fs = require("node:fs"); const path = process.argv[1]; fs.writeFileSync(path, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_smoke", refresh_token: "prim_ort_smoke", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "22222222-2222-4222-8222-222222222222", org_name: "Smoke", api_base_url_1: "https://api.default.example/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n");' "$$config_dir/credentials.json" && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment staging --api-base-url "https://api.staging.example/v1" >"$$smoke_dir/config-set.out" 2>"$$smoke_dir/config-set.err" && \
	grep -q -- 'Primitive CLI environment staging is active.' "$$smoke_dir/config-set.err" && \
	grep -q -- 'Removed saved Primitive CLI credentials' "$$smoke_dir/config-set.err" && \
	test ! -e "$$config_dir/credentials.json" && \
	filter_id="44444444-4444-4444-8444-444444444444" && \
	filter_port_file="$$smoke_dir/filter-server-port" && \
	filter_server_log="$$smoke_dir/filter-server.log" && \
	( \
	node -e 'const http = require("node:http"); const fs = require("node:fs"); const filterId = "44444444-4444-4444-8444-444444444444"; const server = http.createServer((req, res) => { if (req.method !== "PATCH" || req.url !== "/v1/filters/" + filterId || req.headers.authorization !== "Bearer prim_test") { res.writeHead(500, { "content-type": "text/plain" }); res.end("unexpected " + req.method + " " + req.url + " " + req.headers.authorization); return; } let body = ""; req.on("data", (chunk) => { body += chunk; }); req.on("end", () => { if (body !== "{\"enabled\":false}") { res.writeHead(500, { "content-type": "text/plain" }); res.end("unexpected body " + body); return; } res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ success: true, data: { id: filterId, org_id: "acct-1", domain_id: null, type: "blocklist", pattern: "spam@example.com", enabled: false, created_at: "2026-05-25T00:00:00.000Z" } })); }); }); server.listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[1], String(server.address().port)));' "$$filter_port_file" >"$$filter_server_log" 2>&1 & \
	filter_server_pid=$$! && \
	trap 'kill "$$filter_server_pid" 2>/dev/null || true' EXIT && \
	for i in 1 2 3 4 5 6 7 8 9 10; do test -s "$$filter_port_file" && break; sleep 0.1; done && \
	test -s "$$filter_port_file" || { cat "$$filter_server_log"; exit 1; } && \
	filter_port=$$(cat "$$filter_port_file") && \
	"$$bin" filters update-filter --id "$$filter_id" --no-enabled --api-key prim_test --api-base-url "http://127.0.0.1:$$filter_port/v1" > "$$smoke_dir/filter.json" && \
	node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (data.enabled !== false) throw new Error("expected enabled=false");' "$$smoke_dir/filter.json" \
	) && \
	zone_id="33333333-3333-4333-8333-333333333333" && \
	port_file="$$smoke_dir/zone-server-port" && \
	server_log="$$smoke_dir/zone-server.log" && \
	( \
	node -e 'const http = require("node:http"); const fs = require("node:fs"); const zoneId = "33333333-3333-4333-8333-333333333333"; const account = { success: true, data: { id: "acct-1", email: "cli@example.com", plan: "pro", created_at: "2026-05-25T00:00:00.000Z", onboarding_completed: false, onboarding_step: "dns", stripe_subscription_status: "trialing", subscription_current_period_end: null, subscription_cancel_at_period_end: false, spam_threshold: null, discard_content_on_webhook_confirmed: false, webhook_secret_rotated_at: null } }; const domains = { success: true, data: [{ id: "dom-1", org_id: "acct-1", domain: "example.com", verified: true, is_active: true, spam_threshold: null, created_at: "2026-05-25T00:00:00.000Z", updated_at: "2026-05-25T00:00:00.000Z" }] }; const inbox = { success: true, data: { ready: true, receiving_ready: true, processing_ready: true, summary: "Inbound mail is ready and at least one processing route is enabled.", next_actions: [], domains: [{ id: "dom-1", domain: "example.com", verified: true, active: true, managed: false, receiving_ready: true, processing_ready: true, processing_route_count: 1, endpoint_count: 0, enabled_endpoint_count: 0, function_endpoint_count: 0, email_count: 1, latest_email_received_at: "2026-05-25T00:00:00.000Z", status: "ready" }], endpoints: { total: 1, enabled: 1, disabled: 0, fallback_enabled: 1, domain_scoped_enabled: 0, http_enabled: 1, function_enabled: 0 }, functions: { total: 0, deployed: 0, pending: 0, failed: 0 }, recent_emails: { total: 1, latest_received_at: "2026-05-25T00:00:00.000Z" } } }; const server = http.createServer((req, res) => { const expectedZone = "/v1/domains/" + zoneId + "/zone-file?outbound_only=true"; if (req.method !== "GET" || req.headers.authorization !== "Bearer prim_test") { res.writeHead(500, { "content-type": "text/plain" }); res.end("unexpected " + req.method + " " + req.url + " " + req.headers.authorization); return; } if (req.url === "/v1/account") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(account)); return; } if (req.url === "/v1/domains") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(domains)); return; } if (req.url === "/v1/inbox/status") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(inbox)); return; } if (req.url === expectedZone) { res.writeHead(200, { "content-type": "text/plain; charset=utf-8", "content-disposition": "attachment; filename=\"example.com.zone\"" }); res.end("; Zone file for example.com\n$$ORIGIN example.com.\n"); return; } res.writeHead(500, { "content-type": "text/plain" }); res.end("unexpected " + req.method + " " + req.url + " " + req.headers.authorization); }); server.listen(0, "127.0.0.1", () => fs.writeFileSync(process.argv[1], String(server.address().port)));' "$$port_file" >"$$server_log" 2>&1 & \
	server_pid=$$! && \
	trap 'kill "$$server_pid" 2>/dev/null || true' EXIT && \
	for i in 1 2 3 4 5 6 7 8 9 10; do test -s "$$port_file" && break; sleep 0.1; done && \
	test -s "$$port_file" || { cat "$$server_log"; exit 1; } && \
	port=$$(cat "$$port_file") && \
	"$$bin" domains list --json --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/domains.json" && \
	grep -q -- '"domain": "example.com"' "$$smoke_dir/domains.json" && \
	"$$bin" inbox status --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/inbox.txt" && \
	grep -q -- 'Inbound mail is ready' "$$smoke_dir/inbox.txt" && \
	"$$bin" inbox status --domain example.com --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/inbox-domain.txt" && \
	grep -q -- 'example.com can receive mail' "$$smoke_dir/inbox-domain.txt" && \
	"$$bin" whoami --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/whoami.txt" && \
	grep -q -- 'Authenticated as cli@example.com' "$$smoke_dir/whoami.txt" && \
	grep -q -- 'Plan: pro' "$$smoke_dir/whoami.txt" && \
	if grep -q -- 'onboarding' "$$smoke_dir/whoami.txt"; then cat "$$smoke_dir/whoami.txt"; exit 1; fi && \
	"$$bin" whoami --json --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/whoami.json" && \
	grep -q -- '"onboarding_completed": false' "$$smoke_dir/whoami.json" && \
	"$$bin" domains zone-file --id "$$zone_id" --outbound-only --api-key prim_test --api-base-url "http://127.0.0.1:$$port/v1" > "$$smoke_dir/example.zone" && \
	grep -q -- '$$ORIGIN example.com.' "$$smoke_dir/example.zone" && \
	if [ -d "$$smoke_dir/node_modules/@primitivedotdev/sdk" ] || [ -d "$$smoke_dir/node_modules/@primitivedotdev/api-core" ]; then echo "CLI tarball pulled @primitivedotdev/sdk or @primitivedotdev/api-core into node_modules; both should be bundled inline."; exit 1; fi \
	)

cli-coverage:
	pnpm --dir cli-node test:coverage

rust-cli-generate:
	COREPACK_ENABLE_AUTO_PIN=0 pnpm --dir packages/api-core generate
	COREPACK_ENABLE_AUTO_PIN=0 pnpm --dir cli-node build
	node scripts/generate-rust-cli-help-snapshots.mjs --node-bin "node $(CURDIR)/cli-node/bin/run.js"

rust-cli-manifest-bytewise: rust-cli-generate
	node scripts/assert-rust-operation-manifest-bytewise.mjs

rust-cli-help-snapshots-bytewise: rust-cli-generate
	node scripts/generate-rust-cli-help-snapshots.mjs --node-bin "node $(CURDIR)/cli-node/bin/run.js" --check

rust-cli-check-generated: rust-cli-manifest-bytewise rust-cli-help-snapshots-bytewise
	git diff --exit-code -- $(RUST_CLI_GENERATED_PATHS) && test -z "$$(git status --porcelain -- $(RUST_CLI_GENERATED_PATHS))"

rust-cli-check: rust-cli-check-generated
	cargo fmt --manifest-path cli-rust/Cargo.toml --check
	cargo check --manifest-path cli-rust/Cargo.toml --locked
	cargo clippy --manifest-path cli-rust/Cargo.toml --locked --all-targets -- -D warnings
	RUSTDOCFLAGS="-D warnings" cargo doc --manifest-path cli-rust/Cargo.toml --locked --no-deps
	cargo test --manifest-path cli-rust/Cargo.toml --locked

rust-cli-doc: rust-cli-generate
	RUSTDOCFLAGS="-D warnings" cargo doc --manifest-path cli-rust/Cargo.toml --locked --no-deps

rust-cli-package: rust-cli-generate
	cargo package --manifest-path cli-rust/Cargo.toml --locked --allow-dirty

rust-cli-build: rust-cli-generate
	cargo build --manifest-path cli-rust/Cargo.toml --locked

rust-cli-release-build: rust-cli-generate
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then cargo build --release --manifest-path cli-rust/Cargo.toml --locked --target "$$RUST_CLI_CARGO_TARGET"; else cargo build --release --manifest-path cli-rust/Cargo.toml --locked; fi

rust-cli-dist: rust-cli-release-build
	bin_dir="$(CURDIR)/cli-rust/target/release" && \
	dist_target="$${RUST_CLI_DIST_TARGET:-}" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then \
		bin_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; \
		if [ -z "$$dist_target" ]; then \
			case "$$RUST_CLI_CARGO_TARGET" in \
				x86_64-unknown-linux-musl) dist_target="linux-x64" ;; \
				aarch64-unknown-linux-musl) dist_target="linux-arm64" ;; \
				x86_64-apple-darwin) dist_target="macos-x64" ;; \
				aarch64-apple-darwin) dist_target="macos-arm64" ;; \
				x86_64-pc-windows-msvc) dist_target="windows-x64" ;; \
				*) echo "Set RUST_CLI_DIST_TARGET for RUST_CLI_CARGO_TARGET=$$RUST_CLI_CARGO_TARGET"; exit 1 ;; \
			esac; \
		fi; \
	fi && \
	if [ -n "$${RUST_CLI_DIST_BIN_DIR:-}" ]; then bin_dir="$$RUST_CLI_DIST_BIN_DIR"; fi && \
	if [ -n "$$dist_target" ]; then \
		node scripts/package-rust-cli.mjs --version "$${RUST_CLI_DIST_VERSION:-}" --target "$$dist_target" --out-dir "$${RUST_CLI_DIST_DIR:-cli-rust/dist}" --bin-dir "$$bin_dir"; \
	else \
		node scripts/package-rust-cli.mjs --version "$${RUST_CLI_DIST_VERSION:-}" --out-dir "$${RUST_CLI_DIST_DIR:-cli-rust/dist}" --bin-dir "$$bin_dir"; \
	fi

rust-cli-smoke: rust-cli-build
	smoke_dir=$$(mktemp -d) && \
	cargo install --quiet --path cli-rust --locked --root "$$smoke_dir" --debug && \
	"$$smoke_dir/bin/primitive-rust" --version > "$$smoke_dir/version.txt" && \
	grep -q -- 'primitive-rust/' "$$smoke_dir/version.txt" && \
	"$$smoke_dir/bin/primitive" --version > "$$smoke_dir/primitive-version.txt" && \
	grep -q -- 'primitive/' "$$smoke_dir/primitive-version.txt" && \
	"$$smoke_dir/bin/prim" --version > "$$smoke_dir/prim-version.txt" && \
	grep -q -- 'prim/' "$$smoke_dir/prim-version.txt" && \
	"$$smoke_dir/bin/primitive" list-operations > "$$smoke_dir/list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/list-operations.json" && \
	"$$smoke_dir/bin/prim" list-operations > "$$smoke_dir/prim-list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/prim-list-operations.json" && \
	"$$smoke_dir/bin/primitive" describe sending:send-email > "$$smoke_dir/describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/describe-send-email.json"

rust-cli-release-smoke: rust-cli-release-build
	smoke_dir=$$(mktemp -d) && \
	target_dir="$(CURDIR)/cli-rust/target/release" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then target_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; fi && \
	bin="$$target_dir/primitive-rust" && \
	"$$bin" --version > "$$smoke_dir/version.txt" && \
	grep -q -- 'primitive-rust/' "$$smoke_dir/version.txt" && \
	"$$target_dir/primitive" --version > "$$smoke_dir/primitive-version.txt" && \
	grep -q -- 'primitive/' "$$smoke_dir/primitive-version.txt" && \
	"$$target_dir/prim" --version > "$$smoke_dir/prim-version.txt" && \
	grep -q -- 'prim/' "$$smoke_dir/prim-version.txt" && \
	"$$bin" list-operations > "$$smoke_dir/list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/list-operations.json" && \
	"$$target_dir/prim" list-operations > "$$smoke_dir/prim-list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/prim-list-operations.json" && \
	"$$target_dir/primitive" describe sending:send-email > "$$smoke_dir/describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/describe-send-email.json"

rust-cli-linux-portability-smoke: rust-cli-release-build
	target_dir="$(CURDIR)/cli-rust/target/release" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then target_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; fi && \
	case "$${RUST_CLI_CARGO_TARGET:-}" in \
	  *-unknown-linux-musl) node scripts/assert-rust-cli-linux-portability.mjs --bin "$$target_dir/primitive" --expect-static ;; \
	  *) node scripts/assert-rust-cli-linux-portability.mjs --bin "$$target_dir/primitive" --max-glibc "$${RUST_CLI_MAX_GLIBC:-2.39}" ;; \
	esac

rust-cli-archive-smoke: rust-cli-release-build
	smoke_dir=$$(mktemp -d) && \
	extract_dir="$$smoke_dir/extract" && \
	check_dir="$$smoke_dir/check" && \
	run_dir="$$smoke_dir/run" && \
	home_dir="$$smoke_dir/home" && \
	xdg_dir="$$smoke_dir/xdg" && \
	config_dir="$$smoke_dir/primitive" && \
	mkdir -p "$$extract_dir" "$$check_dir" "$$run_dir" "$$home_dir" "$$xdg_dir" "$$config_dir" && \
	bin_dir="$(CURDIR)/cli-rust/target/release" && \
	dist_target="$${RUST_CLI_DIST_TARGET:-}" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then \
		bin_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; \
		if [ -z "$$dist_target" ]; then \
			case "$$RUST_CLI_CARGO_TARGET" in \
				x86_64-unknown-linux-musl) dist_target="linux-x64" ;; \
				aarch64-unknown-linux-musl) dist_target="linux-arm64" ;; \
				x86_64-apple-darwin) dist_target="macos-x64" ;; \
				aarch64-apple-darwin) dist_target="macos-arm64" ;; \
				x86_64-pc-windows-msvc) dist_target="windows-x64" ;; \
				*) echo "Set RUST_CLI_DIST_TARGET for RUST_CLI_CARGO_TARGET=$$RUST_CLI_CARGO_TARGET"; exit 1 ;; \
			esac; \
		fi; \
	fi && \
	if [ -n "$${RUST_CLI_DIST_BIN_DIR:-}" ]; then bin_dir="$$RUST_CLI_DIST_BIN_DIR"; fi && \
	case "$$dist_target" in windows-*) echo "rust-cli-archive-smoke uses Unix archive extraction and execution; use rust-cli-windows-archive-smoke for $$dist_target"; exit 1 ;; esac && \
	if [ -n "$$dist_target" ]; then \
		node scripts/package-rust-cli.mjs --target "$$dist_target" --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	else \
		node scripts/package-rust-cli.mjs --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	fi && \
	archive_path=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).archive);" "$$smoke_dir/package.json") && \
	checksum_path=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).checksum);" "$$smoke_dir/package.json") && \
	checksum_name=$$(basename "$$archive_path") && \
	grep -q -- "  $$checksum_name" "$$checksum_path" && \
	cp "$$archive_path" "$$check_dir/$$checksum_name" && \
	cp "$$checksum_path" "$$check_dir/$$checksum_name.sha256" && \
	case "$$(uname -s)" in \
	  Darwin) cd "$$check_dir" && shasum -a 256 -c "$$checksum_name.sha256" ;; \
	  *) cd "$$check_dir" && sha256sum -c "$$checksum_name.sha256" ;; \
	esac && \
	tar -tzf "$$archive_path" > "$$smoke_dir/tar-list.txt" && \
	grep -qx -- 'primitive' "$$smoke_dir/tar-list.txt" && \
	grep -qx -- 'prim' "$$smoke_dir/tar-list.txt" && \
	grep -qx -- 'README.md' "$$smoke_dir/tar-list.txt" && \
	grep -qx -- 'LICENSE' "$$smoke_dir/tar-list.txt" && \
	tar -C "$$extract_dir" -xzf "$$archive_path" && \
	test -s "$$extract_dir/README.md" && \
	test -s "$$extract_dir/LICENSE" && \
	grep -q -- 'Primitive Rust CLI' "$$extract_dir/README.md" && \
	case "$$(uname -s)" in \
	  Darwin) otool -L "$$extract_dir/primitive" > "$$smoke_dir/native-deps.txt" && if grep -E 'lib(ssl|crypto|z)\\.' "$$smoke_dir/native-deps.txt"; then echo "Rust CLI archive unexpectedly links OpenSSL/libz"; exit 1; fi ;; \
	  Linux) if command -v ldd >/dev/null 2>&1; then if ldd "$$extract_dir/primitive" > "$$smoke_dir/native-deps.txt" 2> "$$smoke_dir/native-deps.err"; then if grep -E 'lib(ssl|crypto|z)\\.so' "$$smoke_dir/native-deps.txt"; then echo "Rust CLI archive unexpectedly links OpenSSL/libz"; exit 1; fi; elif grep -Eiq 'not a dynamic executable|statically linked' "$$smoke_dir/native-deps.txt" "$$smoke_dir/native-deps.err"; then :; else cat "$$smoke_dir/native-deps.txt" "$$smoke_dir/native-deps.err"; exit 1; fi; fi ;; \
	esac && \
	cd "$$run_dir" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/primitive" --version > "$$smoke_dir/version.txt" && \
	grep -q -- 'primitive/' "$$smoke_dir/version.txt" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/prim" --version > "$$smoke_dir/prim-version.txt" && \
	grep -q -- 'prim/' "$$smoke_dir/prim-version.txt" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/primitive" list-operations > "$$smoke_dir/list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/list-operations.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/prim" list-operations > "$$smoke_dir/prim-list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/prim-list-operations.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/prim" describe sending:send-email > "$$smoke_dir/prim-describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/prim-describe-send-email.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$extract_dir/primitive" describe sending:send-email > "$$smoke_dir/describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/describe-send-email.json"

rust-cli-windows-archive-smoke: rust-cli-release-build
	smoke_dir=$$(mktemp -d) && \
	bin_dir="$$smoke_dir/bin" && \
	check_dir="$$smoke_dir/check" && \
	mkdir -p "$$bin_dir" "$$check_dir" && \
	cp "$(CURDIR)/cli-rust/target/release/primitive" "$$bin_dir/primitive.exe" && \
	cp "$(CURDIR)/cli-rust/target/release/prim" "$$bin_dir/prim.exe" && \
	node scripts/package-rust-cli.mjs --target windows-x64 --archive-format zip --bin-dir "$$bin_dir" --out-dir "$$smoke_dir/dist" --json > "$$smoke_dir/package.json" && \
	archive_path=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).archive);" "$$smoke_dir/package.json") && \
	checksum_path=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).checksum);" "$$smoke_dir/package.json") && \
	archive_name=$$(basename "$$archive_path") && \
	case "$$archive_name" in primitive-rust-cli-v*-windows-x64.zip) ;; *) echo "Unexpected Windows archive name: $$archive_name"; exit 1 ;; esac && \
	grep -q -- "  $$archive_name" "$$checksum_path" && \
	cp "$$archive_path" "$$check_dir/$$archive_name" && \
	cp "$$checksum_path" "$$check_dir/$$archive_name.sha256" && \
	case "$$(uname -s)" in \
	  Darwin) cd "$$check_dir" && shasum -a 256 -c "$$archive_name.sha256" ;; \
	  *) cd "$$check_dir" && sha256sum -c "$$archive_name.sha256" ;; \
	esac && \
	printf '%s\n' LICENSE README.md prim.exe primitive.exe | sort > "$$smoke_dir/expected-zip-members.txt" && \
	if command -v zipinfo >/dev/null 2>&1; then \
	  zipinfo -1 "$$archive_path"; \
	else \
	  unzip -Z1 "$$archive_path"; \
	fi | sort > "$$smoke_dir/actual-zip-members.txt" && \
	diff -u "$$smoke_dir/expected-zip-members.txt" "$$smoke_dir/actual-zip-members.txt"

rust-cli-install-smoke: rust-cli-release-build
	smoke_dir=$$(mktemp -d) && \
	install_dir="$$smoke_dir/bin" && \
	home_dir="$$smoke_dir/home" && \
	xdg_dir="$$smoke_dir/xdg" && \
	config_dir="$$smoke_dir/primitive" && \
	mkdir -p "$$install_dir" "$$home_dir" "$$xdg_dir" "$$config_dir" && \
	bin_dir="$(CURDIR)/cli-rust/target/release" && \
	dist_target="$${RUST_CLI_DIST_TARGET:-}" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then \
		bin_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; \
		if [ -z "$$dist_target" ]; then \
			case "$$RUST_CLI_CARGO_TARGET" in \
				x86_64-unknown-linux-musl) dist_target="linux-x64" ;; \
				aarch64-unknown-linux-musl) dist_target="linux-arm64" ;; \
				x86_64-apple-darwin) dist_target="macos-x64" ;; \
				aarch64-apple-darwin) dist_target="macos-arm64" ;; \
				x86_64-pc-windows-msvc) dist_target="windows-x64" ;; \
				*) echo "Set RUST_CLI_DIST_TARGET for RUST_CLI_CARGO_TARGET=$$RUST_CLI_CARGO_TARGET"; exit 1 ;; \
			esac; \
		fi; \
	fi && \
	if [ -n "$${RUST_CLI_DIST_BIN_DIR:-}" ]; then bin_dir="$$RUST_CLI_DIST_BIN_DIR"; fi && \
	case "$$dist_target" in windows-*) echo "rust-cli-install-smoke uses the Unix installer; use scripts/install-rust-cli.ps1 for $$dist_target"; exit 1 ;; esac && \
	if [ -n "$$dist_target" ]; then \
		node scripts/package-rust-cli.mjs --target "$$dist_target" --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	else \
		node scripts/package-rust-cli.mjs --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	fi && \
	version=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).version);" "$$smoke_dir/package.json") && \
	target=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).target);" "$$smoke_dir/package.json") && \
	scripts/install-rust-cli.sh --version "$$version" --target "$$target" --base-url "file://$$smoke_dir/dist" --install-dir "$$install_dir" > "$$smoke_dir/install.txt" && \
	grep -q -- "Installed primitive and prim to $$install_dir" "$$smoke_dir/install.txt" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/primitive" --version > "$$smoke_dir/primitive-version.txt" && \
	grep -q -- 'primitive/' "$$smoke_dir/primitive-version.txt" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/prim" --version > "$$smoke_dir/prim-version.txt" && \
	grep -q -- 'prim/' "$$smoke_dir/prim-version.txt" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/primitive" list-operations > "$$smoke_dir/list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/list-operations.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/prim" list-operations > "$$smoke_dir/prim-list-operations.json" && \
	grep -q -- '"operationId": "getAccount"' "$$smoke_dir/prim-list-operations.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/prim" describe sending:send-email > "$$smoke_dir/prim-describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/prim-describe-send-email.json" && \
	HOME="$$home_dir" XDG_CONFIG_HOME="$$xdg_dir" PRIMITIVE_CONFIG_DIR="$$config_dir" PRIMITIVE_API_KEY= "$$install_dir/primitive" describe sending:send-email > "$$smoke_dir/describe-send-email.json" && \
	grep -q -- '"operationId": "sendEmail"' "$$smoke_dir/describe-send-email.json"

rust-cli-live-smoke: rust-cli-build
	node scripts/run-rust-cli-live-smoke.mjs --rust-bin "$(CURDIR)/cli-rust/target/debug/primitive" $${RUST_CLI_LIVE_SMOKE_ARGS:-}

rust-cli-live-smoke-no-key: rust-cli-build
	node scripts/run-rust-cli-live-smoke.mjs --rust-bin "$(CURDIR)/cli-rust/target/debug/primitive" --no-key-only

cli-command-surface-parity: cli-build rust-cli-check-generated
	node scripts/assert-cli-command-surface-parity.mjs

cli-operation-coverage:
	node scripts/assert-cli-operation-request-coverage.mjs --require-all --require-generated-alias-fixtures --require-generated-command-fixtures --require-canonical-generated-command-fixtures

cli-help-parity: cli-command-surface-parity rust-cli-build
	node scripts/run-cli-help-sweep.mjs --compare-flags --compare-copy --node-bin "$${NODE_CLI_BIN:-node $(CURDIR)/cli-node/bin/run.js}" --rust-bin "$${RUST_CLI_BIN:-$(CURDIR)/cli-rust/target/debug/primitive}"
	shim_dir=$$(mktemp -d) && \
	node_prim_bin="$${NODE_CLI_PRIM_BIN:-}" && \
	if [ -z "$$node_prim_bin" ]; then ln -s "$(CURDIR)/cli-node/bin/run.js" "$$shim_dir/prim" && node_prim_bin="node $$shim_dir/prim"; fi && \
	node scripts/run-cli-help-sweep.mjs --compare-flags --compare-copy --node-bin "$$node_prim_bin" --rust-bin "$${RUST_CLI_PRIM_BIN:-$(CURDIR)/cli-rust/target/debug/prim}"

cli-archive-parity: cli-command-surface-parity cli-operation-coverage rust-cli-release-build
	smoke_dir=$$(mktemp -d) && \
	extract_dir="$$smoke_dir/extract" && \
	mkdir -p "$$extract_dir" && \
	bin_dir="$(CURDIR)/cli-rust/target/release" && \
	dist_target="$${RUST_CLI_DIST_TARGET:-}" && \
	if [ -n "$${RUST_CLI_CARGO_TARGET:-}" ]; then \
		bin_dir="$(CURDIR)/cli-rust/target/$$RUST_CLI_CARGO_TARGET/release"; \
		if [ -z "$$dist_target" ]; then \
			case "$$RUST_CLI_CARGO_TARGET" in \
				x86_64-unknown-linux-musl) dist_target="linux-x64" ;; \
				aarch64-unknown-linux-musl) dist_target="linux-arm64" ;; \
				x86_64-apple-darwin) dist_target="macos-x64" ;; \
				aarch64-apple-darwin) dist_target="macos-arm64" ;; \
				x86_64-pc-windows-msvc) dist_target="windows-x64" ;; \
				*) echo "Set RUST_CLI_DIST_TARGET for RUST_CLI_CARGO_TARGET=$$RUST_CLI_CARGO_TARGET"; exit 1 ;; \
			esac; \
		fi; \
	fi && \
	if [ -n "$${RUST_CLI_DIST_BIN_DIR:-}" ]; then bin_dir="$$RUST_CLI_DIST_BIN_DIR"; fi && \
	case "$$dist_target" in windows-*) echo "cli-archive-parity uses Unix archive extraction and execution; use Windows workflow parity for $$dist_target"; exit 1 ;; esac && \
	if [ -n "$$dist_target" ]; then \
		node scripts/package-rust-cli.mjs --target "$$dist_target" --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	else \
		node scripts/package-rust-cli.mjs --out-dir "$$smoke_dir/dist" --bin-dir "$$bin_dir" --json > "$$smoke_dir/package.json"; \
	fi && \
	archive_path=$$(node -e "const fs=require('fs'); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).archive);" "$$smoke_dir/package.json") && \
	tar -C "$$extract_dir" -xzf "$$archive_path" && \
	node scripts/run-cli-help-sweep.mjs --compare-flags --compare-copy --node-bin "$${NODE_CLI_BIN:-node $(CURDIR)/cli-node/bin/run.js}" --rust-bin "$$extract_dir/primitive" && \
	node scripts/run-cli-parity.mjs --node-bin "$${NODE_CLI_BIN:-node $(CURDIR)/cli-node/bin/run.js}" --rust-bin "$$extract_dir/primitive" && \
	node_prim_bin="$${NODE_CLI_PRIM_BIN:-}" && \
	if [ -z "$$node_prim_bin" ]; then ln -s "$(CURDIR)/cli-node/bin/run.js" "$$smoke_dir/prim" && node_prim_bin="node $$smoke_dir/prim"; fi && \
	node scripts/run-cli-help-sweep.mjs --compare-flags --compare-copy --node-bin "$$node_prim_bin" --rust-bin "$$extract_dir/prim" && \
	node scripts/run-cli-parity.mjs --node-bin "$$node_prim_bin" --rust-bin "$$extract_dir/prim"

cli-parity: cli-help-parity cli-operation-coverage
	node scripts/run-cli-parity.mjs --node-bin "$${NODE_CLI_BIN:-node $(CURDIR)/cli-node/bin/run.js}" --rust-bin "$${RUST_CLI_BIN:-$(CURDIR)/cli-rust/target/debug/primitive}"
	shim_dir=$$(mktemp -d) && \
	node_prim_bin="$${NODE_CLI_PRIM_BIN:-}" && \
	if [ -z "$$node_prim_bin" ]; then ln -s "$(CURDIR)/cli-node/bin/run.js" "$$shim_dir/prim" && node_prim_bin="node $$shim_dir/prim"; fi && \
	node scripts/run-cli-parity.mjs --node-bin "$$node_prim_bin" --rust-bin "$${RUST_CLI_PRIM_BIN:-$(CURDIR)/cli-rust/target/debug/prim}"

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

check: node-check cli-check python-check go-check shared-check

build: node-build cli-build python-build go-build

rust-cli-full-check: rust-cli-check rust-cli-package rust-cli-build rust-cli-smoke rust-cli-live-smoke-no-key rust-cli-release-smoke rust-cli-linux-portability-smoke rust-cli-archive-smoke rust-cli-windows-archive-smoke rust-cli-install-smoke cli-parity cli-archive-parity

release-check: node-check node-build node-smoke cli-check cli-build cli-smoke python-check python-build python-smoke go-check go-build shared-check

ci:
	$(MAKE) node-install
	$(MAKE) cli-install
	$(MAKE) python-sync
	$(MAKE) node-check
	$(MAKE) node-build
	$(MAKE) node-smoke
	$(MAKE) node-coverage
	$(MAKE) cli-check
	$(MAKE) cli-build
	$(MAKE) cli-smoke
	$(MAKE) cli-coverage
	$(MAKE) python-check
	$(MAKE) python-build
	$(MAKE) python-smoke
	$(MAKE) python-coverage
	$(MAKE) go-check
	$(MAKE) go-build
	$(MAKE) go-coverage
	$(MAKE) shared-check
