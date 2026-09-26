import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Exercise the installed CLI's send/reply outcome reporting against a local
// HTTP fixture: exit codes, stdout compatibility, stderr summaries, the
// idempotent-replay notice and the prior-reply warning.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-send-outcomes-smoke-"));
const config = join(directory, "config");
const fixtureErrors = [];
const requests = [];
// Per-test knobs the fixture reads.
const fixture = { inbound: null, inboundStatus: 200, sendStatus: 200, replayed: false };

function sentRecord(to) {
  return {
    id: "sent-smoke-1", from: "agent@example.test", status: fixture.replayed ? "delivered" : "queued",
    ...(fixture.replayed ? { delivery_status: "delivered" } : {}),
    idempotent_replay: fixture.replayed, accepted: [to], rejected: [], request_id: "req-smoke",
    queue_id: null, content_hash: "fixture-content", client_idempotency_key: "fixture-key",
  };
}
function respond(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const input = raw ? JSON.parse(raw) : null;
    requests.push({ method: request.method, path: url.pathname, input });
    if (request.method === "GET" && url.pathname === "/v1/emails/inbound-1") {
      if (fixture.inboundStatus !== 200) {
        respond(response, fixture.inboundStatus, { success: false, error: { code: "internal_error", message: "Lookup failed" } });
        return;
      }
      respond(response, 200, { success: true, data: fixture.inbound });
      return;
    }
    if (request.method === "POST" && (url.pathname === "/v1/send-mail" || url.pathname === "/v1/emails/inbound-1/reply")) {
      if (fixture.sendStatus !== 200) {
        const code = fixture.sendStatus === 422 ? "validation_error" : "internal_error";
        respond(response, fixture.sendStatus, { success: false, error: { code, message: `Fixture ${fixture.sendStatus}` } });
        return;
      }
      respond(response, 200, { success: true, data: sentRecord(input.to ?? "alice@example.test") });
      return;
    }
    throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
  } catch (error) {
    fixtureErrors.push(error);
    respond(response, 500, { success: false, error: { code: "fixture_failure", message: "Unexpected fixture request" } });
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}/v1`;
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: config, XDG_CONFIG_HOME: config,
  PRIMITIVE_API_KEY: ["prim", "fixture"].join("_"), PRIMITIVE_API_BASE_URL: base,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" };
delete env.PRIMITIVE_API_HEADERS;
for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[name];
function cli(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args, "--api-base-url", base], { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
function reset(overrides = {}) {
  Object.assign(fixture, { inbound: { id: "inbound-1", replies: [] }, inboundStatus: 200, sendStatus: 200, replayed: false }, overrides);
  requests.length = 0;
}
const replyArgs = ["reply", "--id", "inbound-1", "--body", "Thanks, got it."];
const sendArgs = ["send", "--to", "alice@example.test", "--from", "agent@example.test", "--body", "Hello"];
const posts = () => requests.filter((entry) => entry.method === "POST").length;
try {
  reset();
  let result = await cli(replyArgs);
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), sentRecord("alice@example.test"), "reply stdout must stay the plain send record");
  assert.equal(result.stderr, "Reply sent (queued for delivery, id sent-smoke-1). Do not resend.\n");

  reset({ inbound: { id: "inbound-1", replies: [
    { id: "sent-denied", status: "gate_denied", to_address: "alice@example.test", created_at: "2026-09-01T10:00:00.000Z" },
    { id: "sent-prior", status: "delivered", to_address: "alice@example.test", created_at: "2026-09-01T11:00:00.000Z" },
  ] } });
  result = await cli([...replyArgs, "--json"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /You already replied to this email at 2026-09-01T11:00:00\.000Z \(sent id sent-prior\)\. Sending another reply\./);
  assert.equal(posts(), 1, "The prior-reply warning must not block the send");
  let envelope = JSON.parse(result.stdout);
  assert.equal(envelope.outcome, "sent");
  assert.deepEqual(envelope.prior_replies.map((entry) => entry.id), ["sent-prior"]);

  reset({ inboundStatus: 503 });
  result = await cli([...replyArgs, "--json"]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stderr, /Could not check whether you already replied to email inbound-1 \(the email lookup returned HTTP 503\)\. Prior-reply check skipped; sending the reply anyway\./);
  assert.equal(posts(), 1, "A failed prior-reply lookup must not block the send");
  envelope = JSON.parse(result.stdout);
  assert.equal(envelope.prior_replies, null);
  assert.deepEqual(envelope.prior_replies_check, { status: "skipped", reason: "the email lookup returned HTTP 503" });

  reset({ replayed: true });
  result = await cli(replyArgs);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "Already sent: this exact message went out earlier (sent id sent-smoke-1, status delivered). Nothing new was sent.\n");
  result = await cli([...sendArgs, "--json"]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).outcome, "already_sent");
  assert.doesNotMatch(result.stderr, /vary|fresh copy|Idempotency-Key/i);

  reset({ sendStatus: 422 });
  result = await cli([...sendArgs, "--json"]);
  assert.equal(result.code, 1);
  envelope = JSON.parse(result.stdout);
  assert.equal(envelope.outcome, "not_sent");
  assert.equal(envelope.http_status, 422);

  reset({ sendStatus: 503 });
  result = await cli(replyArgs);
  assert.equal(result.code, 4);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Reply send outcome uncertain \(HTTP 503\): it may or may not have gone out\./);
  result = await cli([...sendArgs, "--json"]);
  assert.equal(result.code, 4);
  envelope = JSON.parse(result.stdout);
  assert.equal(envelope.outcome, "uncertain");
  assert.equal(envelope.follow_up_commands[0].kind, "list_recent_sent_emails");

  reset();
  result = await cli(sendArgs);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "Message sent (queued for delivery, id sent-smoke-1). Do not resend.\n");

  assert.deepEqual(fixtureErrors, []);
  console.log("Send outcomes: reply/send exit codes, byte-compatible stdout, stderr summaries, replay notice and prior-reply warnings passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(directory, { recursive: true, force: true });
}
