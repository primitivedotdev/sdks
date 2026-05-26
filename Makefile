.PHONY: node-install node-generate node-check-generated node-test node-check node-build node-smoke node-tarball-isolation node-coverage
.PHONY: cli-install cli-test cli-check cli-build cli-smoke cli-tarball-isolation cli-coverage
.PHONY: python-sync python-generate python-check-generated python-test python-check python-build python-smoke python-coverage
.PHONY: go-generate go-check-generated go-check go-build go-coverage
.PHONY: shared-check check build release-check ci

PYTHON := $(shell if command -v python3 >/dev/null 2>&1; then printf python3; else printf python; fi)

node-install:
	pnpm install --frozen-lockfile

node-generate:
	pnpm --filter @primitivedotdev/sdk generate

node-check-generated:
	pnpm --filter @primitivedotdev/sdk generate && git diff --exit-code -- openapi/primitive-api.codegen.json sdk-node/src/schema.generated.ts sdk-node/src/types.generated.ts sdk-node/src/generated/email-received-event.validator.generated.ts packages/api-core/src/api packages/api-core/src/openapi/openapi.generated.ts packages/api-core/src/openapi/operations.generated.ts

node-test:
	pnpm --dir sdk-node test

node-check: node-check-generated
	if command -v biome >/dev/null 2>&1; then cd sdk-node && biome check --error-on-warnings src/index.ts src/validation.ts src/types.ts src/webhook src/contract src/parser src/api/index.ts src/openapi/index.ts tests/; else pnpm --dir sdk-node lint; fi
	pnpm --dir sdk-node typecheck
	$(MAKE) node-test

node-build:
	pnpm --dir sdk-node build

node-tarball-isolation:
	node scripts/assert-tarball-isolation.mjs sdk-node "@primitivedotdev/cli"

node-smoke: node-build node-tarball-isolation
	pack_dir=$$(mktemp -d) && smoke_dir=$$(mktemp -d) && tarball=$$(cd sdk-node && npm pack --silent --pack-destination "$$pack_dir" | node -e "let data=''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => { const matches = data.match(/[A-Za-z0-9._-]+\.tgz/g); if (!matches || matches.length === 0) { throw new Error('could not locate tarball name in npm pack output'); } process.stdout.write(matches[matches.length - 1]); });") && cd "$$smoke_dir" && npm init -y && npm install "$$pack_dir/$$tarball" && node --input-type=module -e "const root = await import('@primitivedotdev/sdk'); const webhook = await import('@primitivedotdev/sdk/webhook'); const api = await import('@primitivedotdev/sdk/api'); const openapi = await import('@primitivedotdev/sdk/openapi'); const contract = await import('@primitivedotdev/sdk/contract'); const parser = await import('@primitivedotdev/sdk/parser'); if (typeof root.handleWebhook !== 'function') throw new Error('missing root handleWebhook export'); if (typeof webhook.handleWebhook !== 'function') throw new Error('missing webhook handleWebhook export'); if (typeof api.createPrimitiveApiClient !== 'function') throw new Error('missing api client factory'); if (typeof openapi.openapiDocument !== 'object') throw new Error('missing openapi document export'); if (typeof contract.buildEmailReceivedEvent !== 'function') throw new Error('missing contract buildEmailReceivedEvent export'); if (typeof parser.parseEmail !== 'function') throw new Error('missing parser parseEmail export');" && if [ -e "$$smoke_dir/node_modules/.bin/primitive" ]; then echo "SDK tarball must not install a primitive bin (the CLI moved to @primitivedotdev/cli)"; exit 1; fi && if [ -d "$$smoke_dir/node_modules/@primitivedotdev/api-core" ]; then echo "SDK tarball pulled @primitivedotdev/api-core into node_modules; the workspace-internal package must be bundled inline, not declared as a runtime dep."; exit 1; fi

node-coverage:
	pnpm --dir sdk-node test:coverage

cli-install:
	pnpm install --frozen-lockfile

cli-test:
	pnpm --dir cli-node test

cli-check:
	if command -v biome >/dev/null 2>&1; then cd cli-node && biome check --error-on-warnings src tests; else pnpm --dir cli-node lint; fi
	pnpm --dir cli-node typecheck
	$(MAKE) cli-test

