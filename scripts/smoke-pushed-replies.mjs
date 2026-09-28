import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { WebSocketServer } from "ws";

// Installed CLI, real local sockets, fake product boundaries. No real mail or model.
if (process.platform === "win32") {
  console.log("Shared native notification smoke requires Unix sockets.");
  process.exit(0);
}
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const mode = process.argv[3] ?? "notifications";
const includeNative = mode === "notifications";
const handoff = mode === "handoff";
const directory = await mkdtemp("/tmp/primitive-pushed-replies-");
await chmod(directory, 0o700);
const owner = "device@example.com",
  peer = "peer@example.net";
const endpointId = randomUUID(),
  sessionId = randomUUID();
const parents = [randomUUID(), randomUUID()];
const fixture = JSON.parse(
  await readFile(
    new URL(
      "../test-fixtures/webhook/valid-email-received.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const emails = new Map(),
  searched = new Set(),
  pending = [],
  completions = [];
const failures = [],
  children = [],
  queued = [];
let streamOpens = 0,
  activeStreams = 0,
  maximumStreams = 0;
let receiveSocket;
function envelope(response, data, meta) {
  response.setHeader("content-type", "application/json");
  response.end(
    JSON.stringify({ success: true, data, ...(meta ? { meta } : {}) }),
  );
}
function inbound(parent, body) {
  const id = randomUUID(),
    now = new Date().toISOString();
  const auth = {
    spf: "pass",
    dmarc: "pass",
    dmarcFromDomain: "example.net",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dkimSignatures: [],
  };
  const detail = {
    id,
    recipient: owner,
    to_email: owner,
    sender: peer,
    from_email: peer,
    from_header: peer,
    status: "completed",
    domain: "example.com",
    webhook_attempt_count: 0,
    message_id: `<${id}@example.net>`,
    created_at: now,
    received_at: now,
    reply_to_sent_email_id: parent,
    body_text: body,
    body_html: null,
    parsed: { status: "complete", attachments: [] },
    replies: [],
    auth,
  };
  const event = structuredClone(fixture);
  event.email.id = id;
  event.email.received_at = now;
  event.email.smtp.rcpt_to = [owner];
  event.email.smtp.mail_from = peer;
  event.email.headers.from = peer;
  event.email.headers.to = owner;
  event.email.auth = { ...event.email.auth, ...auth };
  emails.set(id, detail);
  return {
    detail,
    delivery: {
      queue_id: randomUUID(),
      event_id: randomUUID(),
      delivery_id: randomUUID(),
      event_type: "email.received",
      lease_token: randomUUID(),
      lease_expires_at: new Date(Date.now() + 30000).toISOString(),
      body: JSON.stringify(event),
      headers: {},
    },
  };
}
function dispatch() {
  if (!receiveSocket || pending.length === 0) return;
  const socket = receiveSocket;
  receiveSocket = undefined;
  socket.send(
    JSON.stringify({
      type: "event",
      data: {
        delivery: pending[0].delivery,
        backlog: pending.length - 1,
        gap_count: 0,
        last_gap_reason: null,
        retention_seconds: 86400,
        handler_timeout_seconds: 30,
      },
    }),
  );
}
const api = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://localhost");
    let raw = "";
    for await (const bytes of request) raw += bytes;
    if (request.method === "POST" && url.pathname === "/v1/endpoints") {
      const input = JSON.parse(raw);
      assert.equal(input.kind, "pull");
      envelope(response, {
        id: endpointId,
        name: input.name,
        kind: "pull",
        enabled: true,
        recipient: owner,
        rules: { event_types: ["email.received"] },
        receiver_capabilities: {
          completion_modes: ["sdk"],
          stream_protocols: ["primitive.events.v1"],
        },
      });
    } else if (
      request.method === "GET" &&
      url.pathname === "/v1/emails/search"
    ) {
      const parent = url.searchParams.get("reply_to_sent_email_id");
      assert.ok(
        parents.includes(parent),
        "Recovery must select an exact sent email",
      );
      searched.add(parent);
      envelope(
        response,
        [...emails.values()].filter(
          (email) => email.reply_to_sent_email_id === parent,
        ),
        { cursor: null },
      );
    } else if (
      request.method === "GET" &&
      url.pathname.startsWith("/v1/sent-emails/")
    ) {
      const id = url.pathname.split("/").at(-1);
      assert.ok(parents.includes(id));
      envelope(response, {
        id,
        from_address: owner,
        from_header: owner,
        to_address: peer,
        to_header: peer,
        status: "delivered",
      });
    } else if (
      request.method === "GET" &&
      url.pathname.startsWith("/v1/emails/")
    ) {
      const detail = emails.get(url.pathname.split("/").at(-1));
      assert.ok(detail, "Only specific known email details may be read");
      envelope(response, detail);
    } else {
      throw new Error(`Unexpected request: ${request.method} ${url.pathname}`);
    }
  } catch (error) {
    failures.push(error);
    response.statusCode = 500;
    envelope(response, {});
  }
});
const sockets = new WebSocketServer({ server: api });
sockets.on("connection", (socket) => {
  streamOpens++;
  activeStreams++;
  maximumStreams = Math.max(maximumStreams, activeStreams);
  socket.on("close", () => {
    activeStreams--;
    if (receiveSocket === socket) receiveSocket = undefined;
  });
  socket.on("message", (bytes) => {
    try {
      const frame = JSON.parse(bytes.toString());
      if (frame.type === "authenticate")
        socket.send(
          JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }),
        );
      else if (frame.type === "receive") {
        receiveSocket = socket;
        dispatch();
      } else if (frame.type === "complete") {
        assert.equal(frame.body.mode, "sdk");
        assert.equal(frame.body.accepted, true);
        assert.equal(frame.body.delivery_id, pending[0]?.delivery.delivery_id);
        completions.push(frame.body);
        pending.shift();
        socket.send(
          JSON.stringify({ type: "receipt", data: { result: "completed" } }),
        );
      } else assert.equal(frame.type, "pong");
    } catch (error) {
      failures.push(error);
      socket.terminate();
    }
  });
});
await new Promise((done) => api.listen(0, "127.0.0.1", done));
const nativeHttp = createServer(),
  native = new WebSocketServer({ server: nativeHttp });
