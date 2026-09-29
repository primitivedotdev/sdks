import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { WebSocketServer } from "ws";

// Packaged CLI and real local sockets. No real email, credentials, or model.
if (process.platform === "win32") {
  console.log("Late contact notice smoke requires Unix sockets.");
  process.exit(0);
}
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const root = await mkdtemp("/tmp/primitive-late-contact-");
const config = join(root, "config");
await mkdir(config, { mode: 0o700 });
const agent = "agent@sender.example", peer = "peer@example.net";
const sentinelPeer = "updates@example.org";
const credential = ["pconn", randomUUID().replaceAll("-", "").repeat(2)].join("_");
const org = randomUUID(), endpoint = randomUUID(), session = randomUUID(), version = randomUUID();
const old = "2026-01-01T00:00:00.000Z";
const sends = new Map(), emails = new Map(), parts = new Map();
const pending = [], completed = [], notices = [], children = [], failures = [];
const fixture = JSON.parse(await readFile(new URL("../test-fixtures/webhook/valid-email-received.json", import.meta.url), "utf8"));
let muted = false, silenced = false, posts = 0, activeStreams = 0, streamOpens = 0, maximumStreams = 0;
let receiver, listener, directoryContact;
let directoryWrites = 0;
function json(response, data, meta) {
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }));
}
function acceptance(request) {
  return { ...request, step: "accept", step_id: randomUUID(), prev_step_id: request.step_id, payload: {} };
}
function inbound(control, parent, id, sender = peer) {
  const now = new Date().toISOString();
  const bytes = control ? Buffer.from(JSON.stringify(control)) : undefined;
  const body = `Private fixture body ${randomUUID()}`;
  const auth = { spf: "pass", dmarc: "pass", dmarcFromDomain: sender.split("@")[1], dmarcSpfAligned: true, dmarcDkimAligned: true, dkimSignatures: [] };
  const detail = {
    id, recipient: agent, to_email: agent, sender, from_email: sender, from_header: sender,
    status: "completed", domain: "sender.example", webhook_attempt_count: 0,
    message_id: `<${id}@example.net>`, created_at: now, received_at: now,
    reply_to_sent_email_id: parent, body_text: body, body_html: null, replies: [], auth,
    parsed: { status: "complete", body_text: body, body_html: null, attachments: bytes ? [{ filename: "interaction.json", content_type: "application/json", part_index: 0, size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }] : [] },
  };
  emails.set(id, detail);
  if (bytes) parts.set(id, bytes);
  const event = structuredClone(fixture);
  event.email.id = id;
  event.email.received_at = now;
  event.email.smtp.rcpt_to = [agent];
  event.email.smtp.mail_from = sender;
  event.email.headers.from = sender;
  event.email.headers.to = agent;
  event.email.auth = { ...event.email.auth, ...auth };
  return { detail, delivery: { queue_id: randomUUID(), event_id: randomUUID(), delivery_id: randomUUID(), event_type: "email.received", lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 30_000).toISOString(), body: JSON.stringify(event), headers: {} } };
}
function dispatch() {
  if (!receiver || !pending.length) return;
  const socket = receiver;
  receiver = undefined;
  socket.send(JSON.stringify({ type: "event", data: { delivery: pending[0].delivery, backlog: pending.length - 1, gap_count: 0, last_gap_reason: null, retention_seconds: 86400, handler_timeout_seconds: 30 } }));
}
function policy() {
  return {
    agent_address: agent,
    org_policy: { rules: silenced ? [{ pattern: peer, effect: "silence", notify_since: null, notification_generation: null }] : [], allow_contact_requests: false, contact_request_since: null, contact_request_generation: null, version, updated_at: old },
    agent_policy: { rules: [], allow_contact_requests: null, contact_request_since: null, contact_request_generation: null, version: null, updated_at: null },
    effective_version: (silenced ? "b" : "a").repeat(64), effective_since: old,
    allow_contact_requests: false, contact_request_since: null, contact_request_generation: null,
  };
}
function memberships() {
  const rows = [{ agent_address: agent, contact_address: sentinelPeer, notify: true, notify_since: old, notification_generation: version, version }];
  if (muted) rows.push({ agent_address: agent, contact_address: peer, notify: false, notify_since: null, notification_generation: null, version });
  return rows.sort((left, right) => left.contact_address.localeCompare(right.contact_address));
}
const api = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    if (url.pathname === "/v1/agent-connections/claim") return json(response, { org_id: org, api_base_url: "https://api.primitive.dev/v1", api_key: credential, owner_address: "owner@sender.example", connection: { address: agent, owner_address: "owner@sender.example", status: "claimed" } });
    assert.equal(request.headers.authorization, `Bearer ${credential}`);
    if (request.method === "POST" && url.pathname === "/v1/endpoints") return json(response, { id: endpoint, name: body.name, kind: "pull", enabled: true, recipient: agent, rules: { event_types: ["email.received"] }, receiver_capabilities: { completion_modes: ["sdk"], stream_protocols: ["primitive.events.v1"] } });
    if (request.method === "PUT" && url.pathname === `/v1/contacts/${encodeURIComponent(peer)}`) {
      assert.deepEqual(body, { if_absent: true }, "Only address-only directory creation is authorized");
      directoryWrites++;
      directoryContact ??= { address: peer, display_name: null, version, created_at: old, updated_at: old };
      return json(response, directoryContact);
    }
    if (request.method === "POST" && url.pathname === "/v1/send-mail") {
      assert.equal(body.from, agent);
      assert.equal(body.to, peer);
      assert.equal(directoryContact?.address, peer, "Directory save must precede the request email");
      assert.match(request.headers["idempotency-key"], /^contact-/);
      const control = JSON.parse(Buffer.from(body.attachments[0].content_base64, "base64").toString());
      assert.equal(control.protocol, "primitive.contact");
      assert.equal(control.step, "request");
      const row = { id: randomUUID(), from: agent, to: peer, from_address: agent, from_header: agent, to_address: peer, to_header: peer, status: "delivered", delivery_status: "delivered", accepted: [peer], rejected: [], idempotent_replay: false, request_id: randomUUID(), queue_id: null, control };
      posts++;
      sends.set(row.id, row);
      return json(response, row);
    }
    if (url.pathname === "/v1/emails/search") {
      const parent = url.searchParams.get("reply_to_sent_email_id");
      assert.ok(sends.has(parent), "Recovery must select an exact sent parent");
      assert.equal(url.searchParams.get("from"), peer);
      assert.equal(url.searchParams.get("to"), agent);
      return json(response, [...emails.values()].filter((email) => email.reply_to_sent_email_id === parent), { cursor: null });
    }
    const attachment = url.pathname.match(/^\/v1\/emails\/([^/]+)\/attachments\/0$/);
    if (attachment) {
      assert.ok(parts.has(attachment[1]));
      response.setHeader("content-type", "application/json");
      return response.end(parts.get(attachment[1]));
    }
    const detail = url.pathname.match(/^\/v1\/emails\/([^/]+)$/);
    if (detail) { assert.ok(emails.has(detail[1])); return json(response, emails.get(detail[1])); }
    const sent = url.pathname.match(/^\/v1\/sent-emails\/([^/]+)$/);
    if (sent) { assert.ok(sends.has(sent[1])); return json(response, sends.get(sent[1])); }
    if (url.pathname === `/v1/agent-contact-policy/${encodeURIComponent(agent)}` && request.method === "GET") return json(response, policy());
    if (url.pathname === `/v1/agent-contacts/${encodeURIComponent(agent)}` && request.method === "GET")
      return json(response, memberships(), { cursor: null });
    throw new Error(`Unexpected fixture route ${request.method} ${url.pathname}`);
  } catch (error) {
    failures.push(error);
    response.statusCode = 500;
    json(response, {});
  }
});
const sockets = new WebSocketServer({ server: api });
sockets.on("connection", (socket) => {
  streamOpens++;
  activeStreams++;
  maximumStreams = Math.max(maximumStreams, activeStreams);
  socket.on("close", () => { activeStreams--; if (receiver === socket) receiver = undefined; });
  socket.on("message", (bytes) => {
    try {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === "authenticate") socket.send(JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }));
      else if (frame.type === "receive") { receiver = socket; dispatch(); }
      else if (frame.type === "complete") {
        assert.equal(frame.body.mode, "sdk");
        assert.equal(frame.body.accepted, true);
        assert.equal(frame.body.delivery_id, pending[0]?.delivery.delivery_id);
        completed.push(frame.body.delivery_id);
        pending.shift();
        socket.send(JSON.stringify({ type: "receipt", data: { result: "completed" } }));
      } else assert.equal(frame.type, "pong");
    } catch (error) { failures.push(error); socket.terminate(); }
  });
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const nativeHttp = createServer(), native = new WebSocketServer({ server: nativeHttp });
const socketPath = join(root, "native.sock");
await new Promise((done) => nativeHttp.listen(socketPath, done));
await chmod(socketPath, 0o600);
native.on("connection", (socket) => socket.on("message", (bytes) => {
  try {
    const frame = JSON.parse(bytes.toString());
    if (frame.id === undefined) return;
    let result;
    if (frame.method === "initialize") result = {};
    else if (frame.method === "thread/loaded/list") result = { data: [session], nextCursor: null };
    else if (frame.method === "thread/read") result = { thread: { id: session, cwd: root, canAcceptDirectInput: true } };
    else if (frame.method === "turn/start") {
      assert.deepEqual(Object.keys(frame.params).sort(), ["input", "threadId", "toolOutput"]);
      assert.deepEqual(frame.params.input, []);
      assert.equal(frame.params.threadId, session);
      assert.equal(frame.params.toolOutput.name, "mail_received");
      assert.equal(frame.params.toolOutput.namespace, "primitive");
      notices.push(frame.params.toolOutput.output);
      result = { turn: { id: randomUUID(), items: [], status: "inProgress" } };
    } else throw new Error(`Unexpected native method ${frame.method}`);
    socket.send(JSON.stringify({ id: frame.id, result }));
  } catch (error) { failures.push(error); socket.terminate(); }
}));
const base = `http://127.0.0.1:${api.address().port}`;
const preload = join(root, "local-boundaries.mjs");
await writeFile(preload, `const realFetch=globalThis.fetch;const RealSocket=globalThis.WebSocket;const base=${JSON.stringify(base)};function local(value){const u=new URL(value);if(u.hostname!=='api.primitive.dev')throw new Error('External network forbidden');return base+u.pathname+u.search;}globalThis.fetch=async(input,init)=>{const r=new Request(input,init);return realFetch(local(r.url),{method:r.method,headers:r.headers,body:r.body,signal:r.signal,duplex:'half',redirect:'error'});};globalThis.WebSocket=class extends RealSocket{constructor(url,protocol){super(local(url).replace('http:','ws:'),protocol);}};`, { mode: 0o600 });
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: config, XDG_CONFIG_HOME: config, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_COLOR: "1" };
for (const name of Object.keys(env)) if ((name.startsWith("PRIMITIVE_") && !["PRIMITIVE_CONFIG_DIR", "PRIMITIVE_SKIP_NEW_VERSION_CHECK"].includes(name)) || /proxy/i.test(name)) delete env[name];
// Keep the synthetic runtime identity consistent with the native session fixture.
env.CODEX_SESSION_ID = session;
env.CODEX_THREAD_ID = session;
delete env.CLAUDE_CODE_SESSION_ID;
function invoke(args, { profile = true, stdin = "" } = {}) {
  const child = spawn(process.execPath, ["--import", pathToFileURL(preload).href, binary, ...args], { cwd: root, env: { ...env, ...(profile ? { PRIMITIVE_AGENT_PROFILE: "smoke" } : {}) }, stdio: ["pipe", "pipe", "pipe"] });
  const run = { child, stdout: "", stderr: "", result: null };
  child.stdout.on("data", (bytes) => { run.stdout += bytes; });
  child.stderr.on("data", (bytes) => { run.stderr += bytes; });
  child.stdin.end(stdin);
  run.closed = new Promise((done, reject) => { child.once("error", reject); child.once("close", (code) => { run.result = { code }; done(); }); });
  children.push(run);
  return run;
}
async function until(check, label) {
  const deadline = Date.now() + 15_000;
  while (!(await check())) {
    if (failures.length) throw failures[0];
    if (Date.now() >= deadline) throw new Error(`${label}: ${children.map((run) => run.stderr).join("\n")}`);
    await new Promise((done) => setTimeout(done, 20));
  }
}
async function command(args, code = 0, options) {
  const run = invoke(args, options);
  await until(() => run.result, `${args.slice(0, 2).join(" ")} must finish`);
  assert.equal(run.result.code, code, run.stderr);
  assert.ok(!run.stdout.includes(credential) && !run.stderr.includes(credential));
  return JSON.parse(run.stdout);
}
async function start() {
  const previous = streamOpens;
  listener = invoke(["listen", "--contacts", "--contact-requests", "--notify-session", session, "--session-socket", socketPath]);
  await until(() => streamOpens > previous, "The listener must join its saved profile subscription");
}
async function stop() {
  listener.child.kill("SIGTERM");
  await until(() => listener.result, "The listener must stop");
  assert.equal(listener.result.code, 130, listener.stderr);
  await until(() => activeStreams === 0, "The listener must release the shared subscription");
}
async function deliver(...messages) {
  const count = completed.length + messages.length;
  pending.push(...messages);
  dispatch();
  await until(() => completed.length === count, "Every pushed delivery must be acknowledged");
}
const matching = (id) => notices.filter((text) => text.includes(id));
async function sentinel(suffix) {
  const message = inbound(null, null, `ffffffff-ffff-4fff-bfff-fffffffffff${suffix}`, sentinelPeer);
  await deliver(message);
  await until(() => matching(message.detail.id).length === 1, "A later journal entry must prove receiver progress");
}
try {
  await command(["agent", "connect", "--profile", "smoke", "--json"], 0, { profile: false, stdin: JSON.stringify({ token: ["inert", "invite", "x".repeat(48)].join("_") }) });
  // This fixture starts after a successful session verification. Preserve the
  // same binding that setup would save before testing late contact notices.
  const profileDirectory = join(config, "agent-connections", "profiles", "smoke");
  const savedProfile = JSON.parse(await readFile(join(profileDirectory, "connection.json"), "utf8"));
  await writeFile(join(profileDirectory, "setup.json"), JSON.stringify({
    version: 1,
    session,
    receiverMode: "native",
    invitationHash: savedProfile.invitation_hash,
    since: new Date().toISOString(),
    contactRequests: true,
    challenge: { id: randomUUID(), messageId: `<${randomUUID()}@sender.example>`, marker: `primitive-connection:${randomUUID()}:1` },
    phase: "sent",
    receipt: { id: randomUUID(), status: "delivered" },
  }), { mode: 0o600, flag: "wx" });
  await start();
  const originalMemberships = structuredClone(memberships());
  const request = await command(["contacts", "request", peer, "--reason", "Public coordination", "--wait", "--timeout", "1"], 3);
  assert.equal(request.outcome, "sent_awaiting_reply");
  assert.equal(request.contact_accepted, false);
  assert.equal(posts, 1);
  assert.equal(directoryWrites, 1);
  assert.equal(directoryContact.address, peer);
  assert.deepEqual(memberships(), originalMemberships, "Requesting a conversation must leave memberships unchanged");
  directoryContact.display_name = "Existing owner label";
  const control = sends.get(request.sent_id).control;
  const forged = [
    inbound({ ...acceptance(control), prev_step_id: randomUUID() }, request.sent_id, "11111111-1111-4111-8111-111111111111"),
    inbound({ ...acceptance(control), interaction_id: `${randomUUID()}@sender.example` }, request.sent_id, "22222222-2222-4222-8222-222222222222"),
    inbound(acceptance(control), randomUUID(), "33333333-3333-4333-8333-333333333333"),
  ];
  const accepted = inbound(acceptance(control), request.sent_id, "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee");
  await deliver(...forged, accepted);
  await until(() => matching(accepted.detail.id).length === 1, "The exact late acceptance must notify its originating session");
  for (const message of forged) assert.equal(matching(message.detail.id).length, 0, "Forged correlation must not notify");
  assert.equal(notices.length, 1);
  assert.ok(notices[0].includes(peer));
  assert.ok(!notices[0].includes(accepted.detail.body_text));
  assert.ok(!notices[0].includes(parts.get(accepted.detail.id).toString()));
  assert.ok(!notices[0].includes(control.interaction_id));
  await until(async () => (await command(["listen", "--status", "--notify-session", session])).receipts.some((row) => row.emailId === accepted.detail.id && row.state === "accepted"), "Native acceptance must be durable before resume");
  const resumed = await command(["contacts", "wait", "--id", request.sent_id, "--timeout", "5"]);
  assert.equal(resumed.contact_accepted, true);
  assert.equal(resumed.acceptance_email_id, accepted.detail.id);
  assert.equal((await command(["contacts", "wait", "--id", request.sent_id, "--timeout", "1"])).contact_accepted, true);
  assert.equal(posts, 1, "Resume and repeated wait must not resend");
  assert.equal(directoryWrites, 1, "Resume and repeated wait must not write contacts");
  assert.equal(matching(accepted.detail.id).length, 1, "Explicit recovery must not repeat the native notice");
  await stop();
  await start();
  await deliver({ ...accepted, delivery: { ...accepted.delivery, event_id: randomUUID(), delivery_id: randomUUID(), lease_token: randomUUID() } });
  await sentinel("1");
  assert.equal(matching(accepted.detail.id).length, 1, "Restart and redelivery must not repeat the notice");

  const second = await command(["contacts", "request", peer, "--reason", "Independent permission boundary", "--wait", "--timeout", "1"], 3);
  assert.equal(posts, 2);
  assert.equal(directoryWrites, 2);
  assert.equal(directoryContact.display_name, "Existing owner label", "Address-only creation preserves labels");
  assert.deepEqual(memberships(), originalMemberships, "A second request must not enable or mute this peer");
  await stop();
  muted = true;
  await start();
  const mutedReply = inbound(acceptance(sends.get(second.sent_id).control), second.sent_id, "44444444-4444-4444-8444-444444444444");
  await deliver(mutedReply);
  await sentinel("2");
  assert.equal(matching(mutedReply.detail.id).length, 0, "Explicit notify:false must suppress even exact acceptance");
  await stop();
  muted = false;
  silenced = true;
  await start();
  const silentReply = inbound(acceptance(sends.get(second.sent_id).control), second.sent_id, "55555555-5555-4555-8555-555555555555");
  await deliver(silentReply);
  await sentinel("3");
  assert.equal(matching(silentReply.detail.id).length, 0, "Owner silence must suppress even exact acceptance");
  for (const message of forged) assert.equal(matching(message.detail.id).length, 0);
  assert.equal(notices.length, 4, "Only exact acceptance and three independent sentinels may notify");
  assert.equal(posts, 2, "Only the two explicitly requested contact sends may occur");
  assert.equal(directoryWrites, 2, "Late notices and recovery must not create extra directory writes");
  assert.equal(maximumStreams, 1, "Waits and notifications must share one stream owner");
  assert.deepEqual(failures, []);
  console.log("Late contact notice smoke passed: timed-out request, exact metadata notice, explicit recovery, restart dedupe, forged correlation and silence boundaries. Local fixtures only.");
} finally {
  for (const run of children) if (run.result === null) run.child.kill("SIGTERM");
  await Promise.race([Promise.allSettled(children.map((run) => run.closed)), new Promise((done) => setTimeout(done, 2000))]);
  for (const run of children) if (run.result === null) run.child.kill("SIGKILL");
  await Promise.allSettled(children.map((run) => run.closed));
  for (const socket of sockets.clients) socket.terminate();
  for (const socket of native.clients) socket.terminate();
  await new Promise((done) => sockets.close(done));
  await new Promise((done) => native.close(done));
  await new Promise((done) => nativeHttp.close(done));
  api.closeAllConnections();
  await new Promise((done) => api.close(done));
  await rm(root, { recursive: true, force: true });
}