cli-build:
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
	test -f "$$smoke_dir/node_modules/@primitivedotdev/cli/man/primitive.1" && \
	grep -q -- 'TH PRIMITIVE 1' "$$smoke_dir/node_modules/@primitivedotdev/cli/man/primitive.1" && \
	node -e 'const pkg = require(process.argv[1]); const oclif = pkg.oclif || {}; const warning = oclif["warn-if-update-available"] || {}; if (!Array.isArray(oclif.plugins) || !oclif.plugins.includes("@oclif/plugin-warn-if-update-available")) throw new Error("missing update warning plugin"); if (warning.timeoutInDays !== 1 || warning.frequency !== 1 || warning.frequencyUnit !== "days") throw new Error("update warning is not daily"); if (!String(warning.message || "").includes("npm install -g @primitivedotdev/cli@latest")) throw new Error("missing npm update command");' "$$smoke_dir/node_modules/@primitivedotdev/cli/package.json" && \
	export PRIMITIVE_SKIP_NEW_VERSION_CHECK=1 && \
	bin="$$smoke_dir/node_modules/.bin/primitive" && \
	"$$bin" list-operations >/dev/null && \
	"$$bin" completion fish >/dev/null && \
	"$$bin" completion bash >/dev/null && \
	"$$bin" send --help | grep -q -- "--attachment" && \
	"$$bin" reply --help | grep -q -- "--wait" && \
	if "$$bin" reply --help | grep -q -- "--wait-timeout-ms"; then echo "reply help must not advertise unsupported --wait-timeout-ms"; exit 1; fi && \
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
	grep -q -- 'primitive signup <email> --signup-code <invite-code> --accept-terms' "$$smoke_dir/root-help.txt" && \
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
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment default --api-base-url-1 "https://api.default.example/v1" >/dev/null 2>&1 && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment staging --api-base-url-1 "https://api.staging.example/v1" >/dev/null 2>&1 && \
	mkdir -p "$$config_dir" && \
	node -e 'const fs = require("node:fs"); const path = process.argv[1]; fs.writeFileSync(path, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_smoke", refresh_token: "prim_ort_smoke", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "22222222-2222-4222-8222-222222222222", org_name: "Smoke", api_base_url_1: "https://api.staging.example/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n");' "$$config_dir/credentials.json" && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config use default >"$$smoke_dir/config-use.out" 2>"$$smoke_dir/config-use.err" && \
	grep -q -- 'Primitive CLI environment default is active.' "$$smoke_dir/config-use.err" && \
	grep -q -- 'Removed saved Primitive CLI credentials' "$$smoke_dir/config-use.err" && \
	test ! -e "$$config_dir/credentials.json" && \
	node -e 'const fs = require("node:fs"); const path = process.argv[1]; fs.writeFileSync(path, JSON.stringify({ auth_method: "oauth", access_token: "prim_oat_smoke", refresh_token: "prim_ort_smoke", token_type: "Bearer", expires_at: "2099-05-25T00:00:00.000Z", oauth_grant_id: "11111111-1111-4111-8111-111111111111", oauth_client_id: "primitive-cli", org_id: "22222222-2222-4222-8222-222222222222", org_name: "Smoke", api_base_url_1: "https://api.default.example/v1", created_at: "2026-05-25T00:00:00.000Z" }, null, 2) + "\n");' "$$config_dir/credentials.json" && \
	HOME="$$config_home" XDG_CONFIG_HOME="$$config_root" PRIMITIVE_CONFIG_DIR= "$$bin" config set --environment staging --api-base-url-1 "https://api.staging.example/v1" >"$$smoke_dir/config-set.out" 2>"$$smoke_dir/config-set.err" && \
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
	"$$bin" filters update-filter --id "$$filter_id" --no-enabled --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$filter_port/v1" > "$$smoke_dir/filter.json" && \
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
	"$$bin" domains list --json --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/domains.json" && \
	grep -q -- '"domain": "example.com"' "$$smoke_dir/domains.json" && \
	"$$bin" inbox status --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/inbox.txt" && \
	grep -q -- 'Inbound mail is ready' "$$smoke_dir/inbox.txt" && \
	"$$bin" inbox status --domain example.com --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/inbox-domain.txt" && \
	grep -q -- 'example.com can receive mail' "$$smoke_dir/inbox-domain.txt" && \
	"$$bin" whoami --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/whoami.txt" && \
	grep -q -- 'Authenticated as cli@example.com' "$$smoke_dir/whoami.txt" && \
	grep -q -- 'Plan: pro' "$$smoke_dir/whoami.txt" && \
	if grep -q -- 'onboarding' "$$smoke_dir/whoami.txt"; then cat "$$smoke_dir/whoami.txt"; exit 1; fi && \
	"$$bin" whoami --json --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/whoami.json" && \
	grep -q -- '"onboarding_completed": false' "$$smoke_dir/whoami.json" && \
	"$$bin" domains zone-file --id "$$zone_id" --outbound-only --api-key prim_test --api-base-url-1 "http://127.0.0.1:$$port/v1" > "$$smoke_dir/example.zone" && \
	grep -q -- '$$ORIGIN example.com.' "$$smoke_dir/example.zone" && \
	if [ -d "$$smoke_dir/node_modules/@primitivedotdev/sdk" ] || [ -d "$$smoke_dir/node_modules/@primitivedotdev/api-core" ]; then echo "CLI tarball pulled @primitivedotdev/sdk or @primitivedotdev/api-core into node_modules; both should be bundled inline."; exit 1; fi \
	)

cli-coverage:
	pnpm --dir cli-node test:coverage

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
