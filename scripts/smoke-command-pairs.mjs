import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const home = await mkdtemp(join(tmpdir(), "primitive-command-pairs-"));
const id = "11111111-1111-4111-8111-111111111111";
const versions = [7, 8, 9].map((version) => `00000000-0000-4000-8000-${String(version).padStart(12, "0")}`);
const address = "peer@example.com";
// Pin the public replacements independently of the implementation's map.
const retired = {
  "contacts:delete-contact": "contacts:delete",
  "contacts:get-contact": "contacts:get",
  "contacts:list-contacts": "contacts:list",
  "credits:get-credit-balance": "credits:balance",
  "functions:redeploy-function": "functions:redeploy",
  "functions:set-function-route": "functions:set-route",
  "functions:set-function-secret": "functions:set-secret",
  "functions:unset-function-route": "functions:unset-route",
  "memories:delete-memory": "memories:delete",
  "memories:get-memory": "memories:get",
  "memories:set-memory": "memories:set",
  "memories:search-memories": "memories:search",
  "routes:create-route": "routes:create",
  "routes:delete-route": "routes:delete",
  "routes:update-route": "routes:update",
  "routes:list-routes": "routes:list",
  "routes:reorder-routes": "routes:reorder",
  "threads:mute-thread": "threads:mute",
  "threads:unmute-thread": "threads:unmute",
  "wake:create-wake-schedule": "wake:schedules:create",
  "wake:delete-wake-schedule": "wake:schedules:delete",
  "wake:get-wake-schedule": "wake:schedules:get",
  "wake:run-wake-schedule": "wake:schedules:run",
  "wake:update-wake-schedule": "wake:schedules:update",
  "wake:list-wake-schedules": "wake:schedules:list",
  "wake:create-wake-authorization": "wake:authorizations:create",
  "wake:delete-wake-authorization": "wake:authorizations:delete",
  "wake:update-wake-authorization": "wake:authorizations:update",
  "wake:list-wake-authorizations": "wake:authorizations:list",
  "wake:list-wake-dispatches": "wake:dispatches:list",
  "credentials:get-key": "keys:get",
  "credentials:list-keys": "keys:list",
  "roles-and-members:list-roles": "roles:list",
  "roles-and-members:get-access-mode": "roles:access-mode",
  "mailbox-access:list-groups": "roles:groups",
  "mailbox-access:list-mailbox-access": "roles:mailbox-access",
  "projects:list-organization-people": "members:list",
  "roles:members": "members:list",
};
const requests = [];
let reply = () => ({ data: { id } });
const server = createServer(async (request, response) => {
  let text = "";
  for await (const chunk of request) text += chunk;
  const url = new URL(request.url, "http://127.0.0.1");
  const seen = {
    method: request.method,
    path: decodeURIComponent(url.pathname),
    query: Object.fromEntries(url.searchParams),
    body: text ? JSON.parse(text) : undefined,
    headers: request.headers,
  };
  requests.push(seen);
  const result = reply(seen);
  response.writeHead(result.status ?? 200, { "content-type": "application/json" });
  response.end(JSON.stringify(result.error
    ? { success: false, error: result.error }
    : { ...result, success: true }));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const listening = server.address();
assert(listening && typeof listening === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) =>
  !/^(PRIMITIVE_|CLAUDE|CODEX|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|http_proxy|https_proxy|all_proxy)/.test(name)));
