import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workers = vi.hoisted(() => [] as Record<string, string>[]);
// Automatic signal workers are detached processes; record them instead.
vi.mock("node:child_process", async (original) => {
  const actual = await original<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: (...args: Parameters<typeof actual.spawn>) => {
      const env = (args[2] as { env?: Record<string, string> } | undefined)
        ?.env;
      if (env?.PRIMITIVE_AUTO_SIGNAL_WORKER !== "1")
        return actual.spawn(...args);
      workers.push(env);
      return { unref: () => undefined, on: () => undefined };
    },
  };
});

import {
  claimAutoRead,
  readWorkingLease,
  startWorkingLease,
} from "../../src/oclif/auto-signals.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { COMMANDS } from "../../src/oclif/index.js";
import {
  composeJsonDocument,
  jsonOutputRequested,
  STREAMING_JSON_COMMAND_IDS,
  stripAnsi,
} from "../../src/oclif/json-output.js";
import {
  readPendingMail,
  recordPendingMail,
} from "../../src/oclif/pending-mail.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.json-streams.test/v1";

type Runnable = {
  enableJsonFlag?: boolean;
  flags?: Record<string, unknown>;
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

type RunResult = {
  exitCode: number;
  merged: string;
  stderr: string;
  stdout: string;
};

type Responder = (
  url: URL,
  init: RequestInit | undefined,
  request?: { body: string | undefined; method: string },
) => Response;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

const serverError: Responder = () =>
  jsonResponse(503, {
    success: false,
    error: { code: "service_unavailable", message: "try again" },
  });

let responder: Responder = serverError;
let fetchCalls: Array<{
  body: string | undefined;
  init: RequestInit | undefined;
  method: string;
  url: URL;
}> = [];

// Run a command the way the installed CLI does (through the registry) and
// record stdout and stderr both separately and interleaved, as `2>&1` would.
async function runMerged(id: string, argv: string[]): Promise<RunResult> {
  const command = COMMANDS[id] as unknown as Runnable;
  const merged: string[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const toStdout = (text: string) => {
    stdout.push(text);
    merged.push(text);
  };
  const toStderr = (text: string) => {
    stderr.push(text);
    merged.push(text);
  };
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      toStdout(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      toStderr(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      toStdout(`${args.map(String).join(" ")}\n`);
    }),
    vi.spyOn(console, "info").mockImplementation((...args: unknown[]) => {
      toStdout(`${args.map(String).join(" ")}\n`);
    }),
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      toStderr(`${args.map(String).join(" ")}\n`);
    }),
    vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      toStderr(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const thrownExit = (thrown as { oclif?: { exit?: number } } | undefined)
    ?.oclif?.exit;
  // Node's own runtime warnings (emitted by the test runner's loader, not
  // by the CLI) are not command output.
  const withoutNodeWarnings = (chunks: string[]) =>
    chunks
      .join("")
      .split("\n")
      .filter(
        (line) =>
          !/^\(node:\d+\) /.test(line) &&
          !line.startsWith("(Use `node --trace-"),
      )
      .join("\n");
  const exitCode =
    thrown === undefined
      ? typeof process.exitCode === "number"
        ? process.exitCode
        : 0
      : (thrownExit ?? 1);
  process.exitCode = previousExitCode;
  return {
    exitCode,
    merged: withoutNodeWarnings(merged),
    stderr: withoutNodeWarnings(stderr),
    stdout: stdout.join(""),
  };
}

function parseOne(text: string): unknown {
  // JSON.parse rejects trailing content, so this proves the merged stream
  // is exactly one document.
  return JSON.parse(text);
}

function acceptsJson(command: Runnable): boolean {
  return (
    command.enableJsonFlag === true ||
    (command.flags !== undefined && "json" in command.flags)
  );
}

const jsonCommandIds = Object.entries(COMMANDS)
  .filter(([id, command]) => {
    if (STREAMING_JSON_COMMAND_IDS.has(id)) return false;
    return acceptsJson(command as unknown as Runnable);
  })
  .map(([id]) => id)
  .sort();

// Argument lists that fail fast for commands whose bare `--json` form
// would wait on stdin or a local session.
const FAILURE_ARGV: Record<string, string[]> = {
  "agent-connections:claim-agent-connection": ["--status", "--json"],
  "agent:connect": ["--status", "--json"],
};

const cleanedEnvPrefixes = ["PRIMITIVE_", "CLAUDE", "CODEX"];
let savedEnv: Record<string, string | undefined> = {};
let tempHome = "";

beforeEach(() => {
  savedEnv = {};
  for (const name of Object.keys(process.env)) {
    if (cleanedEnvPrefixes.some((prefix) => name.startsWith(prefix))) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  }
  tempHome = mkdtempSync(join(tmpdir(), "primitive-json-streams-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_API_KEY: "prim_test_json_streams",
    PRIMITIVE_API_BASE_URL: API_BASE_URL,
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
  responder = serverError;
  fetchCalls = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      const request = input instanceof Request ? input : undefined;
      const effectiveInit =
        init ?? (request ? { headers: request.headers } : undefined);
      const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
      const body = request
        ? await request.clone().text()
        : typeof init?.body === "string"
          ? init.body
          : undefined;
      fetchCalls.push({ body, init: effectiveInit, method, url });
      return responder(url, effectiveInit, { body, method });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  rmSync(tempHome, { force: true, recursive: true });
});

describe("jsonOutputRequested", () => {
  it("detects --json only before the end-of-options separator", () => {
    expect(jsonOutputRequested(["sent", "list", "--json"])).toBe(true);
    expect(jsonOutputRequested(["--json"])).toBe(true);
    expect(jsonOutputRequested(["send", "--body", "x"])).toBe(false);
    expect(jsonOutputRequested(["listen", "--", "--json"])).toBe(false);
  });
});

describe("composeJsonDocument", () => {
  it("moves stderr notes into warnings on success", () => {
    expect(
      composeJsonDocument({
        exitCode: 0,
        stderr: ["Hint: something\n", "\u001b[33mnext page\u001b[39m\n"],
        stdout: '{"data":[1]}\n',
      }),
    ).toEqual({ data: [1], warnings: ["Hint: something", "next page"] });
  });

  it("keeps a bare array unchanged on success", () => {
    expect(
      composeJsonDocument({
        exitCode: 0,
        stderr: ["note\n"],
        stdout: "[1,2]\n",
      }),
    ).toEqual([1, 2]);
  });

  it("does not repeat the document's own outcome message as a warning", () => {
    expect(
      composeJsonDocument({
        exitCode: 0,
        stderr: ["Message sent.\n", "Other\n"],
        stdout: '{"outcome_message":"Message sent."}',
      }),
    ).toEqual({ outcome_message: "Message sent.", warnings: ["Other"] });
  });

  it("builds an error document from an API error printed on stderr", () => {
    expect(
      composeJsonDocument({
        exitCode: 1,
        stderr: [
          '{\n  "code": "unauthorized",\n  "message": "bad key"\n}\n',
          "Hint: run primitive signin\n",
        ],
        stdout: "",
      }),
    ).toEqual({
      error: { code: "unauthorized", message: "bad key" },
      exit_code: 1,
      warnings: ["Hint: run primitive signin"],
    });
  });

  it("builds an error document from a thrown error", () => {
    const error = Object.assign(new Error("Missing required flag to"), {
      oclif: { exit: 2 },
    });
    expect(
      composeJsonDocument({
        exitCode: 2,
        stderr: [],
        stdout: "",
        thrown: { error },
      }),
    ).toEqual({
      error: { message: "Missing required flag to" },
      exit_code: 2,
    });
  });

  it("adds the failure to a document that lacks one and keeps one it has", () => {
    expect(
      composeJsonDocument({
        exitCode: 4,
        stderr: [],
        stdout: '{"outcome":"uncertain","error":{"message":"timeout"}}',
      }),
    ).toEqual({
      outcome: "uncertain",
      error: { message: "timeout" },
      exit_code: 4,
    });
    expect(
      composeJsonDocument({
        exitCode: 1,
        stderr: ["The server is too old\n"],
        stdout: '{"verified":false}',
      }),
    ).toEqual({
      verified: false,
      error: { message: "The server is too old" },
      exit_code: 1,
      warnings: ["The server is too old"],
    });
  });

  it("wraps text that is not JSON", () => {
    expect(
      composeJsonDocument({ exitCode: 0, stderr: [], stdout: "hello\n" }),
    ).toEqual({ output: "hello" });
  });

  it("returns a summary when the command printed only notes", () => {
    expect(
      composeJsonDocument({ exitCode: 0, stderr: ["Done.\n"], stdout: "" }),
    ).toEqual({ summary: "Done." });
  });

  it("strips terminal escape sequences", () => {
    expect(stripAnsi("\u001b[1mbold\u001b[22m")).toBe("bold");
  });
});

describe("--json prints one document on a merged stream", () => {
  it("covers the commands that accept --json", () => {
    expect(jsonCommandIds.length).toBeGreaterThan(100);
    for (const id of ["send", "reply", "chat", "chat:reply", "sent:get"]) {
      expect(jsonCommandIds).toContain(id);
    }
    expect(jsonCommandIds).not.toContain("listen");
  });

  it.each(jsonCommandIds)(
    "%s fails with one JSON document and empty stderr",
    async (id) => {
      const result = await runMerged(id, FAILURE_ARGV[id] ?? ["--json"]);
      expect(result.stderr).toBe("");
      const document = parseOne(result.merged);
      expect(parseOne(result.stdout)).toEqual(document);
      if (result.exitCode !== 0) {
        expect(document).toMatchObject({ error: expect.anything() });
      }
    },
  );
});

// Hand-rolled commands run against an API that answers every request
// successfully. Commands that wait on stdin, a reply or a local session
// (agent connect and enroll, contacts wait, chat) are covered by their own
// suites, which run through the same registry.
const SUCCESS_ARGV: Record<string, string[]> = {
  "agent:contacts:list": [],
  "agent:contacts:add": ["peer@example.com"],
  "agent:contacts:remove": ["peer@example.com"],
  "agent:contacts:update": ["peer@example.com"],
  "agent:disconnect": ["--profile", "work"],
  "agent:notes:delete": ["AGENT_INFO"],
  "agent:notes:get": ["AGENT_INFO"],
  "agent:notes:list": [],
  "agent:notes:set": ["AGENT_INFO", "hello"],
  config: [],
  "config:list": [],
  "contacts:accept": ["--id", "00000000-0000-4000-8000-000000000001"],
  "contacts:add": ["peer@example.com"],
  "contacts:get": ["peer@example.com"],
  "contacts:list": [],
  "contacts:remove": ["peer@example.com"],
  "contacts:request": ["peer@example.com", "--reason", "a question"],
  "contacts:update": ["peer@example.com"],
  "credits:balance": [],
  "credits:redeem": ["LAUNCH50"],
  "emails:latest": [],
  "functions:templates": [],
  "inbox:next": [],
  "inbox:setup": [],
  "inbox:status": [],
  "network:add": ["peer@example.com"],
  "network:get": ["peer@example.com"],
  "network:list": [],
  "network:members": [],
  "network:peers": [],
  "network:remove": ["peer@example.com"],
  "network:set": ["peer@example.com"],
  "payments:pay": [],
  "payments:pay-email": [
    "--in-reply-to",
    "00000000-0000-4000-8000-000000000001",
  ],
  "payments:pay-email-step": [],
  "payments:register-payout-address": [],
  search: ["invoice"],
  "semantic-search": ["invoice"],
  signal: ["ack", "--id", "00000000-0000-4000-8000-000000000001"],
  "signup:status": [],
  whoami: [],
};

describe("hand-rolled commands with --json against a successful API", () => {
  it.each(Object.entries(SUCCESS_ARGV))(
    "%s prints one JSON document with empty stderr",
    async (id, argv) => {
      responder = (_url, init) =>
        (init?.method ?? "GET").toUpperCase() === "GET"
          ? jsonResponse(200, {
              success: true,
              data: [],
              meta: { cursor: null },
            })
          : jsonResponse(200, { success: true, data: {} });
      const result = await runMerged(id, [...argv, "--json"]);
      expect(result.stderr).toBe("");
      const document = parseOne(result.merged);
      if (result.exitCode !== 0) {
        expect(document).toMatchObject({ error: expect.anything() });
      }
    },
  );
});

function placeholderFor(parameter: {
  enum?: readonly unknown[] | null;
  name: string;
  type?: string | null;
}): string {
  if (parameter.enum && parameter.enum.length > 0) {
    return String(parameter.enum[0]);
  }
  if (parameter.type === "integer" || parameter.type === "number") return "1";
  if (parameter.type === "boolean") return "";
  return "00000000-0000-4000-8000-000000000001";
}

function operationArgv(operation: PrimitiveOperationManifest): string[] {
  const argv: string[] = [];
  for (const parameter of [...operation.pathParams, ...operation.queryParams]) {
    if (!parameter.required) continue;
    const flag = `--${parameter.name.replace(/_/g, "-")}`;
    if (parameter.type === "boolean") argv.push(flag);
    else argv.push(flag, placeholderFor(parameter));
  }
  if (operation.hasJsonBody && operation.bodyRequired) {
    argv.push("--raw-body", "{}");
  }
  argv.push("--json");
  return argv;
}

const generatedJsonOperations = operationManifest.filter((operation) => {
  const command = COMMANDS[`${operation.tagCommand}:${operation.command}`] as
    | Runnable
    | undefined;
  return (
    command !== undefined &&
    !operation.binaryResponse &&
    command.flags !== undefined &&
    "envelope" in command.flags
  );
});

describe("generated commands with --json", () => {
  it.each(
    generatedJsonOperations.map(
      (operation) =>
        [`${operation.tagCommand}:${operation.command}`, operation] as const,
    ),
  )(
    "%s keeps the data payload as one document with empty stderr",
    async (id, operation) => {
      responder = () =>
        jsonResponse(200, {
          success: true,
          data: [],
          meta: { cursor: "cursor-2" },
        });
      const result = await runMerged(id, operationArgv(operation));
      expect(result.stderr).toBe("");
      const document = parseOne(result.merged);
      expect(result.exitCode, JSON.stringify(document)).toBe(0);
      // The same stdout shape as without --json: the bare data payload.
      expect(document).toEqual([]);
      const enveloped = await runMerged(id, [
        ...operationArgv(operation),
        "--envelope",
      ]);
      expect(enveloped.stderr).toBe("");
      expect(enveloped.exitCode).toBe(0);
      expect(parseOne(enveloped.merged)).toMatchObject({
        data: [],
        meta: { cursor: "cursor-2" },
      });
    },
  );

  it("drops the cursor line under --json and keeps it in --envelope", async () => {
    responder = () =>
      jsonResponse(200, {
        success: true,
        data: [],
        meta: { cursor: "cursor-2" },
      });
    const bare = await runMerged("emails:list", ["--json"]);
    expect(bare.exitCode).toBe(0);
    expect(bare.stderr).toBe("");
    expect(parseOne(bare.merged)).toEqual([]);
    const result = await runMerged("emails:list", ["--json", "--envelope"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const document = parseOne(result.merged) as Record<string, unknown>;
    expect(document).toMatchObject({
      success: true,
      data: [],
      meta: { cursor: "cursor-2" },
    });
    expect(document.summary).toContain("No inbound emails received yet");
  });

  it("keeps the data-only output and stderr cursor without --json", async () => {
    responder = () =>
      jsonResponse(200, {
        success: true,
        data: [{ id: "sent-1" }],
        meta: { cursor: "cursor-2" },
      });
    const result = await runMerged("sent:list", []);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ id: "sent-1" }]);
    expect(result.stderr).toBe("next cursor: cursor-2\n");
  });
});

function sentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "sent-1",
    status: "queued",
    from: "agent@example.com",
    queue_id: "q-1",
    accepted: ["alice@example.com"],
    rejected: [],
    client_idempotency_key: "key-1",
    request_id: "req-1",
    content_hash: "hash-1",
    idempotent_replay: false,
    ...overrides,
  };
}

