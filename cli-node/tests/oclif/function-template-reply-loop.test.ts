import ts from "typescript";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHandler } from "../../src/oclif/function-templates.js";

// Behavioural tests for the scaffolded handler's agent-to-agent loop
// protection. The rendered handler runs for real against a small
// simulated mail network in which two deployments of the scaffold mail
// each other. Every scenario must terminate, bounded by the guard it
// exercises.

const AGENT_A = "loopa@agents.example";
const AGENT_B = "loopb@agents.example";

type Handler = {
  fetch(request: Request, env: Record<string, string>): Promise<Response>;
};

type Network = {
  getThread(options: unknown): Promise<unknown>;
  replyToEmail(options: unknown): Promise<unknown>;
};

declare global {
  var __scaffoldNetwork: Network | undefined;
}

let handler: Handler;

beforeAll(async () => {
  const source = renderHandler().replace(
    /import\s*\{[\s\S]*?\}\s*from\s*"@primitivedotdev\/sdk\/api";/,
    `type EmailReceivedEvent = any;
const net = () => (globalThis as any).__scaffoldNetwork;
const PRIMITIVE_SIGNATURE_HEADER = "primitive-signature";
class WebhookVerificationError extends Error {}
async function verifyWebhookSignature(_options: unknown) {}
function createPrimitiveClient(options: unknown) { return { client: { options } }; }
function getThread(options: any) { return net().getThread(options); }
function replyToEmail(options: any) { return net().replyToEmail(options); }`,
  );
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const mod = (await import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
  )) as { default: Handler };
  handler = mod.default;
});

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

type Mail = {
  id: string;
  messageId: string;
  from: string;
  to: string;
  references: string[];
  threadId: string;
  autoSubmitted: boolean;
};

type Options = {
  /** Whether delivered events carry the platform's automated verdict. */
  verdict?: boolean;
  /** A relay that drops automation headers in transit. */
  stripHeaders?: boolean;
  threadLookupFails?: boolean;
  threadTruncated?: boolean;
  replyStatus?: number;
};

function createNetwork(options: Options = {}) {
  const verdict = options.verdict ?? true;
  const rows = new Map<string, Mail>();
  const thread: { direction: string; from: string }[] = [];
  const queue: Mail[] = [];
  const sends: { key: string; body: Record<string, unknown> }[] = [];
  const keys = new Set<string>();
  const responses: Record<string, unknown>[] = [];
  let seq = 0;
  let invocations = 0;

  function deliver(mail: Omit<Mail, "id">): Mail {
    seq += 1;
    const row = { ...mail, id: `email-${seq}` };
    rows.set(row.id, row);
    thread.push({ direction: "inbound", from: row.from });
    queue.push(row);
    return row;
  }

  globalThis.__scaffoldNetwork = {
    async getThread() {
      if (options.threadLookupFails) {
        return {
          error: { message: "unavailable" },
          response: new Response(null, { status: 503 }),
        };
      }
      const messages = thread.map((m) => ({ ...m }));
      const extra = options.threadTruncated ? 300 : 0;
      return {
        data: { data: { message_count: messages.length + extra, messages } },
      };
    },
    async replyToEmail(raw: unknown) {
      const { path, body, headers } = raw as {
        path: { id: string };
        body: Record<string, unknown>;
        headers: Record<string, string>;
      };
      if (options.replyStatus) {
        return {
          error: { message: "Rate limit exceeded" },
          response: new Response(null, { status: options.replyStatus }),
        };
      }
      // The reply endpoint accepts only these extra headers and rejects
      // the request otherwise; mirror that so the test fails if the
      // handler sends anything else.
      const allowed = new Set([
        "auto-submitted",
        "x-auto-response-suppress",
        "precedence",
      ]);
      const extra = Object.keys((body.headers as object | undefined) ?? {});
      if (extra.some((name) => !allowed.has(name.toLowerCase()))) {
        return {
          error: { message: "header not allowed" },
          response: new Response(null, { status: 400 }),
        };
      }
      const key = headers["Idempotency-Key"] as string;
      if (keys.has(key)) return { data: { data: { replayed: true } } };
      keys.add(key);
      sends.push({ key, body });
      const parent = rows.get(path.id) as Mail;
      thread.push({ direction: "outbound", from: `Agent <${parent.to}>` });
      const declared = (body.headers as Record<string, string> | undefined)?.[
        "Auto-Submitted"
      ];
      deliver({
        messageId: `<m${seq + 1}@agents.example>`,
        from: parent.to,
        to: parent.from,
        references: [...parent.references, parent.messageId],
        threadId: parent.threadId,
        autoSubmitted: !options.stripHeaders && declared === "auto-replied",
      });
      return { data: { data: { id: `sent-${seq}` } } };
    },
  };

  function eventFor(mail: Mail) {
    return {
      id: `evt-${mail.id}`,
      event: "email.received",
      email: {
        id: mail.id,
        thread_id: mail.threadId,
        smtp: { helo: null, mail_from: mail.from, rcpt_to: [mail.to] },
        headers: {
          message_id: mail.messageId,
          subject: "Hello",
          from: mail.from,
          to: mail.to,
          date: null,
        },
        parsed: {
          status: "complete",
          references: mail.references.length > 0 ? mail.references : null,
        },
        ...(verdict
          ? {
              automated: mail.autoSubmitted,
              automated_reasons: mail.autoSubmitted ? ["auto_submitted"] : [],
            }
          : {}),
      },
    };
  }

  async function invoke(mail: Mail) {
    invocations += 1;
    const response = await handler.fetch(
      new Request("https://fn.example/", {
        method: "POST",
        body: JSON.stringify(eventFor(mail)),
      }),
      {
        PRIMITIVE_API_KEY: "k",
        PRIMITIVE_API_BASE_URL: "https://api.example/v1",
        PRIMITIVE_WEBHOOK_SECRET: "s",
      },
    );
    const json = (await response.json()) as Record<string, unknown>;
    responses.push(json);
    return { status: response.status, json };
  }

  async function runLoop(limit = 500) {
    deliver({
      messageId: "<seed@agents.example>",
      from: AGENT_A,
      to: AGENT_B,
      references: [],
      threadId: "thread-1",
      autoSubmitted: false,
    });
    while (queue.length > 0) {
      if (invocations >= limit) {
        throw new Error(`no termination after ${limit} invocations`);
      }
      await invoke(queue.shift() as Mail);
    }
  }

  return { deliver, invoke, runLoop, sends, responses };
}

