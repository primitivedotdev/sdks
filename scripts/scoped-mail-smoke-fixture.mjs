import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WebSocketServer } from "ws";

// Real local HTTP and WebSocket boundaries, with inert credentials and no mail.
export async function scopedMailFixture(binaryArgument) {
  const binary = resolve(binaryArgument ?? "cli-node/bin/run.js");
  const directory = await mkdtemp(join(tmpdir(), "primitive-scoped-mail-"));
  const owner = "agent@sender.example",
    peer = "help@agent.example";
  const endpointId = randomUUID(),
    emails = new Map(),
    sends = new Map();
  const requests = [],
    failures = [],
    children = [],
    pending = [],
    completions = [];
  const searched = new Set(),
    pushAfterSearch = new Map(),
    pushAfterNotice = new Map();
  let receiveSocket,
    authenticated = 0,
    posts = 0,
    activeStreams = 0,
    maximumStreams = 0;
  let stallPath = "",
    lookupUnavailable = false;
  function json(response, data, cursor = null) {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ success: true, data, meta: { cursor } }));
  }
  function inbound(parent, overrides = {}) {
    const id = randomUUID(),
      now = new Date().toISOString();
    return {
      id,
      sender: peer,
      from_email: peer,
      from_header: `Helper <${peer}>`,
      recipient: owner,
      to_email: owner,
      status: "accepted",
      domain: "sender.example",
      webhook_attempt_count: 0,
      message_id: `<${id}@agent.example>`,
      created_at: now,
      received_at: now,
      body_text: "The answer",
      body_html: null,
      subject: "Answer",
      replies: [],
      reply_to_sent_email_id: parent,
      parsed: { status: "complete", attachments: [] },
      auth: {
        spf: "pass",
        dmarc: "pass",
        dmarcFromDomain: "agent.example",
        dmarcSpfAligned: true,
        dmarcDkimAligned: true,
        dkimSignatures: [],
      },
      ...overrides,
    };
  }
  function sent(body = "fixture", key = randomUUID()) {
    const id = randomUUID();
    const row = {
      id,
      from: owner,
      from_address: owner,
      from_header: owner,
      to_address: peer,
      to_header: peer,
      subject: body,
      status: "delivered",
      delivery_status: "delivered",
      accepted: [peer],
      rejected: [],
      idempotent_replay: false,
      client_idempotency_key: key,
      request_id: randomUUID(),
      content_hash: "fixture-hash",
      queue_id: null,
    };
    sends.set(id, row);
    return row;
  }
  function dispatch() {
    if (!receiveSocket || !pending.length) return;
    const socket = receiveSocket;
    receiveSocket = undefined;
    socket.send(
      JSON.stringify({
        type: "event",
        data: {
          delivery: pending[0],
          backlog: pending.length - 1,
          gap_count: 0,
          last_gap_reason: null,
          retention_seconds: 86400,
          handler_timeout_seconds: 30,
        },
      }),
    );
  }
  function push(email) {
    emails.set(email.id, email);
    pending.push({
      queue_id: randomUUID(),
      event_id: randomUUID(),
      delivery_id: randomUUID(),
      event_type: "email.received",
      lease_token: randomUUID(),
      lease_expires_at: new Date(Date.now() + 30000).toISOString(),
      headers: {},
      body: JSON.stringify({
        email: {
          id: email.id,
          received_at: email.received_at,
          smtp: { rcpt_to: [owner] },
        },
      }),
    });
    dispatch();
  }
  const api = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      requests.push({ method: request.method, url });
      if (url.pathname === stallPath) return;
      let raw = "";
      for await (const bytes of request) raw += bytes;
      if (request.method === "POST" && url.pathname === "/v1/endpoints") {
        const input = JSON.parse(raw);
        assert.equal(input.kind, "pull");
        assert.deepEqual(input.rules, { event_types: ["email.received"] });
        json(response, {
          id: endpointId,
          name: input.name,
          kind: "pull",
          enabled: true,
          recipient: owner,
          rules: input.rules,
          receiver_capabilities: {
            completion_modes: ["sdk"],
            stream_protocols: ["primitive.events.v1"],
          },
        });
      } else if (
        request.method === "POST" &&
        (url.pathname === "/v1/send-mail" ||
          /^\/v1\/emails\/[^/]+\/reply$/.test(url.pathname))
      ) {
        assert.ok(
          authenticated > 0,
          "A send must follow authenticated WebSocket readiness",
        );
        const input = JSON.parse(raw);
        assert.equal(input.from, owner);
        assert.match(request.headers["idempotency-key"], /^primitive-chat-/);
        posts++;
        const row = sent(input.body_text, request.headers["idempotency-key"]);
        if (input.body_text === "uncertain send") {
          const answer = inbound(row.id);
          emails.set(answer.id, answer);
          request.socket.destroy();
          return;
        }
        if (input.body_text !== "timeout then resume") {
          pushAfterSearch.set(row.id, () => {
            const progress = inbound(row.id, {
              body_text: "Working",
              parsed: {
                status: "complete",
                attachments: [
                  {
                    filename: "interaction.json",
                    content_type: "application/json",
                    size_bytes: 10,
                  },
                ],
              },
            });
            // Journal UUID ordering is not event ordering. Make the inspection
            // notice causal before any plain answer is available to this wait.
            pushAfterNotice.set(progress.id, () => {
              push(inbound(randomUUID()));
              push(inbound(row.id, { from_header: "attacker@agent.example" }));
              push(inbound(row.id));
            });
            push(progress);
          });
        }
        json(response, row);
      } else if (
        request.method === "GET" &&
        url.pathname === "/v1/sent-emails"
      ) {
        const key = url.searchParams.get("idempotency_key");
        assert.ok(key, "Send reconciliation must use its saved key");
        if (lookupUnavailable) {
          response.statusCode = 503;
          json(response, {});
          return;
        }
        json(
          response,
          [...sends.values()].filter(
            (row) => row.client_idempotency_key === key,
          ),
        );
      } else if (
        request.method === "GET" &&
        url.pathname.startsWith("/v1/sent-emails/")
      ) {
        const row = sends.get(url.pathname.split("/").at(-1));
        assert.ok(row);
        json(response, row);
      } else if (
        request.method === "GET" &&
        url.pathname === "/v1/emails/search"
      ) {
        assert.equal(url.searchParams.get("from"), peer);
        assert.equal(url.searchParams.get("to"), owner);
        const parent = url.searchParams.get("reply_to_sent_email_id");
        if (parent) {
          assert.ok(sends.has(parent));
          searched.add(parent);
        } else
          assert.equal(
            url.searchParams.get("sort"),
            "received_at_desc",
            "Only peer continuation may omit exact parent",
          );
        let rows = [...emails.values()].filter(
          (email) => !parent || email.reply_to_sent_email_id === parent,
        );
        const since = url.searchParams.get("date_from");
        if (since)
          rows = rows.filter(
            (email) => Date.parse(email.received_at) >= Date.parse(since),
          );
        if (!parent) rows.reverse();
        json(response, rows);
        const pushReady = pushAfterSearch.get(parent);
        if (pushReady) {
          pushAfterSearch.delete(parent);
          setImmediate(pushReady);
        }
      } else if (
        request.method === "GET" &&
        /^\/v1\/emails\/[^/]+$/.test(url.pathname)
      ) {
        const email = emails.get(url.pathname.split("/").at(-1));
        assert.ok(email);
        json(response, email);
      } else
        throw new Error(`Forbidden request ${request.method} ${url.pathname}`);
    } catch (error) {
      failures.push(error);
      response.statusCode = 500;
      json(response, {});
    }
  });
  const sockets = new WebSocketServer({ server: api });
  sockets.on("connection", (socket) => {
    activeStreams++;
    maximumStreams = Math.max(maximumStreams, activeStreams);
    let ready = false;
    socket.on("close", () => {
      activeStreams--;
      if (ready) authenticated--;
      if (receiveSocket === socket) receiveSocket = undefined;
    });
    socket.on("message", (bytes) => {
      try {
        const frame = JSON.parse(bytes.toString());
        if (frame.type === "authenticate") {
          ready = true;
          authenticated++;
          socket.send(
            JSON.stringify({ type: "ready", protocol: "primitive.events.v1" }),
          );
        } else if (frame.type === "receive") {
          receiveSocket = socket;
          dispatch();
        } else if (frame.type === "complete") {
          assert.equal(frame.body.mode, "sdk");
          assert.equal(frame.body.accepted, true);
          assert.equal(frame.body.delivery_id, pending[0]?.delivery_id);
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
  const env = {
    ...process.env,
    PRIMITIVE_CONFIG_DIR: directory,
    XDG_CONFIG_HOME: directory,
    PRIMITIVE_API_KEY: [
      "pconn",
      randomUUID().replaceAll("-", "").repeat(2),
    ].join("_"),
    PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${api.address().port}/v1`,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
    NO_PROXY: "127.0.0.1,localhost",
    no_proxy: "127.0.0.1,localhost",
  };
  for (const key of [
    "PRIMITIVE_API_HEADERS",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
  ])
    delete env[key];
  function invoke(args) {
    const child = spawn(process.execPath, [binary, ...args], {
      cwd: directory,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const run = { child, stdout: "", stderr: "", code: undefined };
    children.push(run);
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.stdout.on("data", (bytes) => {
      run.stdout += bytes;
    });
    child.stderr.on("data", (bytes) => {
      run.stderr += bytes;
      for (const [id, release] of pushAfterNotice) {
        if (
          run.stderr.includes(`Reply ${id} contains an interaction attachment`)
        ) {
          pushAfterNotice.delete(id);
          release();
        }
      }
    });
    run.closed = new Promise((done, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        clearTimeout(timer);
        run.code = code;
        done(run);
      });
    });
    return run;
  }
  async function until(check, label) {
    const deadline = Date.now() + 12000;
    while (!check()) {
      if (failures.length) throw failures[0];
      if (Date.now() >= deadline)
        throw new Error(
          `${label}: ${children.map((child) => child.stderr).join("\n")}`,
        );
      await new Promise((done) => setTimeout(done, 20));
    }
  }
  return {
    owner,
    peer,
    emails,
    sends,
    requests,
    failures,
    searched,
    completions,
    inbound,
    sent,
    push,
    invoke,
    until,
    run: async (args) => invoke(args).closed,
    storedEmail: async (id) => {
      const roots = await readdir(join(directory, "shared-mail"));
      assert.equal(
        roots.length,
        1,
        "One credential must use one shared journal",
      );
      return JSON.parse(
        await readFile(
          join(directory, "shared-mail", roots[0], "emails", `${id}.json`),
          "utf8",
        ),
      );
    },
    posts: () => posts,
    maximumStreams: () => maximumStreams,
    stall: (path) => {
      stallPath = path;
    },
    failLookup: (value) => {
      lookupUnavailable = value;
    },
    async close() {
      for (const run of children)
        if (run.code === undefined) run.child.kill("SIGKILL");
      await Promise.allSettled(children.map((run) => run.closed));
      for (const socket of sockets.clients) socket.terminate();
      await new Promise((done) => sockets.close(done));
      api.closeAllConnections();
      await new Promise((done) => api.close(done));
      await rm(directory, { recursive: true, force: true });
    },
  };
}
