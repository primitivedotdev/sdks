import {
  createServer,
  IncomingMessage,
  type RequestListener,
  type Server,
} from "node:http";
import { Writable } from "node:stream";
import { setTimeout as delay } from "node:timers/promises";
import {
  signWebhookPayload,
  verifyWebhookSignature,
} from "@primitivedotdev/sdk/webhook";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createListenHandler,
  validateListenHandlerOptions,
} from "../../src/oclif/listen-handlers.js";
import type { ListenDelivery } from "../../src/oclif/listen-types.js";

const delivery: ListenDelivery = {
  body: '{"text":"hello 🌎 $(this-is-data)","ok":true}',
  event_id: "11111111-1111-4111-8111-111111111111",
  event_type: "email.received",
  delivery_id: "22222222-2222-4222-8222-222222222222",
  queue_id: "33333333-3333-4333-8333-333333333333",
  lease_token: "44444444-4444-4444-8444-444444444444",
  lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
  headers: { "Content-Type": "application/json" },
};
const servers: Server[] = [];
const processes = new Set<number>();
const liveSignal = () => new AbortController().signal;
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const command = (source: string) =>
  `${quote(process.execPath)} -e ${quote(source)}`;
function output() {
  const chunks: Buffer[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });
  return { stream, text: () => Buffer.concat(chunks).toString("utf8") };
}
async function serve(handler: RequestListener) {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test server address");
  return `http://127.0.0.1:${address.port}/handler`;
}
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const pid of processes) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      /* Already stopped. */
    }
  }
  processes.clear();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

describe("local webhook handler options", () => {
  it.each([
    "ftp://localhost/test",
    "http://user:secret@localhost/test",
    "https://localhost/#fragment",
    "not a url",
  ])("rejects invalid target %s before delivery", (forwardTo) => {
    expect(() => validateListenHandlerOptions({ forwardTo })).toThrow();
  });
  it("rejects exec on Windows before creating a subscription or child", () => {
    const descriptor = Object.getOwnPropertyDescriptor(process, "platform");
    Object.defineProperty(process, "platform", {
      value: "win32",
      configurable: true,
    });
    try {
      expect(() =>
        validateListenHandlerOptions({ exec: "node hook.js" }),
      ).toThrow("use --forward-to");
      expect(() =>
        validateListenHandlerOptions({ forwardTo: "http://localhost:3000" }),
      ).not.toThrow();
    } finally {
      if (descriptor) Object.defineProperty(process, "platform", descriptor);
    }
  });
  it("rejects mutually exclusive modes and empty shell commands", () => {
    expect(() =>
      createListenHandler({ exec: "cat", forwardTo: "http://localhost" }),
    ).toThrow();
    expect(() => createListenHandler({ exec: "  " })).toThrow();
  });
});

describe("JSONL stdout", () => {
  it("writes the whole event and waits for callback and backpressure", async () => {
    let release = () => {};
    let seen = "";
    const stdout = new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, callback) {
        seen += chunk.toString();
        release = callback;
      },
    });
    let completed = false;
    const pending = createListenHandler({ stdout })(
      delivery,
      liveSignal(),
    ).then((result) => {
      completed = true;
      return result;
    });
    await delay(10);
    expect(seen).toBe(`${delivery.body}\n`);
    expect(completed).toBe(false);
    release();
    expect(await pending).toMatchObject({
      succeeded: true,
      outcome: { mode: "stdout", write_succeeded: true },
    });
  });
  it("normalizes pretty JSON to one line and rejects invalid JSON without acknowledgment", async () => {
    const stdout = output();
    const handler = createListenHandler({ stdout: stdout.stream });
    await handler(
      { ...delivery, body: JSON.stringify(JSON.parse(delivery.body), null, 2) },
      liveSignal(),
    );
    expect(stdout.text().split("\n")).toHaveLength(2);
    expect(JSON.parse(stdout.text())).toEqual(JSON.parse(delivery.body));
    await expect(
      handler({ ...delivery, body: "broken JSON" }, liveSignal()),
    ).rejects.toThrow("Webhook body is not valid JSON.");
  });
  it("does not complete a canceled blocked stdout write", async () => {
    const controller = new AbortController();
    const stdout = new Writable({ write() {} });
    const pending = createListenHandler({ stdout })(
      delivery,
      controller.signal,
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    controller.abort();
    await rejection;
  });
  it("throws on EPIPE without producing a completion outcome", async () => {
    const stdout = new Writable({
      write(_chunk, _encoding, callback) {
        callback(Object.assign(new Error("broken pipe"), { code: "EPIPE" }));
      },
    });
    await expect(
      createListenHandler({ stdout })(delivery, liveSignal()),
    ).rejects.toMatchObject({ code: "EPIPE" });
  });
});

