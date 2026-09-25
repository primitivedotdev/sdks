import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Drive the installed CLI's `inbox next` (and the --awaiting filters)
// against a local stand-in for the reply-state API: an email awaiting a
// reply, the reply -> next loop, an empty inbox, automated mail, a
// server without reply state, and --wait, including mail that lands
// between the reply-state check and the long-poll.
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-inbox-next-smoke-"));
const AGENT = "agent@acme.primitive.test";

let mode = "current"; // "current" | "old-strict" | "old-lenient"
const emails = [];
const log = [];
let afterStateCheck = null;
let onLongPoll = null;

function addEmail(overrides = {}) {
  const at = new Date(Date.now() + emails.length).toISOString();
  const email = {
    id: randomUUID(), created_at: at, received_at: at, sender: "alice@example.test",
    from_header: "Alice <alice@example.test>", from_email: "alice@example.test",
    recipient: AGENT, to_addresses: [AGENT], subject: "Question", status: "completed",
    domain: "acme.primitive.test", thread_id: randomUUID(), message_id: `<${randomUUID()}@example.test>`,
    webhook_attempt_count: 0, automation_headers: null, awaiting: "you", reply_count: 0,
    last_replied_at: null, body_text: "Can you help?", ...overrides,
  };
  emails.push(email);
  return email;
}

const cursorOf = (email) => `${email.created_at}|${email.id}`;

function present(email) {
  if (mode === "current") return email;
  const { awaiting: _a, reply_count: _r, last_replied_at: _l, ...rest } = email;
  return rest;
}

function send(response, status, body) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(body));
}

function forwardTail(since, awaiting) {
  return emails
    .filter((email) => cursorOf(email) > since)
    .filter((email) => !awaiting || email.awaiting === awaiting)
    .sort((a, b) => cursorOf(a).localeCompare(cursorOf(b)));
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost");
  let raw = "";
  for await (const chunk of request) raw += chunk;
  const query = Object.fromEntries(url.searchParams);
  log.push({ method: request.method, path: url.pathname, query });

  if (request.method === "GET" && url.pathname === "/v1/emails") {
    if (mode === "old-strict" && query.awaiting !== undefined) {
      send(response, 400, { success: false, error: { code: "validation_error", message: "Unrecognized key(s) in object: 'awaiting'" } });
      return;
    }
    const awaiting = mode === "current" ? query.awaiting : undefined;
    const limit = Number(query.limit ?? 50);
    if (query.since) {
      let rows = forwardTail(query.since, awaiting);
      const wait = Number(query.wait ?? 0);
      if (rows.length === 0 && wait > 0) {
        const deadline = Date.now() + wait * 1000;
        onLongPoll?.();
        while (rows.length === 0 && Date.now() < deadline) {
          await new Promise((done) => setTimeout(done, 100));
          rows = forwardTail(query.since, awaiting);
        }
      }
      const page = rows.slice(0, limit);
      send(response, 200, { success: true, data: page.map(present), meta: { total: rows.length, limit, cursor: page.length ? cursorOf(page.at(-1)) : null } });
      if (awaiting === "you" && afterStateCheck) {
        const hook = afterStateCheck;
        afterStateCheck = null;
        hook();
      }
      return;
    }
    const rows = [...emails].sort((a, b) => cursorOf(b).localeCompare(cursorOf(a)))
      .filter((email) => !awaiting || email.awaiting === awaiting).slice(0, limit);
    send(response, 200, { success: true, data: rows.map(present), meta: { total: rows.length, limit, cursor: null } });
    return;
  }

  const match = /^\/v1\/emails\/([^/]+)(\/conversation|\/reply)?$/.exec(url.pathname);
  const email = match && emails.find((candidate) => candidate.id === match[1]);
  if (match && !email) {
    send(response, 404, { success: false, error: { code: "not_found", message: "Email not found" } });
    return;
  }
  if (request.method === "GET" && match && !match[2]) {
    send(response, 200, { success: true, data: { ...present(email), smtp_mail_from: email.sender, replies: [] } });
    return;
  }
  if (request.method === "GET" && match?.[2] === "/conversation") {
    send(response, 200, { success: true, data: { thread_id: email.thread_id, subject: email.subject, message_count: 1, truncated: false,
      messages: [{ role: "user", direction: "inbound", id: email.id, message_id: email.message_id, from: email.from_email,
        to: AGENT, subject: email.subject, text: email.body_text, timestamp: email.received_at }] } });
    return;
  }
  if (request.method === "POST" && match?.[2] === "/reply") {
    const body = JSON.parse(raw);
    assert.ok(body.body_text, "reply must carry a body");
    email.awaiting = "them";
    email.reply_count += 1;
    email.last_replied_at = new Date().toISOString();
    const id = randomUUID();
    send(response, 200, { success: true, data: { id, status: "queued", delivery_status: "queued", from: AGENT, to: email.from_email,
      accepted: [email.from_email], rejected: [], queue_id: randomUUID(), request_id: randomUUID(), content_hash: "x",
      message_id: `<${id}@acme.primitive.test>`, idempotent_replay: false } });
    return;
  }
  send(response, 404, { success: false, error: { code: "not_found", message: `No fixture for ${request.method} ${url.pathname}` } });
});

