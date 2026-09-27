import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Built or installed CLI, local fixture only. No credentials or real mail.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-scoped-wait-"));
const owner = "agent@sender.example", peer = "help@agent.example", sentId = randomUUID();
const requests = [], failures = [];
let progress = false, stall = "";
const reply = { id: randomUUID(), sender: peer, from_email: peer, from_header: `Helper <${peer}>`,
  recipient: owner, to_email: owner, status: "accepted", domain: "sender.example", webhook_attempt_count: 0,
  message_id: `<${randomUUID()}@agent.example>`, created_at: "2026-01-01T00:00:00Z", received_at: "2026-01-01T00:00:00Z",
  body_text: "The answer", body_html: null, subject: "Answer", replies: [], reply_to_sent_email_id: sentId,
  parsed: { status: "complete", attachments: [] },
  auth: { spf: "pass", dmarc: "pass", dmarcFromDomain: "agent.example", dmarcSpfAligned: true, dmarcDkimAligned: true, dkimSignatures: [] } };
function json(response, data, cursor = null) {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data, meta: { cursor } }));
}
const server = createServer((request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    requests.push(`${request.method} ${url.pathname}`);
    assert.equal(request.method, "GET", "Wait must not send mail");
    if (url.pathname === stall) return;
    if (url.pathname === `/v1/sent-emails/${sentId}`) {
      json(response, { id: sentId, from_address: owner, from_header: `Agent <${owner}>`, to_address: peer });
    } else if (url.pathname === "/v1/emails") {
      json(response, !url.searchParams.has("date_from") || Date.parse(reply.created_at) >= Date.parse(url.searchParams.get("date_from")) ? [reply] : []);
    } else if (url.pathname === `/v1/emails/${reply.id}`) {
      json(response, progress ? { ...reply, parsed: { status: "complete", attachments: [{ filename: "interaction.json", size_bytes: 10 }] } } : reply);
    } else throw new Error(`Forbidden request: ${url.pathname}`);
  } catch (error) {
    failures.push(error);
    response.statusCode = 500;
    json(response, null);
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: directory, XDG_CONFIG_HOME: directory,
  PRIMITIVE_API_KEY: ["pconn", "fixture"].join("_"), PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${server.address().port}/v1`,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" };
for (const name of ["PRIMITIVE_API_HEADERS", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[name];
async function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
const args = ["emails", "wait", "--reply-to-sent-email-id", sentId, "--from", peer, "--timeout", "1", "--interval", "1"];
try {
  const parent = await run(["emails"]);
  assert.equal(parent.code, 0, parent.stderr);
  assert.match(parent.stdout + parent.stderr, /emails wait/);
  const help = await run(["emails", "wait", "--help"]);
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /Existing replies are included by default/);
  const bare = await run(["emails", "wait"]);
  assert.equal(bare.code, 1);
  assert.match(bare.stderr, /require --reply-to-sent-email-id/);
  assert.equal(requests.length, 0);
  for (const flags of [[], ["--to", owner], ["--table"]]) {
    const result = await run([...args, ...flags]);
    assert.equal(result.code, 0, result.stderr);
    if (flags.includes("--table")) assert.match(result.stdout, new RegExp(reply.id));
    else assert.equal(JSON.parse(result.stdout).id, reply.id);
  }
  const since = await run([...args, "--since", "2026-02-01"]);
  assert.equal(since.code, 1, since.stderr);
  assert.equal(since.stdout, "");
  assert.match(since.stderr, /Timed out/);
  reply.received_at = "2026-02-01T00:00:00Z";
  const receivedLater = await run([...args, "--since", "2026-02-01"]);
  assert.equal(receivedLater.code, 0, receivedLater.stderr);
  assert.equal(JSON.parse(receivedLater.stdout).id, reply.id);
  progress = true;
  const pending = await run(args);
  assert.equal(pending.code, 1, pending.stderr);
  assert.equal(pending.stdout, "");
  assert.match(pending.stderr, /needs inspection/);
  progress = false;
  const recovered = await run(args);
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal(JSON.parse(recovered.stdout).id, reply.id);
  for (const path of [`/v1/sent-emails/${sentId}`, "/v1/emails", `/v1/emails/${reply.id}`]) {
    stall = path;
    const start = Date.now();
    const timed = await run(args);
    assert.equal(timed.code, 1, timed.stderr);
    assert.match(timed.stderr, /Timed out/);
    assert.doesNotMatch(timed.stderr, /AbortError/);
    assert.ok(Date.now() - start < 5_000, "A stalled read must honor the wait deadline");
  }
  assert.deepEqual(failures, []);
  console.log("Scoped emails wait built CLI smoke passed: help, exact parent, fast reply, filters, progress, recovery and stalled reads.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(directory, { recursive: true, force: true });
}