Object.assign(env, {
  HOME: home, XDG_CONFIG_HOME: home, PRIMITIVE_CONFIG_DIR: home,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_API_KEY: "prim_test_only",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${listening.port}/v1`,
  NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
});

function run(args, stdin) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: [stdin === undefined ? "ignore" : "pipe", "pipe", "pipe"] });
    if (stdin !== undefined) child.stdin.end(stdin);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
async function parallel(items, check) {
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < items.length) await check(items[next++]);
  }));
}
function document(result, expectedCode = 0) {
  assert.equal(result.code, expectedCode, result.stdout + result.stderr);
  assert.equal(result.stderr, "", result.stderr);
  return JSON.parse(result.stdout);
}
async function wire(args, expected, response = { data: { id } }, stdin, expectedData = response.data) {
  requests.length = 0;
  reply = () => response;
  const output = document(await run([...args, "--json"], stdin));
  assert.equal(output.success, true, JSON.stringify(output));
  assert(output.data !== undefined, JSON.stringify(output));
  for (const [key, value] of Object.entries(expectedData))
    assert.deepEqual(output.data[key], value, `${args.join(" ")}: data.${key}`);
  assert.equal(requests.length, 1, JSON.stringify(requests));
  const seen = requests[0];
  for (const [key, value] of Object.entries(expected)) {
    if (key === "headers") {
      for (const [name, header] of Object.entries(value)) assert.equal(seen.headers[name], header);
    } else assert.deepEqual(seen[key], value, `${args.join(" ")}: ${key}`);
  }
  return output;
}

try {
  await parallel(Object.entries(retired), async ([oldId, newId]) => {
    const output = document(await run([...oldId.split(":"), "--json"]), 2);
    assert.equal(output.error.code, "command_not_found", oldId);
    assert.equal(output.exit_code, 2, oldId);
    assert(output.error.details.suggestions.includes(`primitive ${newId.replaceAll(":", " ")}`), JSON.stringify(output));
    const help = await run([...newId.split(":"), "--help-full"]);
    assert.equal(help.code, 0, `${newId}: ${help.stdout}${help.stderr}`);
    assert.match(help.stdout, /USAGE/);
    if (newId === "wake:schedules:create") {
      assert.match(help.stdout, /REQUIRED INPUTS/);
      assert.match(help.stdout.replace(/\s+/g, " "), /Optional JSON object passed through to the woken function/);
    }
  });
  const parents = new Set(Object.entries(retired).flatMap(([oldId, newId]) => [
    oldId.split(":")[0], ...newId.split(":").slice(0, -1).map((_, index, parts) => parts.slice(0, index + 1).join(":")),
  ]));
  await parallel([...parents], async (parent) => {
    for (const tail of [[], ["--help"]]) {
      const result = await run([...parent.split(":"), ...tail]);
      assert.equal(result.code, 0, `${parent}: ${result.stdout}${result.stderr}`);
      assert.match(result.stdout, /COMMANDS|USAGE/);
    }
  });
  assert.equal(requests.length, 0, "retired names and help must never send requests");

  const wakeBody = { from_address: "clock@example.com", target_address: "worker@example.com", command: "refresh", cron_expr: "0 9 * * *", args: { count: 2 } };
  await wire(["wake", "schedules", "create", "--from", wakeBody.from_address, "--to", wakeBody.target_address, "--command", "refresh", "--cron", wakeBody.cron_expr, "--args", '{"count":2}'],
    { method: "POST", path: "/v1/wake/schedules", body: wakeBody });
  await wire(["wake", "schedules", "create", "--raw-body", JSON.stringify(wakeBody), "--idempotency-key", "schedule-create"],
    { method: "POST", path: "/v1/wake/schedules", body: wakeBody, headers: { "idempotency-key": "schedule-create" } });
  const scheduleFile = join(home, "schedule.json");
  await writeFile(scheduleFile, '{"note":null,"enabled":false}');
  await wire(["wake", "schedules", "update", "--id", id, "--body-file", scheduleFile],
    { method: "PATCH", path: `/v1/wake/schedules/${id}`, body: { note: null, enabled: false } });
  await wire(["wake", "schedules", "update", id, "--no-enabled"],
    { method: "PATCH", path: `/v1/wake/schedules/${id}`, body: { enabled: false } });
  await wire(["wake", "schedules", "run", "--id", id, "--idempotency-key", "schedule-run"],
    { method: "POST", path: `/v1/wake/schedules/${id}/run`, headers: { "idempotency-key": "schedule-run" } });
  await wire(["wake", "schedules", "get", "--id", id],
    { method: "GET", path: `/v1/wake/schedules/${id}`, query: {} }, { data: { id } }, "ignored piped input\n");
  await wire(["wake", "authorizations", "create", "--endpoint", id, "--domain", "example.com", "--command", "refresh", "--command", "poll"],
    { method: "POST", path: "/v1/wake/authorizations", body: { recipient_endpoint_id: id, allowed_sender_domain: "example.com", allowed_commands: ["refresh", "poll"] } });
  const authorizationBody = { recipient_endpoint_id: id, allowed_sender_domain: "example.com", allowed_sender_address: null, allowed_commands: null };
  await wire(["wake", "authorizations", "create", "--raw-body", JSON.stringify(authorizationBody), "--idempotency-key", "grant-create"],
    { method: "POST", path: "/v1/wake/authorizations", body: authorizationBody, headers: { "idempotency-key": "grant-create" } });

  await wire(["memories", "set", "progress", '{"step":2}', "--function", id, "--if-version", "3"],
    { method: "PUT", path: "/v1/memories", body: { key: "progress", value: { step: 2 }, scope: { type: "function", id }, if_version: "3" } });
  const memoryBody = { key: "progress", value: null, scope: { type: "function", id } };
  await wire(["memories", "set", "--raw-body", JSON.stringify(memoryBody), "--x-primitive-function-id", id],
    { method: "PUT", path: "/v1/memories", body: memoryBody, headers: { "x-primitive-function-id": id } });
  await wire(["memories", "set", "--raw-body", JSON.stringify(memoryBody), "--no-if-absent", "--no-clear-ttl"],
    { method: "PUT", path: "/v1/memories", body: { ...memoryBody, if_absent: false, clear_ttl: false } });
  await wire(["memories", "set", "--raw-body", '{"key":"k","value":1}', "--no-if-absent", "--if-version", "3"],
    { method: "PUT", path: "/v1/memories", body: { key: "k", value: 1, if_absent: false, if_version: "3" } });
  await wire(["memories", "set", "--raw-body", '{"key":"k","value":1}', "--no-clear-ttl", "--ttl-seconds", "60"],
    { method: "PUT", path: "/v1/memories", body: { key: "k", value: 1, clear_ttl: false, ttl_seconds: 60 } });
  const valueFile = join(home, "memory-value.json");
  await writeFile(valueFile, '{"source":"file"}');
  await wire(["memories", "set", "from-file", "--value-file", valueFile],
    { method: "PUT", path: "/v1/memories", body: { key: "from-file", value: { source: "file" } } },
    { data: { id } }, '"piped value must not replace the file"\n');
  await wire(["memories", "get", "--key", "progress", "--scope-type", "function", "--scope-id", id, "--x-primitive-function-id", id],
    { method: "GET", path: "/v1/memories", query: { key: "progress", scope_type: "function", scope_id: id }, headers: { "x-primitive-function-id": id } });
  await wire(["memories", "get", "--key=--state"],
    { method: "GET", path: "/v1/memories", query: { key: "--state" } });
  await wire(["routes", "create", address, "--function", id],
    { method: "POST", path: "/v1/routes", body: { match_type: "exact", pattern: address, function_id: id } });
  await wire(["routes", "update", "--id", id, "--raw-body", '{"domain_id":null,"priority":0}'],
    { method: "PATCH", path: `/v1/routes/${id}`, body: { domain_id: null, priority: 0 } });
  await wire(["contacts", "delete", address, "--if-version", versions[0]],
    { method: "DELETE", path: `/v1/contacts/${address}`, query: { if_version: versions[0] } });
  await wire(["contacts", "delete", "--address", address, "--if-version", versions[1]],
    { method: "DELETE", path: `/v1/contacts/${address}`, query: { if_version: versions[1] } });

  requests.length = 0;
  reply = (request) => request.method === "GET"
    ? { data: { address, version: versions[2] } }
    : { status: 409, error: { code: "contact_conflict", message: "Contact changed" } };
  const conflict = document(await run(["contacts", "delete", address, "--json"]), 1);
  assert.equal(conflict.error.code, "contact_conflict");
  assert.deepEqual(requests.map(({ method, path, query }) => ({ method, path, query })), [
    { method: "GET", path: `/v1/contacts/${address}`, query: {} },
    { method: "DELETE", path: `/v1/contacts/${address}`, query: { if_version: versions[2] } },
  ], "a contact conflict must not retry the versioned write");

  await wire(["functions", "redeploy", "--id", id, "--idempotency-key", "stored-source"],
    { method: "POST", path: `/v1/functions/${id}/redeploy`, headers: { "idempotency-key": "stored-source" } });
  const bundle = join(home, "handler.js");
  const code = "export default async () => ({ ok: true });\n";
  await writeFile(bundle, code);
  await wire(["functions", "redeploy", "--id", id, "--file", bundle],
    { method: "PUT", path: `/v1/functions/${id}`, body: { code } });
  requests.length = 0;
  reply = (request) => ({ data: request.path.includes("/secrets/") ? { key: request.path.split("/").at(-1) } : { id } });
  const secretDeploy = document(await run(["functions", "redeploy", "--id", id, "--file", bundle,
    "--secret", "FIRST=fixture-one", "--secret", "SECOND=fixture-two", "--json"]));
  assert.equal(secretDeploy.success, true);
  assert.equal(secretDeploy.data.id, id);
  // Secret writes are sequential and must both complete before uploading code.
  assert.deepEqual(requests.map(({ method, path, body }) => ({ method, path, body })), [
    { method: "PUT", path: `/v1/functions/${id}/secrets/FIRST`, body: { value: "fixture-one" } },
    { method: "PUT", path: `/v1/functions/${id}/secrets/SECOND`, body: { value: "fixture-two" } },
    { method: "PUT", path: `/v1/functions/${id}`, body: { code } },
  ]);
  requests.length = 0;
  reply = () => ({ data: { key: "TOKEN" } });
  const stdinSecret = document(await run(["functions", "set-secret", "--id", id, "--key", "TOKEN", "--stdin", "--json"], "fixture-token\n\n"));
  assert.equal(stdinSecret.success, true);
  assert.equal(stdinSecret.data.secret.key, "TOKEN");
  assert.deepEqual(requests.map(({ method, path, body }) => ({ method, path, body })), [
    { method: "PUT", path: `/v1/functions/${id}/secrets/TOKEN`, body: { value: "fixture-token\n" } },
  ], "the explicit stdin reader removes exactly one trailing newline");
  for (const [command, method] of [["mute", "PUT"], ["unmute", "DELETE"]]) {
    await wire(["threads", command, "--id", id, "--address", address],
      { method, path: `/v1/threads/${id}/mute`, query: { address } },
      { data: { thread_id: id, address, muted: command === "mute" } });
  }
  const paged = await wire(["keys", "list", "--cursor", "page-two", "--include-revoked"],
    { method: "GET", path: "/v1/keys", query: { cursor: "page-two", include_revoked: "true" } },
    { data: { items: [], next_cursor: "page-three" }, meta: { trace: "retained" }, warnings: ["key notice"] }, undefined, []);
  assert.deepEqual(paged.data, []);
  assert.deepEqual(paged.meta, { cursor: "page-three", has_more: true, trace: "retained" });
  assert.deepEqual(paged.warnings, ["key notice"]);
  await wire(["keys", "list", "--cursor", "page-two", "--include-revoked", "false"],
    { method: "GET", path: "/v1/keys", query: { cursor: "page-two", include_revoked: "false" } },
    { data: { items: [], next_cursor: null } }, undefined, []);

  requests.length = 0;
  reply = (request) => ({ data: { items: [{ id: request.query.cursor ?? id }],
    next_cursor: request.query.cursor ? null : "second-page" },
    warnings: [request.query.cursor ? "second page notice" : "first page notice"],
    meta: request.query.cursor ? { second_page: true, trace: "second" } : { first_page: true, trace: "first" } });
  const keys = document(await run(["keys", "list", "--include-revoked", "--json"]));
  assert.deepEqual(keys.data, [{ id }, { id: "second-page" }]);
  assert.deepEqual(keys.meta, { first_page: true, second_page: true, trace: "second", cursor: null, has_more: false });
  assert.deepEqual(keys.warnings, ["first page notice", "second page notice"]);
  assert.deepEqual(requests.map((request) => request.query), [
    { include_revoked: "true" }, { cursor: "second-page", include_revoked: "true" },
  ]);

  // A bounded aggregation must still hand the caller its continuation.
  requests.length = 0;
  reply = () => ({ data: { items: [], next_cursor: `page-${requests.length}` } });
  const bounded = document(await run(["keys", "list", "--json"]));
  assert.equal(requests.length, 50);
  assert.deepEqual(bounded.meta, { cursor: "page-50", has_more: true });

  const person = { user_id: id, name: "Reader", work_email: null, role: "member",
    role_name: "Member", role_id: null, agents: [], mail_access: { read: true, send: false } };
  for (const canInvite of [false, true]) {
    // --time selects the structured delegate; the readable form shares the
    // same JSON contract even though it doesn't ask for timing.
    for (const timing of [[], ["--time"]]) {
      const members = await wire(["members", "list", "--query", "reader", "--limit", "1", "--cursor", "previous", ...timing],
        { method: "GET", path: "/v1/organization/members", query: { query: "reader", limit: "1", cursor: "previous" } },
        { data: { items: [person], cursor: "next-member", can_invite: canInvite }, meta: { trace: "retained" }, warnings: ["member notice"] }, undefined, [person]);
      assert.deepEqual(members.data, [person]);
      assert.equal(members.meta.cursor, "next-member");
      assert.equal(members.meta.can_invite, canInvite);
      assert.equal(members.meta.trace, "retained");
      assert.deepEqual(members.warnings, ["member notice"]);
      if (timing.length) {
        assert(members.cli_warnings.some((warning) => warning.includes("[time:")));
      }
    }
  }
  const emptyMembers = await wire(["members", "list"],
    { method: "GET", path: "/v1/organization/members", query: {} },
    { data: { items: [], cursor: null, can_invite: false } }, undefined, []);
  assert.deepEqual(emptyMembers.meta, { cursor: null, can_invite: false });

  for (const meta of [undefined, { trace: "retained", cursor: "opaque" }]) {
    const endpoints = await wire(["endpoints", "list"],
      { method: "GET", path: "/v1/endpoints", query: {} }, { data: [{ id }], meta, warnings: ["endpoint notice"] });
    assert.deepEqual(endpoints.meta, meta ?? {});
    assert.deepEqual(endpoints.warnings, ["endpoint notice"]);
  }

  const classification = { id, vocabulary: "v1", classified_at: "2026-11-01T12:00:00Z",
    facts: { is_invoice: { value: true, confidence: 0.9 } } };
  for (const argument of [[id], ["--id", id]]) {
    requests.length = 0;
    reply = () => ({ data: { understanding: { status: "ready", classification_id: id,
      vocabulary: classification.vocabulary, classified_at: classification.classified_at, facts: classification.facts } } });
    const facts = document(await run(["emails", "facts", ...argument, "--json"]));
    assert.deepEqual(facts, { success: true, data: classification, meta: {} });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].path, `/v1/emails/${id}`);
  }
  for (const understanding of [undefined, { status: "pending" }, { status: "unavailable" }]) {
    reply = () => ({ data: { understanding } });
    assert.deepEqual(document(await run(["emails", "facts", id, "--json"])),
      { success: true, data: null, meta: {} });
  }
  reply = () => ({ data: { understanding: { status: "pending" } },
    warnings: ["classification pending"], meta: { trace: "retained" } });
  assert.deepEqual(document(await run(["emails", "facts", id, "--json"])),
    { success: true, data: null, meta: { trace: "retained" }, warnings: ["classification pending"] });
  for (const args of [["keys", "list"], ["keys", "list", "--cursor", "next"],
    ["members", "list"], ["members", "list", "--time"], ["endpoints", "list"], ["emails", "facts", id]]) {
    reply = () => ({ status: 403, error: { code: "forbidden", message: "Fixture refusal" } });
    const error = document(await run([...args, "--json"]), 1);
    assert.equal(error.error.code, "forbidden");
    assert.equal(error.exit_code, 1);
  }
  requests.length = 0;
  reply = () => requests.length === 1
    ? { data: { items: [{ id }], next_cursor: "next" } }
    : { status: 403, error: { code: "forbidden", message: "Fixture later-page refusal" } };
  const failedKeys = document(await run(["keys", "list", "--json"]), 1);
  assert.equal(failedKeys.error.code, "forbidden");
  assert.equal(failedKeys.data, undefined);

  const beforeHelp = requests.length;
  for (const parent of ["keys", "members", "endpoints", "emails"]) {
    for (const suffix of [[], ["--help"]]) {
      const help = await run([parent, ...suffix]);
      assert.equal(help.code, 0, help.stdout + help.stderr);
      assert.match(help.stdout + help.stderr, /USAGE|COMMANDS/);
    }
  }
  assert.equal(requests.length, beforeHelp);

  for (const args of [
    ["wake", "schedules", "create", "--from", "clock@example.com", "--raw-body", JSON.stringify(wakeBody)],
    ["memories", "set", "progress", "null", "--raw-body", JSON.stringify(memoryBody)],
    ["memories", "set", "progress", "null", "--if-absent", "--if-version", "3"],
    ["routes", "create", address, "--function", id, "--raw-body", '{"pattern":"other@example.com","match_type":"exact"}'],
  ]) {
    requests.length = 0;
    const invalid = document(await run([...args, "--json"]), 2);
    assert.equal(invalid.error.code, "usage_error");
    assert.equal(requests.length, 0, `mixed input must not be ignored: ${args.join(" ")}`);
  }
  console.log(`Command pairs: ${Object.keys(retired).length} retired names, canonical help, both input forms, headers, nullable values, paging, CAS and mixed-input rejection passed.`);
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(home, { recursive: true, force: true });
}
