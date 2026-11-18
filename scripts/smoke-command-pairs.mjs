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
    : { success: true, data: result.data, ...(result.meta ? { meta: result.meta } : {}) }));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const listening = server.address();
assert(listening && typeof listening === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("PRIMITIVE_")));
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
async function wire(args, expected, response = { data: { id } }, stdin) {
  requests.length = 0;
  reply = () => response;
  const output = document(await run([...args, "--json"], stdin));
  assert.equal(output.success, true, JSON.stringify(output));
  assert(output.data !== undefined, JSON.stringify(output));
  for (const [key, value] of Object.entries(response.data))
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
    { data: { items: [], next_cursor: "page-three" } });
  assert.equal(paged.data.next_cursor, "page-three");
  await wire(["keys", "list", "--cursor", "page-two", "--include-revoked", "false"],
    { method: "GET", path: "/v1/keys", query: { cursor: "page-two", include_revoked: "false" } },
    { data: { items: [], next_cursor: null } });

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
