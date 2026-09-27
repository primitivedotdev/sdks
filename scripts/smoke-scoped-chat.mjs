import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Built or installed CLI, local fixture only. No credentials or real mail.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-scoped-chat-"));
const owner = "agent@sender.example";
const peer = "help@agent.example";
const emails = new Map();
const requests = [];
const failures = [];
let sent;
let candidates = [];
let posts = 0;
let ready = true;
function json(response, data, cursor = null) {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data, meta: { cursor } }));
}
function inbound(overrides = {}) {
  return { id: randomUUID(), sender: peer, from_email: peer, from_header: `Helper <${peer}>`,
    recipient: owner, to_email: owner, status: "accepted", domain: "sender.example", webhook_attempt_count: 0,
    message_id: `<${randomUUID()}@agent.example>`, created_at: new Date().toISOString(), received_at: new Date().toISOString(),
    body_text: "The answer", body_html: null, replies: [], reply_to_sent_email_id: sent.id,
    parsed: { status: "complete", attachments: [] },
    auth: { spf: "pass", dmarc: "pass", dmarcFromDomain: "agent.example", dmarcSpfAligned: true, dmarcDkimAligned: true, dkimSignatures: [] },
    ...overrides };
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    requests.push(`${request.method} ${url.pathname}`);
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const input = raw ? JSON.parse(raw) : null;
    if (request.method === "POST" && (url.pathname === "/v1/send-mail" || /^\/v1\/emails\/[^/]+\/reply$/.test(url.pathname))) {
      posts++;
      assert.equal(input.from, owner);
      const replay = input.body_text === "server replay";
      if (!replay) {
        sent = { id: randomUUID(), from: owner, to: peer, status: "delivered", delivery_status: "delivered", accepted: [peer], rejected: [], idempotent_replay: false };
        ready = input.body_text !== "wait only";
        const progress = inbound({ body_text: "I am working on your message.", parsed: { status: "complete", attachments: [{ filename: "interaction.json", content_type: "application/json", size_bytes: 10 }] } });
        const unrelated = inbound({ reply_to_sent_email_id: randomUUID() });
        const spoof = inbound({ from_header: "attacker@agent.example" });
        const wrongDomain = inbound({ auth: { ...progress.auth, dmarcFromDomain: "other.example" } });
        const wrongRecipient = inbound({ recipient: "someone@sender.example" });
        const answer = inbound();
        candidates = [progress, unrelated, spoof, wrongDomain, wrongRecipient, answer];
        for (const email of candidates) emails.set(email.id, email);
      }
      json(response, { ...sent, idempotent_replay: replay });
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/emails") {
      if (url.searchParams.get("cursor") === "second") json(response, ready ? candidates.slice(-1) : []);
      else json(response, candidates.slice(0, -1), "second");
      return;
    }
    if (request.method === "GET" && /^\/v1\/emails\/[^/]+$/.test(url.pathname)) {
      const email = emails.get(url.pathname.split("/")[3]);
      assert.ok(email);
      json(response, email);
      return;
    }
    throw new Error(`Forbidden or unexpected request: ${request.method} ${url.pathname}`);
  } catch (error) {
    failures.push(error);
    response.statusCode = 500;
    response.end(JSON.stringify({ success: false, error: { code: "fixture_failure", message: "Unexpected request" } }));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}/v1`;
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: directory, XDG_CONFIG_HOME: directory,
  PRIMITIVE_API_KEY: ["pconn", "fixture"].join("_"), PRIMITIVE_API_BASE_URL: base,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" };
for (const name of ["PRIMITIVE_API_HEADERS", "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[name];
async function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
const flags = ["--json", "--timeout", "2", "--interval", "1"];
try {
  const bare = await run(["chat"]);
  assert.notEqual(bare.code, 0);
  assert.equal(requests.length, 0);
  const missing = await run(["chat", peer, "hello", ...flags]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /must pass --from/);
  assert.equal(requests.length, 0);
  for (const args of [
    ["chat", peer, "hello", "--from", owner, ...flags],
    ["chat", "reply", "follow up", ...flags],
    ["chat", peer, "--reply", "latest parent", "--from", owner, ...flags],
    ["chat", peer, "server replay", "--from", owner, ...flags],
  ]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.reply.id, candidates.at(-1).id);
    assert.equal(output.match.strategy, "strict");
    assert.ok(output.follow_up_commands.every((command) => !command.command.includes("emails wait")));
  }
  const waitingArgs = ["chat", peer, "wait only", "--from", owner, ...flags];
  const waiting = await run(waitingArgs);
  assert.equal(waiting.code, 3, waiting.stderr);
  assert.equal(JSON.parse(waiting.stdout).outcome, "sent_awaiting_reply");
  assert.match(waiting.stderr, /needs inspection/);
  const before = posts;
  ready = true;
  const resumed = await run(waitingArgs);
  assert.equal(resumed.code, 0, resumed.stderr);
  assert.equal(posts, before, "Retry must resume the existing send");
  assert.deepEqual(failures, []);
  console.log("Scoped chat built CLI smoke passed: sender guard, chat, reply, replay, progress, timeout and resume.");
} finally {
  await new Promise((done) => server.close(done));
  await rm(directory, { recursive: true, force: true });
}