await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/v1`;

function run(args) {
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, [binary, ...args, "--api-base-url", base], {
      env: { ...process.env, XDG_CONFIG_HOME: config, PRIMITIVE_CONFIG_DIR: config, PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
        PRIMITIVE_API_KEY: "prim_test_only", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.on("error", fail);
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}

try {
  // An email awaiting a reply, behind an older bounce and newsletter.
  const bounce = addEmail({ sender: "", from_header: "MAILER-DAEMON@mx.remote.test", from_email: "MAILER-DAEMON@mx.remote.test", subject: "Undeliverable" });
  const newsletter = addEmail({ automation_headers: { list_unsubscribe: "<mailto:u@news.test>", precedence: "bulk" }, subject: "Weekly news" });
  const first = addEmail({ subject: "First question" });
  const second = addEmail({ subject: "Second question" });

  const human = await run(["inbox", "next"]);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Awaiting your reply:/);
  assert.match(human.stdout, new RegExp(`id:\\s+${first.id}`));
  assert.match(human.stdout, new RegExp(`reply --id ${first.id} --body`));
  assert.match(human.stderr, /skipped 2 older automated emails/);

  const asJson = await run(["inbox", "next", "--json"]);
  assert.equal(asJson.code, 0, asJson.stderr);
  const envelope = JSON.parse(asJson.stdout);
  assert.equal(envelope.version, 1);
  assert.equal(envelope.outcome, "email");
  assert.equal(envelope.email.id, first.id);
  assert.equal(envelope.email.awaiting, "you");
  assert.equal(envelope.email.reply_count, 0);
  assert.deepEqual(envelope.automated, { automated: false, reasons: [], automation_headers_known: false });
  assert.equal(envelope.conversation.messages[0].role, "user");
  assert.match(envelope.reply_command, new RegExp(` reply --id ${first.id}$`));
  assert.deepEqual(envelope.skipped_automated, [
    { id: bounce.id, reasons: ["null_envelope_sender", "mailer_daemon"] },
    { id: newsletter.id, reasons: ["precedence", "list_unsubscribe"] },
  ]);

  // The loop: reply, then next moves on; replying to the last empties it.
  const replyFirst = await run(["reply", "--id", first.id, "--body", "Here you go."]);
  assert.equal(replyFirst.code, 0, replyFirst.stderr);
  const afterFirst = await run(["inbox", "next", "--json"]);
  assert.equal(afterFirst.code, 0, afterFirst.stderr);
  assert.equal(JSON.parse(afterFirst.stdout).email.id, second.id);
  const replySecond = await run(["reply", "--id", second.id, "--body", "Done."]);
  assert.equal(replySecond.code, 0, replySecond.stderr);

  const empty = await run(["inbox", "next"]);
  assert.equal(empty.code, 5, empty.stderr);
  assert.equal(empty.stdout, "");
  assert.match(empty.stderr, /Nothing awaits your reply\. Skipped 2 automated emails/);
  const emptyJson = await run(["inbox", "next", "--json"]);
  assert.equal(emptyJson.code, 5);
  assert.equal(JSON.parse(emptyJson.stdout).outcome, "empty");

  const automated = await run(["inbox", "next", "--include-automated", "--json"]);
  assert.equal(automated.code, 0, automated.stderr);
  const automatedEnvelope = JSON.parse(automated.stdout);
  assert.equal(automatedEnvelope.email.id, bounce.id);
  assert.equal(automatedEnvelope.automated.automated, true);

  // Reply-state filters on the other surfaces.
  const latest = await run(["emails", "latest", "--awaiting", "them"]);
  assert.equal(latest.code, 0, latest.stderr);
  assert.match(latest.stderr, /AWAITING\s+REPLIES\s+SUBJECT/);
  assert.match(latest.stdout, /them\s+1\s+Second question/);
  assert.ok(log.some((entry) => entry.path === "/v1/emails" && entry.query.awaiting === "them"));

  // A server without reply state must fail loudly, never guess.
  mode = "old-lenient";
  const lenient = await run(["inbox", "next", "--json"]);
  assert.equal(lenient.code, 1);
  assert.equal(JSON.parse(lenient.stdout).error.code, "reply_state_unsupported");
  assert.match(lenient.stderr, /does not support reply state yet/);
  const lenientList = await run(["emails", "list", "--awaiting", "you"]);
  assert.equal(lenientList.code, 1);
  assert.equal(lenientList.stdout, "");
  assert.match(lenientList.stderr, /does not support reply state yet/);
  mode = "old-strict";
  const strict = await run(["inbox", "next"]);
  assert.equal(strict.code, 1);
  assert.equal(strict.stdout, "");
  assert.match(strict.stderr, /rejected the `awaiting` filter/);
  const strictLatest = await run(["emails", "latest", "--awaiting", "you"]);
  assert.equal(strictLatest.code, 1);
  assert.match(strictLatest.stderr, /does not support reply state yet/);
  mode = "current";

  // --wait: mail that arrives while the CLI holds the long-poll.
  let arrived;
  onLongPoll = () => {
    onLongPoll = null;
    setTimeout(() => { arrived = addEmail({ subject: "Arrived while waiting" }); }, 300);
  };
  log.length = 0;
  const waited = await run(["inbox", "next", "--wait", "--timeout", "20", "--json"]);
  assert.equal(waited.code, 0, waited.stderr);
  assert.equal(JSON.parse(waited.stdout).email.id, arrived.id);
  const lists = log.filter((entry) => entry.path === "/v1/emails");
  assert.equal(lists[0].query.limit, "1", "the baseline must be read before the first check");
  assert.equal(lists[1].query.awaiting, "you");
  assert.ok(lists.some((entry) => entry.query.wait !== undefined));
  const replyArrived = await run(["reply", "--id", arrived.id, "--body", "Thanks."]);
  assert.equal(replyArrived.code, 0, replyArrived.stderr);

  // --wait: mail that lands after the reply-state check but before the
  // long-poll starts. A `--since now` poll would miss it; the baseline
  // taken before the check does not.
  let raced;
  afterStateCheck = () => { raced = addEmail({ subject: "Raced the check" }); };
  const racedRun = await run(["inbox", "next", "--wait", "--timeout", "20", "--json"]);
  assert.equal(racedRun.code, 0, racedRun.stderr);
  assert.equal(JSON.parse(racedRun.stdout).email.id, raced.id);
  const replyRaced = await run(["reply", "--id", raced.id, "--body", "Thanks."]);
  assert.equal(replyRaced.code, 0, replyRaced.stderr);

  // --wait with nothing arriving ends with the empty code.
  const started = Date.now();
  const timedOut = await run(["inbox", "next", "--wait", "--timeout", "2"]);
  assert.equal(timedOut.code, 5, timedOut.stderr);
  assert.match(timedOut.stderr, /waiting up to 2s/);
  assert.ok(Date.now() - started >= 1500, "--wait must actually hold until the timeout");

  console.log("inbox next: email, reply loop, empty, automated, old servers, --wait arrival, --wait race and --wait timeout passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