describe("scaffolded handler agent-to-agent loop protection", () => {
  it("marks its reply automated, so two deployments stop after one reply", async () => {
    const net = createNetwork();
    await net.runLoop();
    expect(net.sends).toHaveLength(1);
    expect(net.sends[0]?.body.headers).toEqual({
      "Auto-Submitted": "auto-replied",
      "X-Auto-Response-Suppress": "All",
    });
    expect(net.responses.at(-1)).toMatchObject({
      skipped: "automated",
      reasons: ["auto_submitted"],
    });
  });

  it("caps replies per thread when a peer strips the automation headers", async () => {
    const net = createNetwork({ stripHeaders: true });
    await net.runLoop();
    expect(net.sends).toHaveLength(10);
    expect(net.responses.at(-1)).toMatchObject({ skipped: "thread_reply_cap" });
  });

  it("caps replies per thread on events that predate the automated verdict", async () => {
    const net = createNetwork({ verdict: false });
    await net.runLoop();
    expect(net.sends).toHaveLength(10);
  });

  it("still terminates on References depth when the thread cannot be read", async () => {
    const net = createNetwork({ stripHeaders: true, threadLookupFails: true });
    await net.runLoop();
    expect(net.sends).toHaveLength(20);
    expect(net.responses.at(-1)).toMatchObject({ skipped: "thread_depth_cap" });
  });

  it("treats a thread longer than the returned window as capped", async () => {
    const net = createNetwork({ threadTruncated: true });
    const result = await net.invoke(
      net.deliver({
        messageId: "<long@people.example>",
        from: "person@people.example",
        to: AGENT_B,
        references: [],
        threadId: "thread-4",
        autoSubmitted: false,
      }),
    );
    expect(result.json).toMatchObject({ skipped: "thread_reply_cap" });
    expect(net.sends).toHaveLength(0);
  });

  it("replies to one inbound Message-ID once, however often it is delivered", async () => {
    const net = createNetwork();
    const mail = {
      messageId: "<dup@people.example>",
      from: "person@people.example",
      to: AGENT_B,
      references: [],
      threadId: "thread-2",
      autoSubmitted: false,
    };
    await net.invoke(net.deliver(mail));
    await net.invoke(net.deliver(mail));
    expect(net.sends).toHaveLength(1);
  });

  it("answers 2xx when the reply is rate limited, so the queue does not retry", async () => {
    const net = createNetwork({ replyStatus: 429 });
    const result = await net.invoke(
      net.deliver({
        messageId: "<rl@people.example>",
        from: "person@people.example",
        to: AGENT_B,
        references: [],
        threadId: "thread-3",
        autoSubmitted: false,
      }),
    );
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ ok: false, status: 429 });
  });
});
