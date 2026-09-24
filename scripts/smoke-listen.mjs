import assert from "node:assert/strict";
import { WebSocketServer } from "ws";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Run against the installed package, not source imports. The HTTP server is a
// protocol fixture; real product-path acceptance is performed separately.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-listen-smoke-"));
const account = randomUUID();
const eventId = randomUUID();
const body = JSON.stringify({ event: "payment.settled", payment: { status: "settled" } });
const destinations = new Map();
const requests = [];
const completions = [];
let createDisconnect = false;
let completionDisconnect = false;
let emptyStream = false;
const api = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const input = raw ? JSON.parse(raw) : null;
  requests.push({ path: request.url, input });
  let data;
  if (request.url === "/v1/account") {
    if (request.headers.authorization?.startsWith("Bearer pconn_")) {
      response.writeHead(403, { "content-type": "application/json" });
      response.end(JSON.stringify({ success: false, error: { code: "agent_connection_scope_forbidden" } }));
      return;
    }
    data = { id: account };
  }
  else if (request.url === "/v1/endpoints") {
    assert.equal(input.kind, "pull");
    let entry = destinations.get(input.name);
    if (!entry) {
      entry = { id: randomUUID(), org_id: account, kind: "pull", name: input.name,
        enabled: true, rules: input.rules ?? {}, delivery: null, receiver_capabilities: { completion_modes: ["http", "exec", "stdout", "sdk"], stream_protocols: ["primitive.events.v1"] } };
      destinations.set(input.name, entry);
      response.statusCode = 201;
    }
    data = entry;
    if (createDisconnect) { createDisconnect = false; response.destroy(); return; }
  } else if (request.url.endsWith("/pull")) {
    const id = request.url.split("/")[3];
    const entry = [...destinations.values()].find((value) => value.id === id);
    assert.ok(entry);
    entry.delivery ??= { queue_id: randomUUID(), event_id: eventId,
      event_type: "payment.settled", delivery_id: randomUUID(), lease_token: randomUUID(),
      lease_expires_at: new Date(Date.now() + 60_000).toISOString(), body,
      headers: { "Content-Type": "application/json", "X-Webhook-Event": "payment.settled" } };
    data = { delivery: entry.delivery, backlog: 0, gap_count: 0,
      last_gap_reason: null, retention_seconds: 86400, handler_timeout_seconds: 30 };
  } else if (request.url.endsWith("/complete")) {
    completions.push(input);
    if (completionDisconnect) { completionDisconnect = false; response.destroy(); return; }
    data = { result: "completed" };
  } else { response.statusCode = 404; data = {}; }
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data }));
});
const sockets = new WebSocketServer({ server: api });
sockets.on("connection", (socket, request) => {
  socket.on("message", (raw) => {
    const frame = JSON.parse(raw.toString());
    if (frame.type === "authenticate") {
      assert.ok(frame.token === "fixture-key" || frame.token === `pconn_${"a".repeat(64)}`);
      socket.send(JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }));
    } else if (frame.type === "receive") {
      if (emptyStream) return;
      const entry = [...destinations.values()].find((value) => request.url === `/v1/endpoints/${value.id}/stream`);
      assert.ok(entry);
      entry.delivery ??= { queue_id: randomUUID(), event_id: eventId, event_type: "payment.settled", delivery_id: randomUUID(), lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 60000).toISOString(), body, headers: { "Content-Type": "application/json", "X-Webhook-Event": "payment.settled" } };
      socket.send(JSON.stringify({ type: "event", data: { delivery: entry.delivery, backlog: 0, gap_count: 0, last_gap_reason: null, retention_seconds: 86400, handler_timeout_seconds: 30 } }));
    } else if (frame.type === "complete") {
      completions.push(frame.body);
      socket.send(JSON.stringify({ type: "receipt", data: { result: "completed" } }));
    }
  });
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${api.address().port}/v1`;
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: join(directory, "config"),
  PRIMITIVE_API_KEY: "fixture-key", PRIMITIVE_API_BASE_URL: base,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" };
delete env.PRIMITIVE_API_HEADERS;
function run(args, options = {}) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { cwd: directory, env, ...options });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 25_000);
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
let forwarder;
try {
  for (const args of [["listen", "--transport", "poll", "--help"], ["listen", "init", "--help"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout + result.stderr, /listen/);
  }
  let before = requests.length;
  const connected = await run(["listen", "--once", "--timeout", "10"], { env: { ...env, PRIMITIVE_API_KEY: `pconn_${"a".repeat(64)}` } });
  assert.equal(connected.code, 0, connected.stderr);
  assert.equal(connected.stdout.trim(), body);
  assert.equal(requests.slice(before).some(request => request.path === "/v1/account"), false);
  requests.length = 0;
  destinations.clear();
  completions.length = 0;
  before = requests.length;
  const invalid = await run(["listen", "--transport", "poll", "--exec", "unused", "--forward-to", "http://localhost:1234"]);
  assert.notEqual(invalid.code, 0);
  assert.equal(requests.length, before, "invalid modes must fail before authentication");
  for (const args of [["listen", "init"], ["listen", "init", "--language", "python", "--out-dir", "explicit"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(requests.length, before, "starter generation must be offline");
  }
  const original = await readFile(join(directory, "primitive-listener", "accept_event.py"), "utf8");
  const overwrite = await run(["listen", "init", "--language", "python"]);
  assert.notEqual(overwrite.code, 0);
  assert.equal(await readFile(join(directory, "primitive-listener", "accept_event.py"), "utf8"), original);

  createDisconnect = true;
  const bare = await run(["listen", "--transport", "poll", "--events", "payment.settled", "--number", "1"]);
  assert.equal(bare.code, 0, bare.stderr);
  assert.equal(bare.stdout.trim(), body);
  const created = requests.filter((request) => request.path === "/v1/endpoints");
  assert.equal(new Set(created.map((request) => request.input.name)).size, 1,
    "lost creation response must resume the saved name");
  const resumed = await run(["listen", "--transport", "poll", "--number", "1"]);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.match(resumed.stderr, /resumed/);
  assert.match(resumed.stderr, /payment.settled/);
  assert.equal(requests.filter((request) => request.path === "/v1/endpoints").at(-1).input.rules,
    undefined, "bare resume must omit filters and preserve the server selection");
  assert.equal(destinations.size, 1);

  await writeFile(join(directory, "accept.mjs"), `import { appendFileSync } from 'node:fs';
