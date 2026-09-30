import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
let presenceControl;
const api = createServer(async (request, response) => {
  let raw = ""; for await (const bytes of request) raw += bytes;
  const body = raw ? JSON.parse(raw) : null;
  apiCalls.push(request.url);
  let data;
  if (request.url === "/v1/agent-networks/default/contact-admission") {
    assert.equal(body.email_id, event.email.id);
    data = {allowed:false,pending:false,member_policy_required:false,allowed_since:null};
  }
  else if (request.url === "/v1/endpoints") data = { id: endpointId, kind: "pull", enabled: true, recipient: "device@example.com", rules: { event_types: ["email.received"] }, receiver_capabilities: { completion_modes: ["sdk", "stdout"], stream_protocols: ["primitive.events.v1"] } };
  else if (request.url === `/v1/emails/${event.email.id}`) data = {
    id: event.email.id, recipient: "device@example.com", to_email: "device@example.com",
    from_email: event.email.headers.from, from_header: event.email.headers.from,
    status: "completed", received_at: event.email.received_at,
    reply_to_sent_email_id: null, parsed: event.email.parsed, body_text: event.email.parsed.body_text,
    body_html: event.email.parsed.body_html, auth: event.email.auth,
    ...(presenceControl ? { presence_control: presenceControl } : {}),
  };
  else if (request.url.endsWith("/pull")) data = { delivery: { queue_id: randomUUID(), event_id: eventId, delivery_id: randomUUID(), event_type: "email.received", lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 60000).toISOString(), body: JSON.stringify(event), headers: {} }, gap_count: 0, last_gap_reason: null, backlog: 0, retention_seconds: 86400, handler_timeout_seconds: 30 };
  else if (request.url.endsWith("/complete")) { completions.push(body); data = { result: "completed" }; }
  else { response.statusCode = 404; data = {}; }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ success: true, data }));
});
const streams = new WebSocketServer({ server: api });
streams.on("connection", (socket) => {
  let delivered;
  socket.on("message", (bytes) => {
    const frame = JSON.parse(bytes.toString());
    if (frame.type === "authenticate") socket.send(JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }));
    else if (frame.type === "receive" && delivered !== eventId) {
      delivered = eventId;
      socket.send(JSON.stringify({ type: "event", data: {
        delivery: { queue_id: randomUUID(), event_id: eventId, delivery_id: randomUUID(),
          event_type: "email.received", lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 60000).toISOString(),
          body: JSON.stringify(event), headers: {} },
        gap_count: 0, last_gap_reason: null, backlog: 0, retention_seconds: 86400, handler_timeout_seconds: 30,
      } }));
    } else if (frame.type === "complete") {
      completions.push(frame.body);
      socket.send(JSON.stringify({ type: "receipt", data: { result: "completed" } }));
    }
  });
});
await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
let nativeHttp, native;
const socketPath = join(directory, "native.sock");
let nativeLoaded = true;
let absentLoads = 0;
let dropQueue = false;
const queued = [];
const methods = [];
async function startNativeServer() {
  nativeHttp = createServer();
  native = new WebSocketServer({ server: nativeHttp });
  native.on("connection", (socket) => socket.on("message", (bytes) => {
    const message = JSON.parse(bytes.toString()); methods.push(message.method);
    if (message.id === undefined) return;
    let result;
    if (message.method === "initialize") result = {};
    else if (message.method === "thread/loaded/list") {
      if (!nativeLoaded) absentLoads++;
      result = { data: nativeLoaded ? [sessionId] : [] };
    }
    else if (message.method === "thread/read") result = { thread: { id: sessionId, cwd: directory, canAcceptDirectInput: true } };
    else if (message.method === "thread/resume") {
      assert.deepEqual(message.params, { threadId: sessionId });
      assert.equal(nativeLoaded, true, "The receiver must not resume an unloaded thread");
      result = { thread: { id: sessionId } };
    }
    else if (message.method === "turn/start") { queued.push(message.params); if (dropQueue) return; result = { turn: { id: randomUUID(), items: [], status: "inProgress" } }; }
    else assert.fail(`Unexpected native method ${message.method}`);
    socket.send(JSON.stringify({ id: message.id, result }));
  }));
  await new Promise((resolve) => nativeHttp.listen(socketPath, resolve));
  await chmod(socketPath, 0o600);
}
await startNativeServer();
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: join(directory, "config"), PRIMITIVE_API_KEY: `pconn_${"a".repeat(64)}`, PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${api.address().port}/v1`, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" };
delete env.PRIMITIVE_API_HEADERS;
delete env.PRIMITIVE_AGENT_PROFILE;
delete env.PRIMITIVE_LISTEN_BACKGROUND_TOKEN;
delete env.PRIMITIVE_LISTEN_BACKGROUND_TARGET;
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
const notify = ["listen", "--notify-session", sessionId, "--sender", "sender@example.com", "--session-socket", socketPath, "--once"];
const statusArgs = ["listen", "--status", "--notify-session", sessionId];
const stopArgs = ["listen", "--stop", "--notify-session", sessionId];
async function presenceSaved(kind, id) {
  const root = join(env.PRIMITIVE_CONFIG_DIR, "presence");
  for (const scope of await readdir(root).catch(() => [])) {
    try { await readFile(join(root, scope, kind, `${id}.json`)); return true; } catch {}
  }
  return false;
}
async function waitFor(check) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("Background receiver did not reach the expected state");
}
try {
  const help = await invoke(["listen", "--help"]); assert.equal(help.code, 0); assert.match(help.stdout, /--notify-session/); assert.match(help.stdout, /--status/); assert.match(help.stdout, /exact already-loaded thread/);
  const missing = await invoke(["listen", "--notify-session", sessionId]); assert.notEqual(missing.code, 0); assert.match(missing.stderr, /--sender/);
  const conflict = await invoke([...notify, "--exec", "true"]); assert.notEqual(conflict.code, 0);
  const offline = await invoke(notify.map((value) => value === socketPath ? `${socketPath}.absent` : value)); assert.notEqual(offline.code, 0); assert.equal(apiCalls.length, 0);
  const initialStatus = await invoke(["listen", "--status", "--notify-session", sessionId]); assert.equal(initialStatus.code, 0); assert.deepEqual(JSON.parse(initialStatus.stdout).receipts, []); assert.equal(apiCalls.length, 0);
  await mkdir(env.PRIMITIVE_CONFIG_DIR, { recursive: true, mode: 0o700 });
  const credentialsPath = join(env.PRIMITIVE_CONFIG_DIR, "credentials.json");
  const expiredCredentials = JSON.stringify({ auth_method: "oauth", access_token: "expired", refresh_token: "expired-refresh", token_type: "Bearer", expires_at: "2020-01-01T00:00:00.000Z", oauth_grant_id: randomUUID(), oauth_client_id: "cli", org_id: randomUUID(), org_name: null, api_base_url: env.PRIMITIVE_API_BASE_URL, created_at: "2020-01-01T00:00:00.000Z" });
  await writeFile(credentialsPath, expiredCredentials, { mode: 0o600 });
  const connectedKey = env.PRIMITIVE_API_KEY; delete env.PRIMITIVE_API_KEY;
  const oauthStatus = await invoke(["listen", "--status", "--notify-session", sessionId]); assert.notEqual(oauthStatus.code, 0); assert.match(oauthStatus.stderr, /connected-agent credential/); assert.equal(apiCalls.length, 0); assert.equal(await readFile(credentialsPath, "utf8"), expiredCredentials);
  env.PRIMITIVE_API_KEY = connectedKey;
  const first = await invoke(notify); assert.equal(first.code, 0, first.stderr); assert.equal(queued.length, 1); assert.equal(completions.at(-1).mode, "sdk"); assert.equal(completions.at(-1).accepted, true);
  const repeated = await invoke([...notify, "--timeout", "1"]); assert.equal(repeated.code, 2, repeated.stderr); assert.equal(queued.length, 1);
  assert.equal(queued[0].threadId, sessionId); assert.deepEqual(Object.keys(queued[0]).sort(), ["input", "threadId", "toolOutput"]); assert.deepEqual(queued[0].input, []); assert.equal(queued[0].toolOutput.name, "mail_received"); assert.equal(queued[0].toolOutput.namespace, "primitive"); assert.match(queued[0].toolOutput.output, /External email notification/); assert.ok(!queued[0].toolOutput.output.includes(event.email.headers.subject));

  const backgroundArgs = [...notify.filter((value) => value !== "--once"), "--background"];
  const started = await invoke(backgroundArgs); assert.equal(started.code, 0, started.stderr);
  const startedState = JSON.parse(started.stdout);
  assert.equal(startedState.started, true); assert.equal(startedState.status.detached, true);
  const runningPid = startedState.status.pid;
  const reused = await invoke(backgroundArgs); assert.equal(reused.code, 0, reused.stderr);
  assert.equal(JSON.parse(reused.stdout).started, false); assert.equal(JSON.parse(reused.stdout).status.pid, runningPid);
  const initializations = methods.filter((method) => method === "initialize").length;
  nativeLoaded = false;
  for (const socket of native.clients) socket.terminate();
  await new Promise((resolve) => native.close(resolve));
  await new Promise((resolve) => nativeHttp.close(resolve));
  await startNativeServer();
  await waitFor(() => absentLoads > 0);
  const reconnecting = JSON.parse((await invoke(statusArgs)).stdout).listener;
  assert.equal(reconnecting.phase, "reconnecting"); assert.equal(reconnecting.pid, runningPid);
  assert.equal(queued.length, 1, "An unloaded session cannot receive or replay external events");
  nativeLoaded = true;
  await waitFor(() => methods.filter((method) => method === "initialize").length > initializations);
  await waitFor(async () => {
    const health = JSON.parse((await invoke(statusArgs)).stdout).listener;
    return health.healthy && health.phase === "receiving" && health.pid === runningPid;
  });
  assert.equal(queued.length, 1, "Native reconnect must not replay accepted external events");
  event.email.id = randomUUID(); eventId = randomUUID();
  for (const socket of streams.clients) socket.terminate();
  await waitFor(() => queued.length === 2);
  await waitFor(async () => JSON.parse((await invoke(statusArgs)).stdout).receipts.filter((receipt) => receipt.state === "accepted").length === 2);
  const stopped = await invoke(stopArgs); assert.equal(stopped.code, 0, stopped.stderr);
  assert.equal(JSON.parse(stopped.stdout).listener.phase, "stopped");
  assert.equal(JSON.parse(stopped.stdout).listener.healthy, false);

  event.email.id = randomUUID(); eventId = randomUUID(); dropQueue = true;
  const unknown = await invoke(notify); assert.notEqual(unknown.code, 0); assert.match(unknown.stderr, /unknown outcome/); assert.equal(queued.length, 3);
  const held = await invoke(notify); assert.notEqual(held.code, 0); assert.match(held.stderr, /unknown outcome/); assert.equal(queued.length, 3);
  const count = apiCalls.length;
  const status = await invoke(["listen", "--status", "--notify-session", sessionId]); assert.equal(status.code, 0); assert.equal(JSON.parse(status.stdout).receipts.filter((receipt) => receipt.state === "unknown").length, 1); assert.equal(apiCalls.length, count);
  const pageOne = await invoke(["listen", "--status", "--notify-session", sessionId, "--limit", "1"]); assert.equal(pageOne.code, 0, pageOne.stderr); const firstPage = JSON.parse(pageOne.stdout); assert.equal(firstPage.receipts.length, 1); assert.ok(firstPage.nextCursor);
  const pageTwo = await invoke(["listen", "--status", "--notify-session", sessionId, "--limit", "2", "--cursor", firstPage.nextCursor]); assert.equal(pageTwo.code, 0, pageTwo.stderr); const secondPage = JSON.parse(pageTwo.stdout); assert.equal(secondPage.receipts.length, 2); assert.equal(secondPage.nextCursor, null); assert.ok(secondPage.receipts.every((receipt) => receipt.emailId !== firstPage.receipts[0].emailId));
  const badFilter = await invoke([...notify, "--events", "email.received,payment.settled"]); assert.notEqual(badFilter.code, 0); assert.match(badFilter.stderr, /email.received only/);
  const bare = await invoke(["listen", "--transport", "poll", "--once"]); assert.equal(bare.code, 0, bare.stderr); assert.equal(JSON.parse(bare.stdout).event, "email.received");
  assert.ok(methods.every((method) => ["initialize", "initialized", "thread/loaded/list", "thread/read", "thread/resume", "turn/start"].includes(method)));
  // A built receiver must leave task limits intact for quiet and pending controls.
  env.PRIMITIVE_CONFIG_DIR = join(directory, "presence-config");
  dropQueue = false;
  const priorTurns = queued.length;
  event.email.id = randomUUID(); eventId = randomUUID();
  presenceControl = { status: "verified", valid_for_ms: 0 };
  const quietProbeId = event.email.id;
  const quiet = await invoke([...notify, "--timeout", "3"]);
  assert.ok(apiCalls.includes(`/v1/emails/${quietProbeId}`), "The timeout scenario must actually inspect its control before testing restart");
  assert.equal(quiet.code, 2, quiet.stderr);
  assert.ok(await presenceSaved("controls", quietProbeId), "Restart coverage requires durable classification before the timeout");
  assert.equal(queued.length, priorTurns, "A verified control cannot start a model turn or finish --once");
  event.email.id = randomUUID(); eventId = randomUUID();
  presenceControl = { status: "pending", valid_for_ms: 0 };
  const probeId = event.email.id;
  const ordinaryAfterProbe = invoke([...notify, "--timeout", "8"]);
  ordinaryAfterProbe.then((result) => { if (result.code !== 0) console.error("Pending control run:", result); });
  await waitFor(() => presenceSaved("pending", probeId));
  assert.equal(queued.length, priorTurns, "Pending proof cannot become a model event");
  event.email.id = randomUUID(); eventId = randomUUID(); presenceControl = undefined;
  const taskId = event.email.id;
  for (const socket of streams.clients) socket.terminate();
  const simultaneous = await ordinaryAfterProbe;
  assert.equal(simultaneous.code, 0, simultaneous.stderr);
  assert.equal(queued.length, priorTurns + 1, "Ordinary mail must still satisfy this receiver's --once");
  assert.ok(queued.at(-1).toolOutput.output.includes(taskId));
  console.log("Native session notification CLI smoke passed.");
} finally {
  await invoke(stopArgs).catch(() => {});
  for (const socket of streams.clients) socket.terminate();
  for (const socket of native.clients) socket.terminate();
  await new Promise((resolve) => streams.close(resolve));
  await new Promise((resolve) => native.close(resolve));
  await new Promise((resolve) => nativeHttp.close(resolve));
  await new Promise((resolve) => api.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
