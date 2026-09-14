import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Exercise separate installed CLI processes against a local HTTP fixture.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-chat-smoke-"));
const config = join(directory, "config");
const owner = "owner@example.test";
const children = new Set();
const emails = new Map();
const sends = new Map();
const fixtureErrors = [];
let phase;
function beginPhase(expectedPosts, manual = false, repliesReady = true) {
  assert.ok(!phase || phase.released, "The preceding fixture phase must finish");
  let release;
  const gate = new Promise((done) => { release = done; });
  phase = {
    expectedPosts, manual, repliesReady, posts: [], released: false, gate,
    release() { this.released = true; release(); },
  };
  return phase;
}
function json(response, data) {
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data, meta: { cursor: null } }));
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const input = raw ? JSON.parse(raw) : null;
    if (request.method === "POST" && phase?.rejectNext) {
      phase.rejectNext = false;
      response.statusCode = 401;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ success: false, error: { code: "unauthorized", message: "Rejected authentication" } }));
      return;
    }
    if (request.method === "POST" && (url.pathname === "/v1/send-mail" || /^\/v1\/emails\/[^/]+\/reply$/.test(url.pathname))) {
      assert.ok(phase, "Unexpected send outside a test phase");
      const current = phase;
      const parent = url.pathname === "/v1/send-mail" ? null : emails.get(decodeURIComponent(url.pathname.split("/")[3]));
      assert.ok(url.pathname === "/v1/send-mail" || parent, "Reply must reference a stored inbound email");
      assert.equal(input.from, owner);
      const recipient = parent?.from_email ?? input.to;
      const sentId = randomUUID();
      const replyId = randomUUID();
      const now = current.replayed ? "2020-01-01T00:00:00.000Z" : new Date().toISOString();
      const thread = parent?.thread_id ?? randomUUID();
      const sent = { id: sentId, from: owner, to: recipient, status: "delivered", delivery_status: "delivered",
        idempotent_replay: current.replayed ?? false, accepted: [recipient], rejected: [], request_id: randomUUID(),
        queue_id: randomUUID(), content_hash: "fixture-content", message_id: `<${sentId}@example.test>` };
      const reply = { id: replyId, from_email: recipient, sender: recipient, to_email: owner, recipient: owner,
        subject: `Re: ${input.subject ?? parent?.subject ?? "Chat"}`, body_text: `Reply to ${input.body_text}`,
        body_html: null, status: "accepted", created_at: now, received_at: now, domain: "example.test",
        reply_to_sent_email_id: sentId, thread_id: thread, message_id: `<${replyId}@example.test>`, replies: [],
        parsed: { status: "complete", body_text: `Reply to ${input.body_text}`, body_html: null, attachments: [] } };
      sends.set(sentId, { sent, reply, phase: current });
      emails.set(replyId, reply);
      current.posts.push({ path: url.pathname, input, sent, reply });
      if (!current.manual && current.posts.length === current.expectedPosts) current.release();
      await current.gate;
      json(response, sent);
      return;
    }
    if (request.method === "GET" && url.pathname === "/v1/emails/search") {
      const sentId = url.searchParams.get("reply_to_sent_email_id");
      assert.ok(sentId, "Every reply search must remain strictly scoped to its own send");
      const record = sends.get(sentId);
      assert.ok(record, "Reply search must name a known send");
      if (record.sent.idempotent_replay) assert.equal(url.searchParams.has("date_from"), false, "Replay recovery must find replies older than the attempt receipt");
      json(response, record.phase.released && record.phase.repliesReady ? [record.reply] : []);
      return;
    }
    if (request.method === "GET" && /^\/v1\/emails\/[^/]+$/.test(url.pathname)) {
      const email = emails.get(decodeURIComponent(url.pathname.split("/")[3]));
      assert.ok(email, "Unknown inbound email");
      json(response, email);
      return;
    }
    throw new Error(`Unexpected fixture request: ${request.method} ${url.pathname}`);
  } catch (error) {
    fixtureErrors.push(error);
    response.statusCode = 500;
    response.end(JSON.stringify({ success: false, error: { code: "fixture_failure", message: "Unexpected fixture request" } }));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}/v1`;
const env = { ...process.env, PRIMITIVE_CONFIG_DIR: config, XDG_CONFIG_HOME: config,
  PRIMITIVE_API_KEY: ["prim", "fixture"].join("_"), PRIMITIVE_API_BASE_URL: base,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" };
delete env.PRIMITIVE_API_HEADERS;
for (const name of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"]) delete env[name];
function start(args) {
  const child = spawn(process.execPath, [binary, ...args], { cwd: directory, env, stdio: ["ignore", "pipe", "pipe"] });
  children.add(child);
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const result = new Promise((done, reject) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
    child.once("error", (error) => { clearTimeout(timer); children.delete(child); reject(error); });
    child.once("close", (code, signal) => { clearTimeout(timer); children.delete(child); done({ code, signal, stdout, stderr }); });
  });
  return { child, result };
}
const flags = ["--json", "--strict-only", "--timeout", "3", "--interval", "1", "--api-base-url", base];
const fresh = (address, message) => start(["chat", address, message, "--from", owner, ...flags]);
const reply = (id, message) => start(["chat", "reply", String(id), message, ...flags]);
async function waitForPosts(current, count) {
  const deadline = Date.now() + 10_000;
  while (current.posts.length < count && Date.now() < deadline) await new Promise((done) => setTimeout(done, 10));
  assert.equal(current.posts.length, count, "Expected concurrent POSTs did not reach the fixture");
}
async function waitForAcknowledgedReceipt(sentId) {
  const receiptDir = join(config, "chat-receipts");
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    for (const file of await readdir(receiptDir).catch(() => [])) {
      if (!file.endsWith(".json")) continue;
      const path = join(receiptDir, file);
      const receipt = JSON.parse(await readFile(path, "utf8"));
      if (receipt.sent?.id === sentId) {
        assert.equal(receipt.completed, false);
        if (process.platform !== "win32") assert.equal((await stat(path)).mode & 0o777, 0o600);
        return receipt;
      }
    }
    await new Promise((done) => setTimeout(done, 10));
  }
  assert.fail("The acknowledged send must be durably recorded before waiting");
}
function successful(result, current, message) {
  assert.deepEqual(fixtureErrors, []);
  assert.equal(result.code, 0, `${result.stdout}\n${result.stderr}`);
  const data = JSON.parse(result.stdout);
  const post = current.posts.find((entry) => entry.input.body_text === message);
  assert.ok(post, "Missing matching send");
  assert.equal(data.sent.id, post.sent.id);
  assert.equal(data.reply.id, post.reply.id);
  assert.equal(data.match.strategy, "strict");
  assert.equal(data.match.reply_to_sent_email_id, post.sent.id);
  assert.equal(data.response_body, post.reply.body_text);
  assert.ok(Number.isInteger(data.local_chat_id));
  return data;
}
const state = async () => JSON.parse(await readFile(join(config, "chat-state.json"), "utf8"));
try {
  const bare = await start(["chat"]).result;
  assert.notEqual(bare.code, 0, "Bare chat must explain missing input without sending");
  assert.match(`${bare.stdout}\n${bare.stderr}`, /recipient|message|usage|required/i);
  for (const args of [["chat", "--help"], ["chat", "reply", "--help"]]) {
    const result = await start(args).result;
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /chat/i);
  }
  assert.equal(sends.size, 0);

  const freshPhase = beginPhase(2);
  const a = fresh("alpha@example.test", "First alpha request");
  const b = fresh("beta@example.test", "First beta request");
  const results = await Promise.all([a.result, b.result]);
  assert.equal(freshPhase.posts.length, 2, "Both independent chats must send before either can finish");
  const first = successful(results[0], freshPhase, "First alpha request");
  const second = successful(results[1], freshPhase, "First beta request");
  assert.notEqual(first.local_chat_id, second.local_chat_id);
  const initial = await state();
  assert.equal(initial.conversations.length, 2, "Concurrent saves must preserve both rows");
  assert.deepEqual(new Set(initial.conversations.map((row) => row.recipient)), new Set(["alpha@example.test", "beta@example.test"]));
  assert.deepEqual(new Set(initial.conversations.map((row) => row.last_sent_email_id)), new Set(freshPhase.posts.map((post) => post.sent.id)));

  const distinct = beginPhase(2);
  const followups = await Promise.all([reply(first.local_chat_id, "Alpha follow-up").result, reply(second.local_chat_id, "Beta follow-up").result]);
  const nextFirst = successful(followups[0], distinct, "Alpha follow-up");
  const nextSecond = successful(followups[1], distinct, "Beta follow-up");
  assert.equal(nextFirst.local_chat_id, first.local_chat_id);
  assert.equal(nextSecond.local_chat_id, second.local_chat_id);
  assert.deepEqual(new Set(distinct.posts.map((post) => post.path)), new Set([`/v1/emails/${first.reply.id}/reply`, `/v1/emails/${second.reply.id}/reply`]));
  assert.equal((await state()).conversations.length, 2);

  const contended = beginPhase(1, true);
  const winner = reply(first.local_chat_id, "Single winner");
  await waitForPosts(contended, 1);
  const loser = await reply(first.local_chat_id, "Must not send").result;
  assert.notEqual(loser.code, 0, "A second writer to the same conversation must fail before sending");
  assert.match(`${loser.stdout}\n${loser.stderr}`, /busy|lock|already|progress/i);
  assert.equal(contended.posts.length, 1, "Contending replies must not issue a second POST");
  contended.release();
  const won = successful(await winner.result, contended, "Single winner");
  const finalState = await state();
  assert.equal(finalState.conversations.length, 2);
  assert.equal(finalState.conversations.find((row) => row.local_id === first.local_chat_id).last_reply_email_id, won.reply.id);
  assert.equal(finalState.conversations.find((row) => row.local_id === second.local_chat_id).last_reply_email_id, nextSecond.reply.id);
  const rejected = beginPhase(1);
  rejected.rejectNext = true;
  const rejectedArgs = ["zeta@example.test", "Retry the rejected request"];
  const rejectedResult = await fresh(...rejectedArgs).result;
  assert.notEqual(rejectedResult.code, 0);
  assert.equal(rejected.posts.length, 0, "Authentication rejection must not send");
  successful(await fresh(...rejectedArgs).result, rejected, rejectedArgs[1]);
  assert.equal(rejected.posts.length, 1, "An explicit rejection must permit a corrected retry");

  const timedOut = beginPhase(1, false, false);
  const timeoutArgs = ["gamma@example.test", "Resume after timeout"];
  const timeoutResult = await fresh(...timeoutArgs).result;
  assert.notEqual(timeoutResult.code, 0, "A missing reply must time out");
  assert.equal(timedOut.posts.length, 1);
  await waitForAcknowledgedReceipt(timedOut.posts[0].sent.id);
  timedOut.repliesReady = true;
  successful(await fresh(...timeoutArgs).result, timedOut, timeoutArgs[1]);
  assert.equal(timedOut.posts.length, 1, "Timeout retry must poll the acknowledged send without POSTing again");

  const replayed = beginPhase(1, false, false);
  replayed.replayed = true;
  const replayArgs = ["replay@example.test", "Recover existing replay"];
  assert.notEqual((await fresh(...replayArgs).result).code, 0);
  await waitForAcknowledgedReceipt(replayed.posts[0].sent.id);
  replayed.repliesReady = true;
  successful(await fresh(...replayArgs).result, replayed, replayArgs[1]);
  assert.equal(replayed.posts.length, 1, "Replay receipt recovery must not POST again");

  const interrupted = beginPhase(1, false, false);
  const interruptedArgs = ["delta@example.test", "Resume after interruption"];
  const interruptedChild = fresh(...interruptedArgs);
  await waitForPosts(interrupted, 1);
  await waitForAcknowledgedReceipt(interrupted.posts[0].sent.id);
  interruptedChild.child.kill("SIGKILL");
  const killed = await interruptedChild.result;
  assert.notEqual(killed.code, 0);
  interrupted.repliesReady = true;
  successful(await fresh(...interruptedArgs).result, interrupted, interruptedArgs[1]);
  assert.equal(interrupted.posts.length, 1, "Killed acknowledged sends must resume without another POST");

  const pendingReply = beginPhase(1, false, false);
  const pendingMessage = "Pending local follow-up";
  const pendingResult = await reply(first.local_chat_id, pendingMessage).result;
  assert.notEqual(pendingResult.code, 0);
  assert.equal(pendingReply.posts.length, 1);
  await waitForAcknowledgedReceipt(pendingReply.posts[0].sent.id);
  const replacement = await reply(first.local_chat_id, "Different body must not send").result;
  assert.notEqual(replacement.code, 0);
  assert.match(`${replacement.stdout}\n${replacement.stderr}`, /pending|unfinished|resume|different/i);
  assert.equal(pendingReply.posts.length, 1, "A pending local reply cannot be replaced with a different send");
  pendingReply.repliesReady = true;
  successful(await reply(first.local_chat_id, pendingMessage).result, pendingReply, pendingMessage);
  assert.equal(pendingReply.posts.length, 1);

  const unknown = beginPhase(1, true);
  const unknownArgs = ["epsilon@example.test", "Unacknowledged send"];
  const uncertainChild = fresh(...unknownArgs);
  await waitForPosts(unknown, 1);
  uncertainChild.child.kill("SIGKILL");
  assert.notEqual((await uncertainChild.result).code, 0);
  unknown.release();
  const uncertainRetry = await fresh(...unknownArgs).result;
  assert.notEqual(uncertainRetry.code, 0);
  assert.match(`${uncertainRetry.stdout}\n${uncertainRetry.stderr}`, /uncertain|unknown|acknowledg|reconcil/i);
  assert.equal(unknown.posts.length, 1, "Unknown send outcomes must never trigger a blind POST retry");

  assert.deepEqual(fixtureErrors, []);
  console.log("Concurrent chats: command shapes, parallel sends, distinct local replies, same-chat exclusion, strict matching, merged state and receipt recovery passed.");
} finally {
  phase?.release();
  for (const child of children) child.kill("SIGKILL");
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(directory, { recursive: true, force: true });
}