let body = ''; for await (const chunk of process.stdin) body += chunk;
if (process.env.PRIMITIVE_API_KEY || process.env.PRIMITIVE_API_HEADERS) process.exit(9);
appendFileSync('accepted.jsonl', JSON.stringify({id: process.env.PRIMITIVE_EVENT_ID, type: process.env.PRIMITIVE_EVENT_TYPE, body}) + '\\n');
`);
  completionDisconnect = true;
  before = completions.length;
  const executed = await run(["listen", "--transport", "poll", "--subscription", "agent", "--exec", "node accept.mjs", "--number", "1"]);
  assert.equal(executed.code, 0, executed.stderr);
  const accepted = (await readFile(join(directory, "accepted.jsonl"), "utf8")).trim().split("\n");
  assert.equal(accepted.length, 1, "ambiguous completion must not rerun the hook");
  assert.deepEqual(JSON.parse(accepted[0]), { id: eventId, type: "payment.settled", body });
  assert.equal(completions.length - before, 2);
  assert.deepEqual(completions[before], completions[before + 1]);

  let forwarded = 0;
  forwarder = createServer(async (request, response) => {
    let bytes = "";
    for await (const chunk of request) bytes += chunk;
    assert.equal(bytes, body);
    assert.equal(request.headers.authorization, undefined);
    assert.equal(request.headers["x-webhook-event"], "payment.settled");
    forwarded++;
    response.writeHead(204);
    response.end();
  });
  await new Promise((done) => forwarder.listen(0, "127.0.0.1", done));
  const result = await run(["listen", "--transport", "poll", "--subscription", "forward", "--forward-to",
    `127.0.0.1:${forwarder.address().port}/webhook`, "--number", "1"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(forwarded, 1);
  assert.equal(completions.at(-1).mode, "http");
  assert.equal(completions.at(-1).status_code, 204);
  const streamed = await run(["listen", "--subscription", "websocket", "--once", "--timeout", "10"]);
  assert.equal(streamed.code, 0, streamed.stderr);
  assert.equal(streamed.stdout.trim(), body);
  emptyStream = true;
  const timedOut = await run(["listen", "--subscription", "empty", "--once", "--timeout", "1"]);
  assert.equal(timedOut.code, 2, timedOut.stderr);
  emptyStream = false;
  console.log("Packaged listen: bare/resume, offline starter, safe exec, ambiguous responses, and HTTP forwarding passed.");
} finally {
  for (const socket of sockets.clients) socket.terminate();
  sockets.close();
  for (const server of [api, forwarder].filter(Boolean)) {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
  await rm(directory, { recursive: true, force: true });
}