const socketPath = join(directory, "native.sock");
await new Promise((done) => nativeHttp.listen(socketPath, done));
await chmod(socketPath, 0o600);
native.on("connection", (socket) =>
  socket.on("message", (bytes) => {
    const frame = JSON.parse(bytes.toString());
    if (frame.id === undefined) return;
    let result;
    if (frame.method === "initialize") result = {};
    else if (frame.method === "thread/loaded/list")
      result = { data: [sessionId], nextCursor: null };
    else if (frame.method === "thread/read")
      result = {
        thread: { id: sessionId, cwd: directory, canAcceptDirectInput: true },
      };
    else if (frame.method === "thread/queue/add") {
      queued.push(frame.params);
      result = {
        queuedSubmission: {
          id: randomUUID(),
          clientUserMessageId: frame.params.clientUserMessageId,
        },
      };
    } else {
      failures.push(new Error(`Unexpected native operation ${frame.method}`));
      socket.terminate();
      return;
    }
    socket.send(JSON.stringify({ id: frame.id, result }));
  }),
);
const env = {
  ...process.env,
  PRIMITIVE_CONFIG_DIR: join(directory, "config"),
  XDG_CONFIG_HOME: directory,
  PRIMITIVE_API_KEY: ["pconn", randomUUID().replaceAll("-", "").repeat(2)].join(
    "_",
  ),
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${api.address().port}/v1`,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
  NO_PROXY: "127.0.0.1,localhost",
  no_proxy: "127.0.0.1,localhost",
};
for (const name of [
  "PRIMITIVE_API_HEADERS",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
])
  delete env[name];
function invoke(args) {
  const child = spawn(process.execPath, [binary, ...args], {
    cwd: directory,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const run = { child, stdout: "", stderr: "", result: null };
  child.stdout.on("data", (bytes) => {
    run.stdout += bytes;
  });
  child.stderr.on("data", (bytes) => {
    run.stderr += bytes;
  });
  run.closed = new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      run.result = { code };
      done(code);
    });
  });
  children.push(run);
  return run;
}
async function until(check, label) {
  const deadline = Date.now() + 12000;
  while (!check()) {
    if (failures.length) throw failures[0];
    if (Date.now() >= deadline)
      throw new Error(
        `${label}: ${children.map((run) => run.stderr).join("\n")}`,
      );
    await new Promise((done) => setTimeout(done, 20));
  }
}
try {
  if (includeNative) {
    invoke([
      "listen",
      "--notify-session",
      sessionId,
      "--sender",
      peer,
      "--session-socket",
      socketPath,
    ]);
    await until(
      () => streamOpens > 0,
      "Notification receiver did not open WebSocket",
    );
  }
  const startWait = (id) =>
    invoke([
      "emails",
      "wait",
      "--reply-to-sent-email-id",
      id,
      "--from",
      peer,
      "--timeout",
      "10",
    ]);
  const waits = [startWait(parents[0])];
  await until(
    () => searched.has(parents[0]),
    "First wait must own the ready subscription",
  );
  waits.push(startWait(parents[1]));
  await until(
    () => searched.size === 2,
    "Both exact waits must register and recover before receiving",
  );
  const answers = parents.map((id, index) =>
    inbound(id, `Answer ${index + 1}`),
  );
  const unsolicited = inbound(null, "Separate update");
  if (handoff) {
    pending.push(answers[0]);
    dispatch();
    await until(
      () => waits[0].result,
      "Original subscription owner must finish",
    );
    await until(
      () => streamOpens >= 2,
      "Remaining waiter must take over the subscription",
    );
    pending.push(answers[1]);
    dispatch();
  } else {
    pending.push(
      answers[1],
      ...(includeNative ? [unsolicited] : []),
      answers[0],
    );
    dispatch();
  }
  await until(() => waits.every((run) => run.result), "Both waits must finish");
  for (let index = 0; index < waits.length; index++) {
    assert.equal(waits[index].result.code, 0, waits[index].stderr);
    assert.equal(
      JSON.parse(waits[index].stdout.trim()).id,
      answers[index].detail.id,
    );
  }
  if (!includeNative) {
    // A satisfied waiter may exit after durable ingress but before remote ack.
    // A later owner must drain any redelivery without notifying the session
    // about replies already observed by their waiters.
    invoke([
      "listen",
      "--notify-session",
      sessionId,
      "--sender",
      peer,
      "--session-socket",
      socketPath,
    ]);
    await until(
      () => streamOpens >= (handoff ? 3 : 2),
      "A subsequent receiver must reopen the shared subscription",
    );
  }
  await until(
    () => completions.length === (includeNative ? 3 : 2),
    "A subsequent receiver must acknowledge any durable redelivery",
  );
  assert.equal(
    maximumStreams,
    1,
    "Foreground participants must share one subscription owner",
  );
  if (includeNative) {
    await until(
      () => queued.length === 1,
      "The independent update must notify exactly once",
    );
    assert.ok(queued[0].input[0].text.includes(unsolicited.detail.id));
    for (const answer of answers)
      assert.ok(!queued[0].input[0].text.includes(answer.detail.id));
  } else assert.equal(queued.length, 0);
  assert.deepEqual(failures, []);
  console.log(
    `Pushed reply CLI smoke passed: two exact waits, ${includeNative ? "one native notification, " : ""}${handoff ? "subscription ownership handoff, " : ""}one concurrent WebSocket, no inbox scans.`,
  );
} finally {
  for (const run of children)
    if (run.result === null) run.child.kill("SIGTERM");
  await Promise.race([
    Promise.allSettled(children.map((run) => run.closed)),
    new Promise((done) => setTimeout(done, 2000)),
  ]);
  for (const run of children)
    if (run.result === null) run.child.kill("SIGKILL");
  await Promise.allSettled(children.map((run) => run.closed));
  for (const socket of sockets.clients) socket.terminate();
  for (const socket of native.clients) socket.terminate();
  await new Promise((done) => sockets.close(done));
  await new Promise((done) => native.close(done));
  await new Promise((done) => nativeHttp.close(done));
  await new Promise((done) => api.close(done));
  await rm(directory, { recursive: true, force: true });
}
