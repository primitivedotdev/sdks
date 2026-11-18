import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// These tests pin each command's requests without a domain focus;
// focus.test.ts covers the focus and the GET /domains read it makes.
vi.mock("../../src/oclif/focus.js", async (original) => {
  const actual = await original<typeof import("../../src/oclif/focus.js")>();
  return { ...actual, resolveFocus: async () => actual.NO_FOCUS };
});

import { saveConnectedAgentProfile } from "../../src/oclif/connected-agent-profile.js";
import {
  suggestFlag,
  withFlagSuggestion,
} from "../../src/oclif/flag-suggestions.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const self = "agent@example.test";
const peer = "peer-agent@example.test";
const session = "11111111-1111-4111-8111-111111111111";
const emailId = "22222222-2222-4222-8222-222222222222";

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

type RunResult = { exitCode: number; stderr: string; stdout: string };

let responder: (url: URL) => Response = () => new Response(null);
let fetchCalls: URL[] = [];
let savedEnv: Record<string, string | undefined> = {};
let tempHome = "";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status,
  });
}

async function run(id: string, argv: string[]): Promise<RunResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const spies = [
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      stdout.push(String(chunk));
      return true;
    }),
    vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => {
      stderr.push(String(chunk));
      return true;
    }),
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      stdout.push(`${args.map(String).join(" ")}\n`);
    }),
  ];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  let thrown: unknown;
  try {
    await (COMMANDS[id] as unknown as Runnable).run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
  const exitCode =
    thrown === undefined
      ? typeof process.exitCode === "number"
        ? process.exitCode
        : 0
      : ((thrown as { oclif?: { exit?: number } }).oclif?.exit ?? 1);
  process.exitCode = previousExitCode;
  const errorText =
    thrown instanceof Error &&
    !(thrown as { skipOclifErrorHandling?: boolean }).skipOclifErrorHandling
      ? `${thrown.message}\n`
      : "";
  return {
    exitCode,
    stderr: (stderr.join("") + errorText)
      .split("\n")
      .filter((line) => !/^\(node:\d+\) |^\(Use `node --trace-/.test(line))
      .join("\n"),
    stdout: stdout.join(""),
  };
}

function connect(name: string, address: string) {
  saveConnectedAgentProfile(process.env.PRIMITIVE_CONFIG_DIR as string, name, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", name].join("_"),
    api_base_url: "https://api.primitive-staging-1.com/v1",
    org_id: "33333333-3333-4333-8333-333333333333",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

beforeEach(() => {
  savedEnv = {};
  for (const name of Object.keys(process.env))
    if (["PRIMITIVE_", "CLAUDE", "CODEX"].some((p) => name.startsWith(p))) {
      savedEnv[name] = process.env[name];
      delete process.env[name];
    }
  tempHome = mkdtempSync(join(tmpdir(), "primitive-recipient-clarity-"));
  for (const [name, value] of Object.entries({
    HOME: tempHome,
    XDG_CONFIG_HOME: join(tempHome, "config"),
    PRIMITIVE_CONFIG_DIR: join(tempHome, "config", "primitive"),
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  })) {
    if (!(name in savedEnv)) savedEnv[name] = process.env[name];
    process.env[name] = value;
  }
  connect("work", self);
  process.env.PRIMITIVE_AGENT_PROFILE = "work";
  fetchCalls = [];
  responder = () =>
    jsonResponse(503, {
      success: false,
      error: { code: "service_unavailable", message: "unavailable" },
    });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
      );
      fetchCalls.push(url);
      return responder(url);
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

describe("emails get --id", () => {
  it("rejects an id that is not a UUID before calling the API", async () => {
    for (const argv of [
      ["--id", "not-a-uuid"],
      ["--id", "not-a-uuid", "--context"],
    ]) {
      const result = await run("emails:get", argv);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("--id must be an email UUID");
      expect(result.stderr).not.toContain("agent_connection_scope_forbidden");
    }
    expect(fetchCalls).toEqual([]);
  });

  it("names the session's other address when the email is not found", async () => {
    connect(`session-${session}`, peer);
    process.env.CLAUDE_CODE_SESSION_ID = session;
    responder = () =>
      jsonResponse(404, {
        success: false,
        error: { code: "not_found", message: "Email not found" },
      });
    const result = await run("emails:get", ["--id", emailId]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      `Email ${emailId} was not found for ${self} (profile work); an email is readable only under the profile that received it. This session also receives for: ${peer} (profile session-${session}): PRIMITIVE_AGENT_PROFILE=session-${session} primitive emails get --id ${emailId} --context.`,
    );
    expect(result.stderr).not.toContain("pconn_");
    // The hint never reads the email with another profile's credential.
    expect(fetchCalls).toHaveLength(1);
  });
});

describe("unknown flags", () => {
  it("names the free-text flag for emails search --query", async () => {
    const result = await run("emails:search", ["--query", "invoice"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Nonexistent flag: --query");
    expect(result.stderr).toContain(
      "--query is not a flag here; did you mean --q (the free-text query)?",
    );
    expect(fetchCalls).toEqual([]);
  });

  it("suggests the closest flag for a typo and nothing for an unrelated word", () => {
    const valid = ["q", "from", "to", "subject", "limit", "date-from"];
    expect(suggestFlag("--query", valid)).toBe("q");
    expect(suggestFlag("--subjct", valid)).toBe("subject");
    expect(suggestFlag("--limt=5", valid)).toBe("limit");
    expect(suggestFlag("--datefrom", valid)).toBe("date-from");
    expect(suggestFlag("--colour", valid)).toBeNull();
    expect(suggestFlag("--query", ["from", "to"])).toBeNull();
  });

  it("suggests renamed and distinct sample flags only when the target is available", () => {
    for (const [input, target] of [
      ["evaluation-scope", "scope"],
      ["expectation-samples-file", "samples-file"],
      ["add-expectation-samples-file", "add-samples-file"],
      ["samples-file", "expect-samples-file"],
      ["expect-samples-file", "samples-file"],
    ]) {
      expect(suggestFlag(`--${input}`, [target]), input).toBe(target);
      expect(suggestFlag(`--${input}`, ["id", "json"]), input).toBeNull();
    }
    expect(
      suggestFlag("--samples-file", ["samples-file", "expect-samples-file"]),
    ).toBe("samples-file");
    expect(
      suggestFlag("--expect-samples-file", [
        "samples-file",
        "expect-samples-file",
      ]),
    ).toBe("expect-samples-file");
  });

  it("rejects repaired flags and prints the available replacement in parser JSON", async () => {
    for (const [id, input, value, target, meaning] of [
      ["email-rules:create", "evaluation-scope", "author", "scope", ""],
      [
        "email-rules:create",
        "expectation-samples-file",
        "absent.json",
        "samples-file",
        "samples saved on the rule",
      ],
      [
        "email-rules:update",
        "add-expectation-samples-file",
        "absent.json",
        "add-samples-file",
        "",
      ],
      [
        "email-rules:test",
        "samples-file",
        "absent.json",
        "expect-samples-file",
        "one-off test samples",
      ],
      [
        "email-rules:create",
        "expect-samples-file",
        "absent.json",
        "samples-file",
        "samples saved on the rule",
      ],
    ]) {
      const result = await run(id, [`--${input}`, value, "--json"]);
      expect(result.exitCode, id).toBe(2);
      expect(result.stderr, id).toBe("");
      const document = JSON.parse(result.stdout);
      expect(document.error.message, id).toContain(
        `Nonexistent flag: --${input}`,
      );
      expect(document.error.message, id).toContain(`did you mean --${target}`);
      if (meaning) expect(document.error.message, id).toContain(meaning);
    }
    expect(fetchCalls).toEqual([]);
  });

  it("leaves other errors unchanged", () => {
    const error = new Error("Missing required flag id");
    expect(withFlagSuggestion(error, ["id"])).toBe(error);
    expect(error.message).toBe("Missing required flag id");
  });
});

describe("sent list", () => {
  const rows = [
    {
      id: "s1",
      from_address: self,
      to_address: "pat@example.test",
      status: "delivered",
      created_at: "2026-11-10T12:34:56.000Z",
      subject: "Hello\u001b[2J there",
    },
  ];
  const answer = (applied: boolean) =>
    jsonResponse(200, {
      success: true,
      data: rows,
      meta: {
        cursor: null,
        mine: { applied, addresses: applied ? [self] : [] },
      },
    });

  it("asks for your own sends unless --all-senders, and keeps a mine given", async () => {
    responder = () => answer(true);
    await run("sent:list", []);
    await run("sent:list", ["--all-senders"]);
    await run("sending:list", ["--mine", "false"]);
    expect(fetchCalls.map((url) => url.searchParams.get("mine"))).toEqual([
      "true",
      null,
      "false",
    ]);
  });

  it("prints whose sends these are and a table, sender first, after the JSON", async () => {
    responder = () => answer(true);
    const result = await run("sent:list", []);
    expect(JSON.parse(result.stdout)).toEqual(rows);
    const lines = result.stderr.trimEnd().split("\n");
    expect(lines[0]).toBe(
      `Sends from your own addresses (${self}). --all-senders lists every send you can read.`,
    );
    expect(lines[1]).toMatch(
      /^FROM\s+TO\s+STATUS\s+WHEN \(UTC\)\s+SUBJECT\s+ID$/,
    );
    expect(lines[2]).toMatch(
      /^agent@example\.test\s+pat@example\.test\s+delivered\s+2026-11-10 12:34\s+Hello there\s+s1$/,
    );
    responder = () => answer(false);
    const all = await run("sent:list", []);
    expect(all.stderr).not.toContain("Sends from your own addresses");
  });

  it("adds nothing under --json, where meta.mine and from_address say it", async () => {
    responder = () => answer(true);
    const result = await run("sent:list", ["--json"]);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toMatchObject({
      data: rows,
      meta: { mine: { applied: true } },
    });
  });
});