describe("local HTTP forwarding", () => {
  it.each([
    "X-Primitive-Confirmed",
    "X-MyMX-Confirmed",
  ])("preserves signed bytes and honors %s without forwarding API credentials", async (confirmation) => {
    const secret = "test-webhook-signing-secret";
    const { header } = signWebhookPayload(delivery.body, secret);
    let received = "";
    let verified = false;
    let headers: Record<string, unknown> = {};
    const target = await serve(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      received = Buffer.concat(chunks).toString("utf8");
      headers = request.headers;
      verifyWebhookSignature({
        rawBody: received,
        signatureHeader: String(request.headers["primitive-signature"]),
        secret,
      });
      verified = true;
      response.writeHead(200, { [confirmation]: "true" });
      response.end("accepted");
    });
    const result = await createListenHandler({ forwardTo: target })(
      {
        ...delivery,
        headers: {
          ...delivery.headers,
          "Primitive-Signature": header,
          "MyMX-Signature": header,
          "X-Webhook-Event": delivery.event_type,
          "X-Primitive-Webhook-Delivery-Id": delivery.delivery_id,
          Authorization: "Bearer forbidden",
          Cookie: "forbidden",
          "X-Api-Key": "forbidden",
          "Content-Length": "1",
        },
      },
      liveSignal(),
    );
    expect(verified).toBe(true);
    expect(received).toBe(delivery.body);
    expect(headers).toMatchObject({
      "primitive-signature": header,
      "mymx-signature": header,
      "content-length": String(Buffer.byteLength(delivery.body)),
    });
    expect(headers).not.toHaveProperty("authorization");
    expect(headers).not.toHaveProperty("cookie");
    expect(headers).not.toHaveProperty("x-api-key");
    expect(result).toMatchObject({
      succeeded: true,
      outcome: { mode: "http", status_code: 200, confirmed: true },
    });
  });
  it("does not follow redirects", async () => {
    let redirected = false;
    const destination = await serve((_request, response) => {
      redirected = true;
      response.end();
    });
    const target = await serve((_request, response) => {
      response.writeHead(302, { Location: destination });
      response.end();
    });
    expect(
      await createListenHandler({ forwardTo: target })(delivery, liveSignal()),
    ).toMatchObject({
      succeeded: false,
      outcome: {
        status_code: 302,
        error_code: "handler_redirect",
        confirmed: false,
      },
    });
    expect(redirected).toBe(false);
  });
  it.each([
    [400, '{"error":{"code":"quota_exhausted"}}', "quota_exhausted"],
    [500, '{"code":"temporarily_unavailable"}', "temporarily_unavailable"],
    [400, '{"error":{"code":"NOT_VALID"}}', "handler_4xx"],
    [500, "upstream failed", "handler_5xx"],
  ])("normalizes HTTP %s errors using the webhook protocol", async (status, body, code) => {
    const target = await serve((_request, response) => {
      response.writeHead(Number(status));
      response.end(body);
    });
    expect(
      await createListenHandler({ forwardTo: target })(delivery, liveSignal()),
    ).toMatchObject({
      succeeded: false,
      outcome: { status_code: status, error_code: code, confirmed: false },
    });
  });
  it("rejects an oversized 200 response instead of acknowledging it", async () => {
    const target = await serve((_request, response) => {
      response.writeHead(200);
      response.end(Buffer.alloc(1024 * 1024 + 1));
    });
    expect(
      await createListenHandler({ forwardTo: target })(delivery, liveSignal()),
    ).toMatchObject({
      succeeded: false,
      outcome: {
        status_code: 200,
        transport_error: "response_too_large",
        confirmed: false,
      },
    });
  });
  it("rejects a truncated 200 response", async () => {
    const target = await serve((_request, response) => {
      response.writeHead(200, { "Content-Length": "100", Connection: "close" });
      response.end("short");
    });
    const controller = new AbortController();
    // Force immediate socket closure after the deliberately short response.
    const server = servers.at(-1);
    server?.on("connection", (socket) => {
      socket.on("finish", () => socket.destroy());
    });
    expect(
      await createListenHandler({ forwardTo: target })(
        delivery,
        controller.signal,
      ),
    ).toMatchObject({
      succeeded: false,
      outcome: { status_code: 200, transport_error: "io", confirmed: false },
    });
  });
  it("cancels an in-progress response without returning a completion", async () => {
    let headersSent = () => {};
    const sent = new Promise<void>((resolve) => {
      headersSent = resolve;
    });
    const target = await serve((_request, response) => {
      response.writeHead(200);
      response.write("partial");
      headersSent();
    });
    const controller = new AbortController();
    const pending = createListenHandler({ forwardTo: target })(
      delivery,
      controller.signal,
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await sent;
    controller.abort();
    await rejection;
  });
  it("bounds a stalled 200 response body by the same thirty-second deadline", async () => {
    let bodyObserved = () => {};
    const observed = new Promise<void>((resolve) => {
      bodyObserved = resolve;
    });
    const emit = IncomingMessage.prototype.emit;
    vi.spyOn(IncomingMessage.prototype, "emit").mockImplementation(function (
      this: IncomingMessage,
      event: string | symbol,
      ...args: unknown[]
    ) {
      const result = emit.call(this, event, ...args);
      // Wait for the real client to consume response bytes before advancing its deadline.
      if (this.statusCode === 200 && event === "data") bodyObserved();
      return result;
    });
    const target = await serve((_request, response) => {
      response.writeHead(200);
      response.write("partial");
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = createListenHandler({ forwardTo: target })(
      delivery,
      liveSignal(),
    );
    await observed;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toMatchObject({
      succeeded: false,
      outcome: {
        status_code: 200,
        transport_error: "timeout",
        confirmed: false,
      },
    });
  });
});

describe.skipIf(process.platform === "win32")("shell hooks", () => {
  it("uses exact stdin, exposes correlation only, and keeps child stdout off event stdout", async () => {
    vi.stubEnv("PRIMITIVE_API_KEY", "parent-api-secret");
    vi.stubEnv("AGENT_HOME", "/tmp/agent-durable-inbox");
    vi.stubEnv("DATABASE_URL", "postgres://localhost/inbox");
    vi.stubEnv("PRIMITIVE_API_HEADERS", '{"Authorization":"secret"}');
    vi.stubEnv("PRIMITIVE_LEASE_TOKEN", "parent-lease-secret");
    const stderr = output();
    const stdout = output();
    const exec = command(
      'let body="";process.stdin.setEncoding("utf8");process.stdin.on("data",chunk=>body+=chunk);process.stdin.on("end",()=>process.stdout.write(JSON.stringify({body,env:process.env})));',
    );
    const result = await createListenHandler({
      exec,
      stderr: stderr.stream,
      stdout: stdout.stream,
    })(delivery, liveSignal());
    expect(result).toMatchObject({
      succeeded: true,
      outcome: { mode: "exec", exit_code: 0 },
    });
    const child = JSON.parse(stderr.text());
    expect(child.body).toBe(delivery.body);
    expect(child.env).toMatchObject({
      PRIMITIVE_EVENT_ID: delivery.event_id,
      PRIMITIVE_DELIVERY_ID: delivery.delivery_id,
      PRIMITIVE_EVENT_TYPE: delivery.event_type,
    });
    expect(child.env).not.toHaveProperty("PRIMITIVE_API_KEY");
    expect(child.env).toMatchObject({
      AGENT_HOME: "/tmp/agent-durable-inbox",
      DATABASE_URL: "postgres://localhost/inbox",
    });
    expect(child.env).not.toHaveProperty("PRIMITIVE_API_HEADERS");
    expect(child.env).not.toHaveProperty("PRIMITIVE_LEASE_TOKEN");
    expect(stdout.text()).toBe("");
  });
  it("records a nonzero exit as failed acceptance", async () => {
    const exec = command(
      'process.stdin.resume();process.stdin.on("end",()=>process.exit(7));',
    );
    expect(
      await createListenHandler({ exec, stderr: output().stream })(
        delivery,
        liveSignal(),
      ),
    ).toMatchObject({
      succeeded: false,
      outcome: { mode: "exec", exit_code: 7 },
    });
  });
  it("cancels the process group including its descendant without reporting success", async () => {
    const controller = new AbortController();
    let announced = () => {};
    const ready = new Promise<void>((resolve) => {
      announced = resolve;
    });
    let pid = 0;
    const stderr = new Writable({
      write(chunk, _encoding, callback) {
        pid = Number(chunk.toString().trim());
        if (pid) {
          processes.add(pid);
          announced();
        }
        callback();
      },
    });
    const exec = command(
      `const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit'});process.stdout.write(String(child.pid));setInterval(()=>{},1000);`,
    );
    const pending = createListenHandler({ exec, stderr })(
      delivery,
      controller.signal,
    );
    const rejection = expect(pending).rejects.toMatchObject({
      name: "AbortError",
    });
    await ready;
    controller.abort();
    await rejection;
    let alive = true;
    for (let attempt = 0; attempt < 100 && alive; attempt++) {
      try {
        process.kill(pid, 0);
        await delay(10);
      } catch {
        alive = false;
      }
    }
    expect(alive).toBe(false);
  });
  it("reports a hook deadline as timeout and stops the process", async () => {
    let announced = () => {};
    const ready = new Promise<void>((resolve) => {
      announced = resolve;
    });
    const stderr = new Writable({
      write(_chunk, _encoding, callback) {
        announced();
        callback();
      },
    });
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pending = createListenHandler({
      exec: command('process.stdout.write("ready");setInterval(()=>{},1000);'),
      stderr,
    })(delivery, liveSignal());
    await ready;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await pending).toMatchObject({
      succeeded: false,
      outcome: { mode: "exec", exit_code: null, transport_error: "timeout" },
    });
  });
});

describe("forwarding failure evidence", () => {
  it("classifies a connection failure before any response as network with no status", async () => {
    const server = createServer();
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing server address");
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const result = await createListenHandler({
      forwardTo: `http://127.0.0.1:${address.port}`,
    })(delivery, liveSignal());
    expect(result).toMatchObject({
      succeeded: false,
      outcome: {
        mode: "http",
        status_code: null,
        transport_error: "network",
        confirmed: false,
      },
    });
  });
  it("does not accept confirmation headers when the response exceeds its byte limit", async () => {
    const target = await serve((_request, response) => {
      response.writeHead(202, { "X-Primitive-Confirmed": "true" });
      response.write(Buffer.alloc(1024 * 1024 + 1));
      // No end: destroying this response will emit aborted after the size fault.
    });
    const result = await createListenHandler({ forwardTo: target })(
      delivery,
      liveSignal(),
    );
    expect(result).toMatchObject({
      succeeded: false,
      outcome: {
        status_code: 202,
        transport_error: "response_too_large",
        confirmed: false,
      },
    });
  });
});

describe.skipIf(process.platform === "win32")("exec failure cleanup", () => {
  it("reaps the direct child before returning after its stderr destination fails", async () => {
    let pid = 0;
    const stderr = new Writable({
      write(chunk, _encoding, callback) {
        pid = Number(chunk.toString());
        if (pid) processes.add(pid);
        callback(
          Object.assign(new Error("stderr sink closed"), { code: "EPIPE" }),
        );
      },
    });
    // exec replaces the shell so the announced PID is the child whose close must be awaited.
    const result = await createListenHandler({
      exec: `exec ${command("process.stdout.write(String(process.pid));setInterval(()=>{},1000);")}`,
      stderr,
    })(delivery, liveSignal());
    expect(result).toMatchObject({
      succeeded: false,
      outcome: { mode: "exec", transport_error: "io", exit_code: null },
    });
    expect(pid).toBeGreaterThan(0);
    expect(() => process.kill(pid, 0)).toThrow();
  });
  it("returns promptly after an executable cannot be spawned without hanging on cleanup", async () => {
    const result = await createListenHandler({
      exec: "exec /primitive-test-executable-that-does-not-exist",
      stderr: output().stream,
    })(delivery, liveSignal());
    expect(result.succeeded).toBe(false);
    expect(result.outcome.mode).toBe("exec");
  });
});
