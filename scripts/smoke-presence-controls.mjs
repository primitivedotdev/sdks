import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { parseWebhookEvent } from "../sdk-node/dist/webhook/index.js";
import { preparePresenceProbeEmail } from "../sdk-node/dist/interactions/index.js";

// Exercise the built CLI with its real hook, receiver, durable journal and SDK
// boundaries. API requests go only to this local fixture server.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp("/tmp/primitive-presence-smoke-");
await chmod(directory, 0o700);
const configDir = join(directory, "config");
const session = randomUUID();
const address = "agent@example.com", owner = "sender@example.com";
const profileName = `session-${session}`;
const profileDir = join(configDir, "agent-connections", "profiles", profileName);
await mkdir(profileDir, { recursive: true, mode: 0o700 });
const profile = {
  version: 1, auth_method: "agent_connection", api_key: ["pconn", "localfixture"].join("_"),
  api_base_url: "https://api.primitive.dev/v1", org_id: randomUUID(),
  agent_address: address, owner_address: owner, invitation_hash: "a".repeat(64),
  created_at: new Date().toISOString(), presence_profile: {
    protocol: "primitive.presence", version: 1,
    authentication_profile: "primitive-issued-v1", return_address: owner,
  },
};
await writeFile(join(profileDir, "connection.json"), JSON.stringify(profile), { mode: 0o600 });
await writeFile(join(profileDir, "setup.json"), JSON.stringify({
  session, phase: "sent", receiverMode: "external", invitationHash: profile.invitation_hash,
  receipt: { status: "queued" },
}), { mode: 0o600 });
const template = JSON.parse(await readFile(new URL("../test-fixtures/webhook/valid-email-received.json", import.meta.url), "utf8"));
const messages = new Map(), queue = [], sends = [], reads = [], completions = [];
function message(control, bytes, text = "Ordinary user task.") {
  const event = structuredClone(template), id = randomUUID();
  event.email.id = id;
  event.email.smtp.rcpt_to = [address];
  event.email.headers.from = owner;
  event.email.received_at = new Date().toISOString();
  event.email.auth.dmarc = "pass";
  event.email.auth.dmarcFromDomain = "example.com";
  event.email.auth.dmarcDkimAligned = true;
  event.email.auth.spf = "pass";
  event.email.parsed.body_text = text;
  event.email.parsed.body_html = null;
  event.email.parsed.attachments = bytes ? [{
    filename: "interaction.json", content_type: "application/json", part_index: 0, tar_path: "attachments/interaction.json",
    size_bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
  }] : [];
  const detail = {
    id, recipient: address, to_email: address, from_email: owner, from_header: owner,
    message_id: `<${id}@example.com>`, status: "completed", received_at: event.email.received_at,
    parsed: { ...event.email.parsed, status: "complete", references: [] },
    body_text: text, body_html: null, auth: event.email.auth,
    reply_to_sent_email_id: null, thread_id: null,
    ...(control ? { presence_control: control } : {}),
  };
  parseWebhookEvent(event, "email.received");
  messages.set(id, { detail, bytes });
  queue.push({ event, eventId: randomUUID() });
  return id;
}
function probe(control = { status: "verified", valid_for_ms: 300_000 }) {
  const prepared = preparePresenceProbeEmail({ accountScope: "fixture", from: owner, to: address }, {
    uuid: randomUUID, nonce: () => "a".repeat(32), now: Date.now,
  });
  assert.equal(prepared.status, "prepared");
  const request = JSON.parse(prepared.prepared.requestJson);
  return message(control, Buffer.from(request.attachments[0].content_base64, "base64"), request.body_text);
}
const endpoint = randomUUID(), version = randomUUID();
const before = new Date(Date.now() - 60_000).toISOString();
const policyDocument = (allow) => ({ rules: [], allow_contact_requests: allow,
  contact_request_since: null, contact_request_generation: null, version, updated_at: before });
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const body = raw ? JSON.parse(raw) : null;
  const url = new URL(request.url, "http://fixture");
  reads.push(url.pathname);
  let data, meta;
  if (url.pathname === "/v1/endpoints") data = { id: endpoint, kind: "pull", enabled: true, recipient: address };
  else if (url.pathname.endsWith("/pull")) {
    const item = queue.shift();
    if (!item) await new Promise((resolve) => setTimeout(resolve, 40));
    data = { delivery: item ? {
      queue_id: randomUUID(), event_id: item.eventId, delivery_id: randomUUID(), event_type: "email.received",
      lease_token: randomUUID(), lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      body: JSON.stringify(item.event), headers: {},
    } : null, gap_count: 0, last_gap_reason: null, backlog: queue.length, retention_seconds: 86400, handler_timeout_seconds: 30 };
  } else if (url.pathname.endsWith("/complete")) { completions.push(body); data = { result: "completed" }; }
  else if (/^\/v1\/emails\/[^/]+\/attachments\/0$/.test(url.pathname)) {
    response.end(messages.get(url.pathname.split("/")[3])?.bytes); return;
  } else if (/^\/v1\/emails\/[^/]+$/.test(url.pathname)) data = messages.get(url.pathname.split("/")[3])?.detail;
  else if (url.pathname === "/v1/send-mail") {
    sends.push({ body, key: request.headers["idempotency-key"] });
    data = { id: randomUUID(), status: "queued", idempotent_replay: false };
  } else if (url.pathname.startsWith("/v1/agent-contact-policy/")) data = {
    agent_address: address, org_policy: policyDocument(false), agent_policy: policyDocument(null),
    effective_version: "a".repeat(64), effective_since: before, allow_contact_requests: false,
    contact_request_since: null, contact_request_generation: null,
  };
  else if (url.pathname.startsWith("/v1/agent-contacts/")) {
    data = [{ agent_address: address, contact_address: owner, notify: true, version,
      notification_generation: version, notify_since: before }];
    meta = { cursor: null };
  } else { response.statusCode = 404; }
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify({ success: response.statusCode === 200, data, ...(meta ? { meta } : {}) }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const preload = join(directory, "fixture-fetch.mjs");
await writeFile(preload, `const original=globalThis.fetch; globalThis.fetch=(input,init)=>{
  const request=new Request(input,init), url=new URL(request.url);
  if(url.origin!=="https://api.primitive.dev") throw new Error("Unexpected fixture origin");
  return original(new Request("http://127.0.0.1:${server.address().port}"+url.pathname+url.search,request));
};`);
const children = [];
function listen() {
  const env = { ...process.env, PRIMITIVE_CONFIG_DIR: configDir, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" };
  for (const key of ["PRIMITIVE_API_KEY", "PRIMITIVE_API_BASE_URL", "PRIMITIVE_API_HEADERS", "PRIMITIVE_AGENT_PROFILE", "NODE_OPTIONS"]) delete env[key];
  const child = spawn(process.execPath, ["--import", preload, binary, "listen", "--once", "--wake", "--hook-session", "--events", "email.received", "--transport", "poll", "--timeout", "8"], { env, stdio: ["pipe", "pipe", "pipe"] });
  children.push(child);
  let stderr = "", stdout = "";
  child.stderr.on("data", (bytes) => { stderr += bytes; });
  child.stdout.on("data", (bytes) => { stdout += bytes; });
  child.stdin.end(JSON.stringify({ hook_event_name: "Stop", session_id: session }));
  const done = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve({ code, stderr, stdout }));
  });
  return { child, done, stderr: () => stderr };
}
async function waitFor(check, description) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  assert.fail(typeof description === "function" ? description() : description);
}
try {
  const probeId = probe(), first = listen();
  await waitFor(() => sends.length === 1 && completions.length === 1, () => `Probe was not answered: ${first.stderr()} Reads: ${reads.join(",")} Sends: ${sends.length} Completions: ${completions.length}`);
  assert.equal(first.child.exitCode, null, "Presence must not finish the hook's --once");
  assert.ok(!first.stderr().includes("Primitive mail arrived"));
  assert.equal(sends[0].body.from, address);
  assert.equal(sends[0].body.to, owner);
  assert.equal(sends[0].body.in_reply_to, `<${probeId}@example.com>`);
  assert.ok(sends[0].key);
  const alive = JSON.parse(Buffer.from(sends[0].body.attachments[0].content_base64, "base64").toString("utf8"));
  assert.equal(alive.step, "alive");
  const taskId = message(), woke = await first.done;
  assert.equal(woke.code, 2, `${woke.stderr} Reads: ${reads.join(",")}`);
  assert.match(woke.stderr, new RegExp(`Primitive mail arrived: ${taskId}`));

  const pendingId = probe({ status: "pending", valid_for_ms: 0 }), second = listen();
  await waitFor(() => reads.includes(`/v1/emails/${pendingId}`), `Pending was not read: ${second.stderr()}`);
  assert.equal(second.child.exitCode, null);
  const aliveId = message({ status: "verified", valid_for_ms: 300_000 }, Buffer.from(JSON.stringify(alive)), "This receiver answered the presence check.");
  const expiredId = probe({ status: "verified", valid_for_ms: 0 });
  await waitFor(() => reads.includes(`/v1/emails/${aliveId}`) && reads.includes(`/v1/emails/${expiredId}`), "Control followups were not inspected");
  assert.equal(sends.length, 1, "Alive and expired controls cannot create reply loops");
  const secondTask = message(), next = await second.done;
  assert.equal(next.code, 2, next.stderr);
  assert.match(next.stderr, new RegExp(`Primitive mail arrived: ${secondTask}`));
  assert.equal(sends.length, 1, "Pending control cannot create an unverified reply");
  console.log("Built Claude receiver presence passes deterministic reply, pending isolation, expiry, ACK-loop and ordinary wake checks.");
} finally {
  for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