describe("send and reply envelopes", () => {
  it("send --json carries sent_email_id and the key the request used", async () => {
    responder = (url, init) => {
      const key = new Headers(init?.headers).get("Idempotency-Key");
      if (url.pathname.endsWith("/send-mail")) {
        return jsonResponse(200, {
          success: true,
          data: sentRecord({ client_idempotency_key: key }),
        });
      }
      return serverError(url, init);
    };
    const result = await runMerged("send", [
      "--to",
      "alice@example.com",
      "--from",
      "agent@example.com",
      "--body",
      "hello",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const envelope = parseOne(result.merged) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      outcome: "sent",
      sent_email_id: "sent-1",
      idempotency_key: expect.stringMatching(/^primitive-send-[0-9a-f]{64}$/),
    });
    const sendCall = fetchCalls.find((call) =>
      call.url.pathname.endsWith("/send-mail"),
    );
    expect(new Headers(sendCall?.init?.headers).get("Idempotency-Key")).toBe(
      envelope.idempotency_key,
    );
  });

  it("send --json reports the key on an uncertain outcome", async () => {
    const result = await runMerged("send", [
      "--to",
      "alice@example.com",
      "--from",
      "agent@example.com",
      "--body",
      "hello",
      "--idempotency-key",
      "retry-key-1",
      "--json",
    ]);
    expect(result.exitCode).toBe(4);
    expect(result.stderr).toBe("");
    const envelope = parseOne(result.merged) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      outcome: "uncertain",
      sent_email_id: null,
      idempotency_key: "retry-key-1",
      follow_up_commands: expect.arrayContaining([
        expect.objectContaining({
          argv: [
            "primitive",
            "sent",
            "get",
            "--idempotency-key",
            "retry-key-1",
          ],
        }),
      ]),
    });
  });

  it("derives the same key for an identical retry, with or without --wait", async () => {
    const keys: string[] = [];
    responder = (url, init) => {
      if (url.pathname.endsWith("/send-mail")) {
        keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      }
      return serverError(url, init);
    };
    const base = [
      "--to",
      "alice@example.com",
      "--from",
      "agent@example.com",
      "--body",
      "hello",
      "--json",
    ];
    await runMerged("send", base);
    await runMerged("send", [...base, "--wait"]);
    await runMerged("send", [...base.slice(0, 5), "different", "--json"]);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("derives keys per five-minute window, like the API's own key", async () => {
    const { deriveSendIdempotencyKey, DERIVED_IDEMPOTENCY_WINDOW_MS } =
      await import("../../src/oclif/send-outcome.js");
    const body = { to: "alice@example.com", body_text: "status ok" };
    const start = 10 * DERIVED_IDEMPOTENCY_WINDOW_MS;
    // A retry inside the window is the same send.
    expect(deriveSendIdempotencyKey("send", body, start)).toBe(
      deriveSendIdempotencyKey("send", body, start + 60_000),
    );
    // A deliberate repeat in a later window is a new send.
    expect(deriveSendIdempotencyKey("send", body, start)).not.toBe(
      deriveSendIdempotencyKey(
        "send",
        body,
        start + DERIVED_IDEMPOTENCY_WINDOW_MS,
      ),
    );
    // Different replies to one email are separate sends, as without a key.
    const reply = (body_text: string) =>
      deriveSendIdempotencyKey(
        "reply",
        { body_text, in_reply_to_email_id: "email-1" },
        start,
      );
    expect(reply("first")).not.toBe(reply("second"));
  });

  it("rejects an invalid --idempotency-key before sending", async () => {
    const result = await runMerged("send", [
      "--to",
      "alice@example.com",
      "--from",
      "agent@example.com",
      "--body",
      "hello",
      "--idempotency-key",
      "has space",
      "--json",
    ]);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe("");
    expect(parseOne(result.merged)).toMatchObject({
      outcome: "not_sent",
      idempotency_key: null,
    });
    expect(
      fetchCalls.some((call) => call.url.pathname.endsWith("/send-mail")),
    ).toBe(false);
  });

  it("reply --json carries the identity fields on success", async () => {
    responder = (url, init) => {
      if (url.pathname.endsWith("/reply")) {
        return jsonResponse(200, { success: true, data: sentRecord() });
      }
      return serverError(url, init);
    };
    const result = await runMerged("reply", [
      "--id",
      "00000000-0000-4000-8000-000000000001",
      "--body",
      "thanks",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    const envelope = parseOne(result.merged) as Record<string, unknown>;
    expect(envelope).toMatchObject({
      outcome: "sent",
      sent_email_id: "sent-1",
      idempotency_key: expect.stringMatching(/^primitive-reply-[0-9a-f]{64}$/),
    });
    // The prior-reply lookup failed (503); that notice is a warning now.
    expect(envelope.warnings).toEqual([
      expect.stringContaining("Prior-reply check skipped"),
    ]);
  });
});

describe("sent get --idempotency-key", () => {
  const key = "primitive-send-abc";
  const summary = (id: string, createdAt: string, rowKey = key) => ({
    id,
    created_at: createdAt,
    client_idempotency_key: rowKey,
    status: "delivered",
  });

  function sentHistory(rows: unknown[]): Responder {
    return (url, init) => {
      if (url.pathname.endsWith("/sent-emails")) {
        expect(url.searchParams.get("idempotency_key")).toBe(key);
        return jsonResponse(200, {
          success: true,
          data: rows,
          meta: { cursor: null },
        });
      }
      const match = url.pathname.match(/\/sent-emails\/([^/]+)$/);
      if (match) {
        return jsonResponse(200, {
          success: true,
          data: { id: match[1], status: "delivered", body_text: "hello" },
        });
      }
      return serverError(url, init);
    };
  }

  it("prints the newest send with the key", async () => {
    responder = sentHistory([
      summary("sent-old", "2026-09-01T00:00:00.000Z"),
      summary("sent-new", "2026-09-02T00:00:00.000Z"),
      summary("sent-other", "2026-09-03T00:00:00.000Z", "other-key"),
    ]);
    const result = await runMerged("sent:get", [
      "--idempotency-key",
      key,
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseOne(result.merged)).toEqual({
      success: true,
      data: { id: "sent-new", status: "delivered", body_text: "hello" },
      meta: { idempotency_key: key, matches: 2 },
    });
  });

  it("prints only the record without --json", async () => {
    responder = sentHistory([summary("sent-1", "2026-09-01T00:00:00.000Z")]);
    const result = await runMerged("sent:get", ["--idempotency-key", key]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      id: "sent-1",
      status: "delivered",
      body_text: "hello",
    });
    expect(result.stderr).toBe("");
  });

  it("exits 1 with not_found when no send has the key", async () => {
    responder = sentHistory([]);
    const result = await runMerged("sent:get", [
      "--idempotency-key",
      key,
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toBe("");
    const document = parseOne(result.merged) as {
      error: { code: string; message: string };
    };
    expect(document.error.code).toBe("not_found");
    // Absence is not proof: no promise that a retry is safe, and never a
    // suggestion to use a new key.
    expect(document.error.message).toContain("No visible sent email");
    expect(document.error.message).toContain(
      "retry with this same --idempotency-key, never a new one",
    );
    expect(document.error.message).not.toMatch(/is safe|did not create/);
  });

  it("still gets a send by --id", async () => {
    responder = sentHistory([]);
    const result = await runMerged("sent:get", ["--id", "sent-9"]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ id: "sent-9" });
  });

  it("requires exactly one of --id and --idempotency-key", async () => {
    const neither = await runMerged("sent:get", ["--json"]);
    expect(neither.exitCode).toBe(2);
    expect(parseOne(neither.merged)).toMatchObject({ exit_code: 2 });
    const both = await runMerged("sent:get", [
      "--id",
      "sent-1",
      "--idempotency-key",
      key,
      "--json",
    ]);
    expect(both.exitCode).toBe(2);
    expect(both.stderr).toBe("");
  });
});

// Commands added for agent collaboration. Each prints exactly one JSON
// document with --json and leaves stderr empty, on success and on a
// rejected argument.
describe("collaboration commands with --json", () => {
  const emailId = "22222222-2222-4222-8222-222222222222";
  const latestId = "66666666-6666-4666-8666-666666666666";
  const threadId = "44444444-4444-4444-8444-444444444444";
  const session = "11111111-1111-4111-8111-111111111111";
  const self = "agent@example.com";
  const peer = "peer@example.com";
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../../../test-fixtures/webhook/valid-email-received.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ).email;

  function detail(id: string) {
    return {
      id,
      recipient: self,
      to_email: self,
      from_email: peer,
      from_header: peer,
      sender: peer,
      status: "completed",
      domain: "example.com",
      message_id: `<${id}@example.com>`,
      subject: "Status",
      body_text: "Where are we?",
      parsed: { ...fixture.parsed, attachments: [] },
      auth: fixture.auth,
      received_at: "2026-10-01T10:00:00.000Z",
      created_at: "2026-10-01T10:00:00.000Z",
      webhook_attempt_count: 0,
      thread_id: threadId,
      sender_connected_agent_verified: true,
      replies: [],
      reply_count: 0,
      last_replied_at: null,
    };
  }

  const notFound = () =>
    jsonResponse(404, {
      success: false,
      error: { code: "not_found", message: "Not found" },
    });

  // Reads of emails and the thread succeed; replies echo the key they were
  // sent with; anything else is not found.
  const mailApi: Responder = (url, init, request) => {
    const path = url.pathname.replace(/^\/v1/, "");
    const method = request?.method ?? "GET";
    const email = path.match(/^\/emails\/([^/]+)$/);
    if (method === "GET" && email) {
      return jsonResponse(200, { success: true, data: detail(email[1]) });
    }
    if (method === "GET" && path === `/threads/${threadId}`) {
      return jsonResponse(200, {
        success: true,
        data: {
          id: threadId,
          message_count: 2,
          created_at: "2026-10-01T00:00:00.000Z",
          latest_inbound_id: latestId,
          messages: [
            { direction: "inbound", id: emailId, from: peer },
            { direction: "inbound", id: latestId, from: peer },
          ],
        },
      });
    }
    const reply = path.match(/^\/emails\/([^/]+)\/reply$/);
    if (method === "POST" && reply) {
      const key = new Headers(init?.headers).get("Idempotency-Key");
      return jsonResponse(200, {
        success: true,
        data: sentRecord({
          id: `sent-${reply[1]}`,
          client_idempotency_key: key,
        }),
      });
    }
    return notFound();
  };

  function expectOneDocument(result: RunResult): Record<string, unknown> {
    expect(result.stderr).toBe("");
    const document = parseOne(result.merged);
    expect(parseOne(result.stdout)).toEqual(document);
    return document as Record<string, unknown>;
  }

  beforeEach(() => {
    const configDir = process.env.PRIMITIVE_CONFIG_DIR as string;
    saveConnectedAgentProfile(configDir, "work", {
      version: 1,
      auth_method: "agent_connection",
      api_key: ["pconn", "fixture", "json"].join("_"),
      api_base_url: "https://api.primitive-staging-1.com/v1",
      org_id: "33333333-3333-4333-8333-333333333333",
      agent_address: self,
      owner_address: "owner@example.com",
      invitation_hash: "a".repeat(64),
      created_at: "2026-01-01T00:00:00.000Z",
    });
    delete process.env.PRIMITIVE_API_KEY;
    delete process.env.PRIMITIVE_API_BASE_URL;
    process.env.PRIMITIVE_AGENT_PROFILE = "work";
  });

  it("emails get --brief prints the envelope as one document", async () => {
    responder = mailApi;
    const result = await runMerged("emails:get", [
      "--id",
      emailId,
      "--brief",
      "--json",
    ]);
    const document = expectOneDocument(result);
    expect(result.exitCode, JSON.stringify(document)).toBe(0);
    expect(Object.keys(document).sort()).toEqual([
      "body_text",
      "envelope",
      "subject",
    ]);
    expect(document.envelope).toMatchObject({
      email_id: emailId,
      thread_id: threadId,
    });
  });

  it.each([
    ["starts automatic working", [], 1],
    ["--no-signal skips automatic working", ["--no-signal"], 0],
  ] as const)(
    "emails get --brief %s and still prints one document",
    async (_label, extra, expected) => {
      // A member (a person), not a connected agent: only people get automatic working.
      responder = (url, init, request) => {
        const path = url.pathname.replace(/^\/v1/, "");
        if (
          (request?.method ?? "GET") !== "GET" ||
          !/^\/emails\/[^/]+$/.test(path)
        )
          return mailApi(url, init, request);
        const email = path.split("/")[2] as string;
        return jsonResponse(200, {
          success: true,
          data: { ...detail(email), sender_connected_agent_verified: false },
        });
      };
      workers.length = 0;
      const configDir = process.env.PRIMITIVE_CONFIG_DIR as string;
      claimAutoRead(configDir, {
        emailId,
        profileName: "work",
        sender: peer,
        threadId,
      });
      const result = await runMerged("emails:get", [
        "--id",
        emailId,
        "--brief",
        "--json",
        ...extra,
      ]);
      expect(result.exitCode).toBe(0);
      expectOneDocument(result);
      expect(workers).toHaveLength(expected);
      expect(readWorkingLease(configDir, emailId) !== null).toBe(
        expected === 1,
      );
      if (expected)
        expect(workers[0]).toMatchObject({
          PRIMITIVE_AUTO_SIGNAL_KIND: "working",
          PRIMITIVE_AUTO_SIGNAL_EMAIL: emailId,
          PRIMITIVE_AGENT_PROFILE: "work",
        });
    },
  );

  it("emails get --brief never starts working from an old claim on agent mail", async () => {
    responder = (url, init, request) => {
      const response = mailApi(url, init, request);
      const path = url.pathname.replace(/^\/v1/, "");
      if (
        (request?.method ?? "GET") !== "GET" ||
        !/^\/emails\/[^/]+$/.test(path)
      )
        return response;
      const email = path.split("/")[2] as string;
      return jsonResponse(200, {
        success: true,
        data: { ...detail(email), sender_connected_agent_verified: true },
      });
    };
    workers.length = 0;
    const configDir = process.env.PRIMITIVE_CONFIG_DIR as string;
    claimAutoRead(configDir, {
      emailId,
      profileName: "work",
      sender: peer,
      threadId,
    });
    const result = await runMerged("emails:get", [
      "--id",
      emailId,
      "--brief",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expectOneDocument(result);
    expect(workers).toHaveLength(0);
    expect(readWorkingLease(configDir, emailId)).toBeNull();
  });

  it("emails get --brief never starts working for mail no receiver surfaced", async () => {
    responder = mailApi;
    workers.length = 0;
    const result = await runMerged("emails:get", [
      "--id",
      emailId,
      "--brief",
      "--json",
    ]);
    expectOneDocument(result);
    expect(workers).toHaveLength(0);
  });

  it("emails get --brief reports a failed read as one document", async () => {
    responder = notFound;
    const result = await runMerged("emails:get", [
      "--id",
      emailId,
      "--brief",
      "--json",
    ]);
    expect(result.exitCode).not.toBe(0);
    expect(expectOneDocument(result)).toMatchObject({
      error: expect.anything(),
    });
  });

  it("threads mute, muted and unmute each print one document", async () => {
    responder = notFound;
    const muted = await runMerged("threads:mute", ["--id", threadId, "--json"]);
    expect(muted.exitCode).toBe(0);
    // The API answers 404 for the mute route, as a server without thread
    // mutes does, so the mute is local and the note is a warning.
    expect(expectOneDocument(muted)).toMatchObject({
      thread_id: threadId,
      muted: true,
      already_muted: false,
      stored: "local",
      warnings: [expect.stringContaining("stored locally")],
    });
    const listed = await runMerged("threads:muted", ["--json"]);
    expect(listed.exitCode).toBe(0);
    expect(expectOneDocument(listed)).toEqual([
      expect.objectContaining({ thread_id: threadId }),
    ]);
    const unmuted = await runMerged("threads:unmute", [
      "--id",
      threadId,
      "--json",
    ]);
    expect(unmuted.exitCode).toBe(0);
    expect(expectOneDocument(unmuted)).toMatchObject({
      thread_id: threadId,
      removed: true,
      muted: false,
    });
    const invalid = await runMerged("threads:mute", [
      "--id",
      "not-a-thread",
      "--json",
    ]);
    expect(invalid.exitCode).not.toBe(0);
    expect(expectOneDocument(invalid)).toMatchObject({
      error: { message: expect.stringContaining("thread UUID") },
    });
  });

  it("threads mute uses the server when it keeps mutes", async () => {
    responder = (url, _init, request) => {
      if (
        request?.method === "PUT" &&
        url.pathname === `/v1/threads/${threadId}/mute`
      )
        return jsonResponse(200, {
          success: true,
          data: {
            thread_id: threadId,
            address: self,
            muted: true,
            muted_at: "2026-10-01T00:00:00.000Z",
          },
        });
      return notFound();
    };
    const muted = await runMerged("threads:mute", ["--id", threadId, "--json"]);
    expect(muted.exitCode).toBe(0);
    expect(expectOneDocument(muted)).toEqual({
      thread_id: threadId,
      muted: true,
      scope: "address",
      stored: "server",
      address: self,
      muted_at: "2026-10-01T00:00:00.000Z",
    });
  });

  it("agent working set, get and clear each print one document", async () => {
    const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const note = (value: unknown) => ({
      address: self,
      name: "AGENT_WORKING",
      value,
      visibility: "private",
      version: "1",
      created_at: "2026-10-01T00:00:00Z",
      updated_at: "2026-10-01T00:00:00Z",
    });
    let stored: unknown = null;
    responder = (url, _init, request) => {
      if (!url.pathname.includes("/address-notes/")) return notFound();
      switch (request?.method) {
        case "PUT":
          stored = (JSON.parse(request.body ?? "{}") as { value: unknown })
            .value;
          return jsonResponse(200, { success: true, data: note(stored) });
        case "DELETE":
          // Connected agents may not delete notes; clear must not need to.
          return jsonResponse(403, {
            success: false,
            error: { code: "forbidden", message: "Not allowed" },
          });
        default:
          return stored === null
            ? notFound()
            : jsonResponse(200, { success: true, data: note(stored) });
      }
    };
    const set = await runMerged("agent:working:set", [
      "billing export: src/billing/",
      "--until",
      until,
      "--json",
    ]);
    expect(set.exitCode).toBe(0);
    expect(expectOneDocument(set)).toMatchObject({
      address: self,
      state: "active",
      claim: "billing export: src/billing/",
    });
    const got = await runMerged("agent:working:get", ["--json"]);
    expect(got.exitCode).toBe(0);
    expect(expectOneDocument(got)).toMatchObject({
      state: "active",
      claim: "billing export: src/billing/",
    });
    const cleared = await runMerged("agent:working:clear", ["--json"]);
    expect(cleared.exitCode).toBe(0);
    expect(expectOneDocument(cleared)).toEqual({
      address: self,
      cleared: true,
      method: "expired",
    });
    const none = await runMerged("agent:working:get", ["--json"]);
    expect(none.exitCode).toBe(0);
    expect(expectOneDocument(none)).toMatchObject({
      state: "none",
      claim: null,
    });
  });

  it("listen pending lists and clears notices as one document", async () => {
    await recordPendingMail(
      process.env.PRIMITIVE_CONFIG_DIR as string,
      "work",
      session,
      {
        kind: "mail",
        email_id: emailId,
        received_at: "2026-10-01T10:00:00.000Z",
        sender: peer,
        thread_id: threadId,
        in_thread: false,
        newer: null,
      },
    );
    const listed = await runMerged("listen:pending", [
      "--session",
      session,
      "--json",
    ]);
    expect(listed.exitCode).toBe(0);
    expect(expectOneDocument(listed)).toMatchObject({
      session_id: session,
      notices: [expect.objectContaining({ email_id: emailId })],
    });
    const cleared = await runMerged("listen:pending", [
      "--session",
      session,
      "--clear",
      emailId,
      "--json",
    ]);
    expect(cleared.exitCode).toBe(0);
    expect(expectOneDocument(cleared)).toMatchObject({ notices: [] });
    expect(
      readPendingMail(
        process.env.PRIMITIVE_CONFIG_DIR as string,
        "work",
        session,
      ),
    ).toEqual([]);
    const missing = await runMerged("listen:pending", ["--json"]);
    expect(missing.exitCode).not.toBe(0);
    expect(expectOneDocument(missing)).toMatchObject({
      error: { message: expect.stringContaining("--session") },
    });
  });

  it("reply --fyi reports a stable key and resends the same request", async () => {
    responder = mailApi;
    const argv = ["--id", emailId, "--fyi", "--body", "Deployed.", "--json"];
    const first = await runMerged("reply", argv);
    const second = await runMerged("reply", argv);
    const documents = [first, second].map((result) => {
      const document = expectOneDocument(result);
      expect(result.exitCode, JSON.stringify(document)).toBe(0);
      return document;
    });
    expect(documents[0]).toMatchObject({
      outcome: "sent",
      informational: true,
      sent_email_id: `sent-${emailId}`,
      idempotency_key: expect.stringMatching(/^primitive-reply-[0-9a-f]{64}$/),
    });
    expect(documents[1]?.idempotency_key).toBe(documents[0]?.idempotency_key);
    const sends = fetchCalls.filter((call) =>
      call.url.pathname.endsWith("/reply"),
    );
    expect(sends).toHaveLength(2);
    expect(new Headers(sends[0]?.init?.headers).get("Idempotency-Key")).toBe(
      documents[0]?.idempotency_key,
    );
    // Byte-identical retries, so the server replays rather than refusing
    // a different payload under the same key.
    expect(sends[1]?.body).toBe(sends[0]?.body);
    expect(JSON.parse(sends[0]?.body ?? "{}")).toMatchObject({
      attachments: [expect.objectContaining({ filename: "interaction.json" })],
    });

    const plain = await runMerged("reply", [
      "--id",
      emailId,
      "--body",
      "Deployed.",
      "--json",
    ]);
    expect(expectOneDocument(plain).idempotency_key).not.toBe(
      documents[0]?.idempotency_key,
    );
  });

  it("reply stops automatic working for the answered email before sending", async () => {
    responder = mailApi;
    const configDir = process.env.PRIMITIVE_CONFIG_DIR as string;
    claimAutoRead(configDir, {
      emailId,
      profileName: "work",
      sender: peer,
      threadId,
    });
    startWorkingLease(configDir, emailId);
    const result = await runMerged("reply", [
      "--id",
      emailId,
      "--body",
      "Done.",
      "--json",
    ]);
    expect(result.exitCode).toBe(0);
    expectOneDocument(result);
    expect(readWorkingLease(configDir, emailId)).toMatchObject({
      stop_reason: "reply",
      stopped_at: expect.any(Number),
    });
  });

  it("a refused reply keeps automatic working and restarts its renewer", async () => {
    responder = (url, init, request) =>
      (request?.method ?? "GET") === "POST" && url.pathname.endsWith("/reply")
        ? jsonResponse(422, {
            success: false,
            error: { code: "validation_error", message: "refused" },
          })
        : mailApi(url, init, request);
    workers.length = 0;
    const configDir = process.env.PRIMITIVE_CONFIG_DIR as string;
    claimAutoRead(configDir, {
      emailId,
      profileName: "work",
      sender: peer,
      threadId,
    });
    startWorkingLease(configDir, emailId);
    const result = await runMerged("reply", [
      "--id",
      emailId,
      "--body",
      "Done.",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(readWorkingLease(configDir, emailId)?.stopped_at).toBeNull();
    expect(workers).toHaveLength(1);
    expect(workers[0]).toMatchObject({
      PRIMITIVE_AUTO_SIGNAL_KIND: "working",
      PRIMITIVE_AUTO_SIGNAL_EMAIL: emailId,
    });
  });

  it("reply --thread derives the key from the resolved email", async () => {
    responder = mailApi;
    const viaThread = await runMerged("reply", [
      "--thread",
      threadId,
      "--body",
      "On it.",
      "--json",
    ]);
    const document = expectOneDocument(viaThread);
    expect(viaThread.exitCode, JSON.stringify(document)).toBe(0);
    expect(document).toMatchObject({
      outcome: "sent",
      sent_email_id: `sent-${latestId}`,
      reply_target: {
        thread_id: threadId,
        email_id: latestId,
        resolved_by: expect.any(String),
      },
    });
    const viaId = await runMerged("reply", [
      "--id",
      latestId,
      "--body",
      "On it.",
      "--json",
    ]);
    expect(expectOneDocument(viaId).idempotency_key).toBe(
      document.idempotency_key,
    );
  });

  it("send, reply and chat warn in warnings[] when another session's profile is used", async () => {
    writeMailJson(
      join(
        agentProfileDirectory(
          process.env.PRIMITIVE_CONFIG_DIR as string,
          "work",
        ),
        "setup.json",
      ),
      { session },
    );
    const warning = `Warning: This profile belongs to another session (${session.slice(0, 8)}); sending as ${self}.`;
    const sendOk: Responder = (url, init) =>
      url.pathname.endsWith("/send-mail")
        ? jsonResponse(200, {
            success: true,
            data: sentRecord({
              client_idempotency_key: new Headers(init?.headers).get(
                "Idempotency-Key",
              ),
            }),
          })
        : mailApi(url, init);
    responder = sendOk;
    const sendArgs = [
      "--to",
      peer,
      "--from",
      self,
      "--body",
      "hello",
      "--json",
    ];

    // No runtime session: no warning.
    const none = expectOneDocument(await runMerged("send", sendArgs));
    expect(none.warnings ?? []).not.toContain(warning);

    // The profile's own session: no warning.
    process.env.CLAUDE_CODE_SESSION_ID = session;
    const own = expectOneDocument(await runMerged("send", sendArgs));
    expect(own.warnings ?? []).not.toContain(warning);

    // Another session: a warning, and the send still goes out.
    process.env.CLAUDE_CODE_SESSION_ID = "99999999-9999-4999-8999-999999999999";
    const sent = await runMerged("send", sendArgs);
    const sentDocument = expectOneDocument(sent);
    expect(sent.exitCode).toBe(0);
    expect(sentDocument).toMatchObject({ outcome: "sent" });
    expect(sentDocument.warnings).toContain(warning);
    const replied = expectOneDocument(
      await runMerged("reply", ["--id", emailId, "--body", "ok", "--json"]),
    );
    expect(replied.warnings).toContain(warning);
    responder = notFound;
    const chatted = expectOneDocument(
      await runMerged("chat", [peer, "hello", "--json"]),
    );
    expect(chatted.warnings).toContain(warning);
  });

  it("send --fyi reports a stable key", async () => {
    const keys: string[] = [];
    const bodies: string[] = [];
    responder = (url, init, request) => {
      if (!url.pathname.endsWith("/send-mail")) return notFound();
      const key = new Headers(init?.headers).get("Idempotency-Key") ?? "";
      keys.push(key);
      bodies.push(request?.body ?? "");
      return jsonResponse(200, {
        success: true,
        data: sentRecord({ client_idempotency_key: key }),
      });
    };
    const argv = [
      "--to",
      peer,
      "--from",
      self,
      "--in-reply-to",
      "<parent@example.com>",
      "--fyi",
      "--body",
      "No action needed.",
      "--json",
    ];
    const first = expectOneDocument(await runMerged("send", argv));
    const second = expectOneDocument(await runMerged("send", argv));
    expect(first.idempotency_key).toMatch(/^primitive-send-[0-9a-f]{64}$/);
    expect(second.idempotency_key).toBe(first.idempotency_key);
    expect(keys).toEqual([first.idempotency_key, first.idempotency_key]);
    expect(bodies[1]).toBe(bodies[0]);
  });
});
