import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { WebSocketServer } from "ws";

// Built/installed CLI invocation against fake API and native session boundaries.
// No mailbox, model, native daemon lifecycle, or account credentials are used.
if (process.platform === "win32") {
  console.log("Native Unix session smoke skipped on Windows.");
  process.exit(0);
}
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp("/tmp/primitive-notify-smoke-");
await chmod(directory, 0o700);
const sessionId = randomUUID();
const endpointId = randomUUID();
let eventId = randomUUID();
const event = JSON.parse(await readFile(new URL("../test-fixtures/webhook/valid-email-received.json", import.meta.url), "utf8"));
event.email.id = randomUUID();
event.email.smtp.rcpt_to = ["device@example.com"];
event.email.auth.dmarc = "pass";
event.email.auth.dmarcFromDomain = "example.com";
event.email.auth.dmarcDkimAligned = true;
event.email.auth.spf = "pass";
const apiCalls = [];
const completions = [];
const api = createServer(async (request, response) => {
  let raw = ""; for await (const bytes of request) raw += bytes;
  const body = raw ? JSON.parse(raw) : null;
  apiCalls.push(request.url);
  let data;
  if (request.url === "/v1/endpoints") data = { id: endpointId, kind: "pull", enabled: true, recipient: "device@example.com", rules: { event_types: ["email.received"] }, receiver_capabilities: { completion_modes: ["sdk", "stdout"], stream_protocols: ["primitive.events.v1"] } };
  else if (request.url.endsWith("/pull")) data = { delivery: { queue_id: randomUUID(), event_id: eventId, delivery_id: randomUUID(), event_type: "email.received", lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 60000).toISOString(), body: JSON.stringify(event), headers: {} }, gap_count: 0, last_gap_reason: null, backlog: 0, retention_seconds: 86400, handler_timeout_seconds: 30 };
  else if (request.url.endsWith("/complete")) { completions.push(body); data = { result: "completed" }; }
  else { response.statusCode = 404; data = {}; }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ success: true, data }));
});
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
const nativeHttp = createServer();
const native = new WebSocketServer({ server: nativeHttp });
const socketPath = join(directory, "native.sock");
await new Promise((resolve) => nativeHttp.listen(socketPath, resolve));
await chmod(socketPath, 0o600);
let dropQueue = false;
const queued = [];
const methods = [];
native.on("connection", (socket) => socket.on("message", (bytes) => {
  const message = JSON.parse(bytes.toString()); methods.push(message.method);
  if (message.id === undefined) return;
  let result;
  if (message.method === "initialize") result = {};
  else if (message.method === "thread/loaded/list") result = { data: [sessionId], nextCursor: null };
  else if (message.method === "thread/read") result = { thread: { id: sessionId, cwd: directory, canAcceptDirectInput: true } };
  else if (message.method === "thread/queue/add") { queued.push(message.params); if (dropQueue) return; result = { queuedSubmission: { id: randomUUID(), clientUserMessageId: message.params.clientUserMessageId } }; }
  else assert.fail(`Unexpected native method ${message.method}`);
  socket.send(JSON.stringify({ id: message.id, result }));
}));
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: join(directory, "config"), PRIMITIVE_API_KEY: `pconn_${"a".repeat(64)}`, PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${api.address().port}/v1`, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" };
delete env.PRIMITIVE_API_HEADERS;
function invoke(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("CLI smoke timeout")); }, 15000);
    child.stdout.on("data", (bytes) => { stdout += bytes; }); child.stderr.on("data", (bytes) => { stderr += bytes; });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const notify = ["listen", "--notify-session", sessionId, "--sender", "sender@example.com", "--session-socket", socketPath, "--transport", "poll", "--once"];
try {
  const help = await invoke(["listen", "--help"]); assert.equal(help.code, 0); assert.match(help.stdout, /--notify-session/); assert.match(help.stdout, /--status/);
  const missing = await invoke(["listen", "--notify-session", sessionId]); assert.notEqual(missing.code, 0); assert.match(missing.stderr, /--sender/);
  const conflict = await invoke([...notify, "--exec", "true"]); assert.notEqual(conflict.code, 0);
  const offline = await invoke(notify.map((value) => value === socketPath ? `${socketPath}.absent` : value)); assert.notEqual(offline.code, 0); assert.equal(apiCalls.length, 0);
  const initialStatus = await invoke(["listen", "--status", "--notify-session", sessionId]); assert.equal(initialStatus.code, 0); assert.deepEqual(JSON.parse(initialStatus.stdout).receipts, []); assert.equal(apiCalls.length, 0);
  const first = await invoke(notify); assert.equal(first.code, 0, first.stderr); assert.equal(queued.length, 1); assert.equal(completions.at(-1).mode, "sdk"); assert.equal(completions.at(-1).accepted, true);
  const repeated = await invoke(notify); assert.equal(repeated.code, 0, repeated.stderr); assert.equal(queued.length, 1);
  assert.equal(queued[0].threadId, sessionId); assert.match(queued[0].input[0].text, /External email notification/); assert.ok(!queued[0].input[0].text.includes(event.email.headers.subject));
  event.email.id = randomUUID(); eventId = randomUUID(); dropQueue = true;
  const unknown = await invoke(notify); assert.notEqual(unknown.code, 0); assert.match(unknown.stderr, /unknown outcome/); assert.equal(queued.length, 2);
  const held = await invoke(notify); assert.notEqual(held.code, 0); assert.match(held.stderr, /unknown outcome/); assert.equal(queued.length, 2);
  const count = apiCalls.length;
  const status = await invoke(["listen", "--status", "--notify-session", sessionId]); assert.equal(status.code, 0); assert.equal(JSON.parse(status.stdout).receipts.filter((receipt) => receipt.state === "unknown").length, 1); assert.equal(apiCalls.length, count);
  const bare = await invoke(["listen", "--transport", "poll", "--once"]); assert.equal(bare.code, 0, bare.stderr); assert.equal(JSON.parse(bare.stdout).event, "email.received");
  assert.ok(methods.every((method) => ["initialize", "initialized", "thread/loaded/list", "thread/read", "thread/queue/add"].includes(method)));
  console.log("Native session notification CLI smoke passed.");
} finally {
  for (const socket of native.clients) socket.terminate();
  await new Promise((resolve) => native.close(resolve));
  await new Promise((resolve) => nativeHttp.close(resolve));
  await new Promise((resolve) => api.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
