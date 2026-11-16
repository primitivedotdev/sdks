import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
}));

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import { buildEmailSearchQuery } from "../../src/oclif/commands/emails-poll.js";
import {
  FOCUS_ENV,
  FOCUS_SERVER_SUPPORT,
  type FocusDomain,
  focusEmptyHint,
  focusProfile,
  loadSavedFocus,
  NO_FOCUS,
  type ReadableDomains,
  resolveFocus,
  saveFocus,
} from "../../src/oclif/focus.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const SRC = resolve(import.meta.dirname, "../../src/oclif");
const ORG = "0b8f8a0e-6f4a-4c55-9d43-7d4a3b1c2e10";
const SUPPORT: FocusDomain = {
  name: "support.example.com",
  id: "11111111-1111-4111-8111-111111111111",
};
const SALES: FocusDomain = {
  name: "sales.example.com",
  id: "22222222-2222-4222-8222-222222222222",
};

type Call = { method: string; path: string; query: URLSearchParams };
let calls: Call[] = [];
let domains: FocusDomain[] = [SALES, SUPPORT];
let emails: (call: Call) => unknown[] = () => [];
let total: (call: Call) => number = () => 0;
let tempHome: string;
let configDir: string;
let previousEnv: Record<string, string | undefined>;
let auth: Record<string, unknown>;

function domainRows() {
  return domains.map((d) => ({
    id: d.id,
    org_id: ORG,
    domain: d.name,
    verified: true,
  }));
}

function client() {
  return new PrimitiveApiClient({
    apiKey: "fixture",
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      const call = {
        method: request.method,
        path: url.pathname,
        query: url.searchParams,
      };
      calls.push(call);
      if (url.pathname === "/v1/domains")
        return Response.json({ success: true, data: domainRows() });
      if (url.pathname === "/v1/emails" || url.pathname === "/v1/emails/search")
        return Response.json({
          success: true,
          data: emails(call),
          meta: { limit: 50, cursor: null, total: total(call) },
        });
      if (url.pathname === "/v1/sent-emails")
        return Response.json({
          success: true,
          data: [],
          meta: { limit: 50, cursor: null },
        });
      return Response.json(
        { success: false, error: { code: "not_found", message: "no" } },
        { status: 404 },
      );
    },
  });
}

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function run(id: string, argv: string[]) {
  const command = COMMANDS[id] as unknown as Runnable;
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previous = process.exitCode;
  process.exitCode = undefined;
  const log = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdout.push(`${String(message)}\n`);
  });
  const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout.push(String(chunk));
    return true;
  });
  const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr.push(String(chunk));
    return true;
  });
  let thrown: unknown;
  try {
    await command.run(argv, { root: CLI_ROOT });
  } catch (error) {
    thrown = error;
  } finally {
    log.mockRestore();
    out.mockRestore();
    err.mockRestore();
  }
  const exitCode = process.exitCode;
  process.exitCode = previous;
  return { exitCode, stdout: stdout.join(""), stderr: stderr.join(""), thrown };
}

function emailCalls() {
  return calls.filter((c) => c.path.startsWith("/v1/emails"));
}

const ENV_KEYS = [
  "XDG_CONFIG_HOME",
  "PRIMITIVE_AGENT_PROFILE",
  "PRIMITIVE_AGENT_ADDRESS",
  FOCUS_ENV,
];

beforeEach(() => {
  vi.clearAllMocks();
  calls = [];
  domains = [SALES, SUPPORT];
  emails = () => [];
  total = () => 0;
  previousEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const key of ENV_KEYS) delete process.env[key];
  tempHome = mkdtempSync(join(tmpdir(), "primitive-focus-"));
  process.env.XDG_CONFIG_HOME = tempHome;
  configDir = join(tempHome, "primitive");
  auth = { source: "stored", credentials: { org_id: ORG } };
  mocks.createAuthenticatedCliApiClient.mockImplementation(async () => ({
    apiClient: client(),
    auth,
    baseUrlOverridden: false,
  }));
});

afterEach(() => {
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  rmSync(tempHome, { recursive: true, force: true });
  FOCUS_SERVER_SUPPORT.inboundMany = null;
  FOCUS_SERVER_SUPPORT.sent = null;
});

function readable(list: FocusDomain[] = [SALES, SUPPORT]) {
  return async (): Promise<ReadableDomains> => ({ orgId: ORG, domains: list });
}

function memberProfile() {
  return focusProfile(configDir, {});
}

function resolveWith(
  overrides: Partial<Parameters<typeof resolveFocus>[0]> = {},
) {
  return resolveFocus({
    surface: "inbound",
    configDir,
    auth: { credentials: { org_id: ORG } },
    client: {} as never,
    flags: {},
    env: {},
    readDomains: readable(),
    ...overrides,
  });
}

describe("the one-time refusal", () => {
  it("refuses the first unfocused listing once with focus_required, then never again", async () => {
    const first = await resolveWith().catch((error: unknown) => error);
    expect(first).toMatchObject({
      code: "focus_required",
      oclif: { exit: 2 },
    });
    expect((first as Error).message).toContain(
      "sales.example.com and support.example.com",
    );
    expect((first as Error).message).toContain(
      "primitive focus set sales.example.com",
    );
    expect((first as Error).message).toContain("primitive focus set --all");
    expect((first as { details?: unknown }).details).toEqual({
      domains: ["sales.example.com", "support.example.com"],
      choices: ["primitive focus set <domain...>", "primitive focus set --all"],
    });

    const second = await resolveWith();
    expect(second.params).toEqual({});
    expect(second.meta).toMatchObject({ all: true, source: "none" });
    expect(second.line).toContain("No focus chosen");
  });

  it("never asks a credential with one domain, and saves nothing for it", async () => {
    const outcome = await resolveWith({ readDomains: readable([SUPPORT]) });
    expect(outcome).toEqual(NO_FOCUS);
    expect(existsSync(memberProfile().path)).toBe(false);
  });

  it("never asks after a choice", async () => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { all: true } }));
    const outcome = await resolveWith();
    expect(outcome.params).toEqual({});
    expect(outcome.line).toBeNull();
    expect(outcome.meta).toMatchObject({ all: true, source: "profile" });
  });

  it("asks again in another organization, whose domains differ", async () => {
    saveFocus(memberProfile(), "another-org", () => ({
      choice: { domains: [SUPPORT] },
    }));
    await expect(resolveWith()).rejects.toMatchObject({
      code: "focus_required",
    });
  });

  it("refuses emails list once with exit 2 and a focus_required JSON error", async () => {
    const first = await run("emails:list", ["--json"]);
    expect(first.exitCode).toBe(2);
    const document = JSON.parse(first.stdout);
    expect(document.error.code).toBe("focus_required");
    expect(document.exit_code).toBe(2);
    expect(first.stderr).toBe("");
    expect(emailCalls()).toHaveLength(0);

    const second = await run("emails:list", []);
    expect(second.thrown).toBeUndefined();
    expect(second.stderr).toContain("No focus chosen");
    expect(emailCalls()[0]?.query.get("domain_id")).toBeNull();
  });
});

describe("persistence", () => {
  it("saves the member login's focus in the config directory, never the credential file", async () => {
    const set = await run("focus:set", ["Support.Example.com"]);
    expect(set.thrown).toBeUndefined();
    expect(set.stdout).toContain("only support.example.com");
    expect(loadSavedFocus(memberProfile(), ORG)?.choice).toEqual({
      domains: [SUPPORT],
    });
    expect(memberProfile().path).toBe(join(configDir, "focus.json"));
    expect(existsSync(join(configDir, "credentials.json"))).toBe(false);

    const listed = await run("emails:list", []);
    expect(emailCalls()[0]?.query.get("domain_id")).toBe(SUPPORT.id);
    expect(listed.stderr).toContain(
      "Showing mail on support.example.com only (saved focus). Widen: --all-domains or primitive focus clear.",
    );
  });

  it("saves a connected agent's focus in its own profile directory", async () => {
    auth = {
      source: "connected-profile",
      credentials: null,
      connectedAgent: { profileName: "helper", orgId: ORG },
    };
    const set = await run("focus:set", ["sales.example.com"]);
    expect(set.thrown).toBeUndefined();
    const agentPath = join(
      configDir,
      "agent-connections",
      "profiles",
      "helper",
      "focus.json",
    );
    expect(
      JSON.parse(readFileSync(agentPath, "utf8")).orgs[ORG].choice,
    ).toEqual({ domains: [SALES] });
    expect(existsSync(join(configDir, "focus.json"))).toBe(false);
    const shown = await run("focus", ["--json"]);
    expect(JSON.parse(shown.stdout)).toMatchObject({
      profile: "agent profile helper",
      saved: { all: false, domains: [SALES] },
    });
  });

  it("checks names against the credential's domains and refuses unknown ones", async () => {
    const set = await run("focus:set", ["nope.example.com"]);
    expect(set.thrown).toMatchObject({
      code: "focus_domain_unknown",
      oclif: { exit: 2 },
    });
    expect((set.thrown as Error).message).toContain("nope.example.com");
    expect(existsSync(memberProfile().path)).toBe(false);
  });

  it("errors naming a saved domain that was later deleted", async () => {
    await run("focus:set", ["support.example.com"]);
    domains = [
      SALES,
      { name: "new.example.com", id: "33333333-3333-4333-8333-333333333333" },
    ];
    const listed = await run("emails:list", []);
    expect(listed.thrown).toMatchObject({
      code: "focus_domain_missing",
      oclif: { exit: 1 },
    });
    expect((listed.thrown as Error).message).toContain("support.example.com");
    expect(emailCalls()).toHaveLength(0);
  });

  it("clears the focus without asking again", async () => {
    await run("focus:set", ["--all"]);
    const cleared = await run("focus:clear", []);
    expect(cleared.stdout).toContain("Cleared the focus");
    const listed = await run("emails:list", []);
    expect(listed.thrown).toBeUndefined();
    expect(listed.stderr).toContain("No focus chosen");
  });

  it("names one domain at a time until the server takes several", async () => {
    const set = await run("focus:set", [
      "support.example.com",
      "sales.example.com",
    ]);
    expect(set.thrown).toMatchObject({ oclif: { exit: 2 } });
    expect((set.thrown as Error).message).toContain("one domain for now");
  });

  it("sends several domains once the server's parameter is named", async () => {
    FOCUS_SERVER_SUPPORT.inboundMany = "domain_id";
    await run("focus:set", ["support.example.com", "sales.example.com"]);
    await run("emails:list", []);
    expect(emailCalls()[0]?.query.getAll("domain_id").sort()).toEqual(
      [SALES.id, SUPPORT.id].sort(),
    );
  });
});

describe("overrides", () => {
  beforeEach(() => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { domains: [SUPPORT] } }));
  });

  it("the session variable beats the saved focus", async () => {
    const outcome = await resolveWith({
      env: { [FOCUS_ENV]: "sales.example.com" },
    });
    expect(outcome.params).toEqual({ domain_id: SALES.id });
    expect(outcome.meta?.source).toBe("env");
    expect(outcome.line).toContain(`from ${FOCUS_ENV}`);
  });

  it("the session variable can widen to every domain", async () => {
    const outcome = await resolveWith({ env: { [FOCUS_ENV]: "all" } });
    expect(outcome.params).toEqual({});
    expect(outcome.meta).toMatchObject({ all: true, source: "env" });
  });

  it("--domain beats the session variable, and --all-domains beats both", async () => {
    process.env[FOCUS_ENV] = "support.example.com";
    await run("emails:list", ["--domain", "sales.example.com"]);
    expect(emailCalls()[0]?.query.get("domain_id")).toBe(SALES.id);
    calls = [];
    const wide = await run("emails:list", ["--all-domains", "--json"]);
    expect(emailCalls()[0]?.query.get("domain_id")).toBeNull();
    expect(JSON.parse(wide.stdout).meta.focus).toMatchObject({
      all: true,
      source: "flag",
    });
  });

  it("a command's own scope wins over the saved focus", async () => {
    await run("emails:list", ["--recipient", "a@sales.example.com"]);
    expect(emailCalls()[0]?.query.get("domain_id")).toBeNull();
    const outcome = await resolveWith({ explicitScope: true });
    expect(outcome).toEqual(NO_FOCUS);
  });

  it("refuses --domain with --domain-id", async () => {
    const result = await run("emails:list", [
      "--domain",
      "sales.example.com",
      "--domain-id",
      SUPPORT.id,
    ]);
    expect(result.thrown).toMatchObject({ oclif: { exit: 2 } });
    expect(emailCalls()).toHaveLength(0);
  });
});

describe("visibility", () => {
  beforeEach(() => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { domains: [SUPPORT] } }));
    emails = () => [
      { id: "e-1", sender: "a@b.c", recipient: "x@support.example.com" },
    ];
  });

  it("prints one focus line on stderr in text mode", async () => {
    const result = await run("emails:latest", []);
    expect(emailCalls()[0]?.query.get("domain_id")).toBe(SUPPORT.id);
    expect(
      result.stderr.split("\n").filter((l) => l.startsWith("Showing mail on")),
    ).toEqual([
      "Showing mail on support.example.com only (saved focus). Widen: --all-domains or primitive focus clear.",
    ]);
  });

  it("carries meta.focus under --json with nothing on stderr", async () => {
    const result = await run("emails:list", ["--json"]);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout).meta.focus).toEqual({
      domains: ["support.example.com"],
      all: false,
      source: "profile",
      applied: true,
      widen: ["--all-domains", "primitive focus clear"],
    });
  });

  it("filters search and emails search by the focused domain", async () => {
    await run("search", ["invoice"]);
    await run("emails:search", ["--q", "invoice"]);
    const searches = calls.filter((c) => c.path === "/v1/emails/search");
    expect(searches.map((c) => c.query.get("domain_id"))).toEqual([
      SUPPORT.id,
      SUPPORT.id,
    ]);
  });

  it("reports the focus as not applied on sent list until the server filters it", async () => {
    const result = await run("sent:list", ["--json"]);
    const sent = calls.find((c) => c.path === "/v1/sent-emails");
    expect([...(sent?.query.keys() ?? [])]).not.toContain("domain_id");
    expect(JSON.parse(result.stdout).meta.focus).toMatchObject({
      applied: false,
      domains: ["support.example.com"],
    });
    const text = await run("sent:list", []);
    expect(text.stderr).toContain("not applied");
    const flagged = await run("sent:list", ["--domain", "support.example.com"]);
    expect(flagged.thrown).toMatchObject({ oclif: { exit: 2 } });
  });

  it("sends the sent-list filter once its parameter is named", async () => {
    FOCUS_SERVER_SUPPORT.sent = "domain_id";
    await run("sent:list", []);
    const sent = calls.find((c) => c.path === "/v1/sent-emails");
    expect(sent?.query.get("domain_id")).toBe(SUPPORT.id);
  });
});

describe("empty focused results", () => {
  beforeEach(() => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { domains: [SUPPORT] } }));
    emails = () => [];
    total = (call) => (call.query.get("domain_id") ? 0 : 7);
  });

  it("says how much matching mail the other domains hold", async () => {
    const result = await run("emails:list", ["--status", "completed"]);
    const counted = emailCalls()[1];
    expect(counted?.query.get("domain_id")).toBeNull();
    expect(counted?.query.get("status")).toBe("completed");
    expect(counted?.query.get("count")).toBe("true");
    expect(result.stderr).toContain(
      "Nothing matched on support.example.com; 7 matching emails on other domains. Pass --all-domains to see them.",
    );
  });

  it("puts the note in the JSON summary", async () => {
    const result = await run("search", ["invoice", "--json"]);
    expect(JSON.parse(result.stdout).summary).toContain("7 matching emails");
  });

  it("does not count when the result was not focused", async () => {
    await run("emails:list", ["--all-domains"]);
    expect(emailCalls()).toHaveLength(1);
  });

  it("words the hint for nothing elsewhere and for an unreadable count", async () => {
    const outcome = await resolveWith();
    expect(await focusEmptyHint(outcome, async () => 0)).toContain(
      "nothing matches on the other domains either",
    );
    expect(await focusEmptyHint(outcome, async () => null)).toContain(
      "pass --all-domains to look",
    );
    expect(await focusEmptyHint(NO_FOCUS, async () => 3)).toBeNull();
  });
});

describe("exemptions", () => {
  it("never reads the focus in notifications, reads by id or bookkeeping", () => {
    for (const file of [
      "commands/listen.ts",
      "commands/wait.ts",
      "commands/emails-wait.ts",
      "commands/agent-check-mail.ts",
      "commands/chat.ts",
      "commands/emails-get.ts",
      "commands/reply.ts",
      "listen-runner.ts",
      "listen-notifications.ts",
      "scoped-email-wait.ts",
      "reply-state.ts",
      "shared-mail-state.ts",
      "targeted-replies.ts",
      "connected-reply-wait.ts",
      "agent-setup.ts",
    ]) {
      expect(readFileSync(join(SRC, file), "utf8"), file).not.toMatch(
        /focus\.js/,
      );
    }
  });

  it("leaves the shared search poll unfocused unless a listing asks", () => {
    const query = buildEmailSearchQuery({ filters: {}, pageSize: 10 });
    expect(query).not.toHaveProperty("domain_id");
  });

  it("does not focus a read by id", async () => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { domains: [SUPPORT] } }));
    await run("emails:get", ["--id", "44444444-4444-4444-8444-444444444444"]);
    expect(calls.some((c) => c.path === "/v1/domains")).toBe(false);
  });
});

describe("poll loops and inbox listings", () => {
  beforeEach(() => {
    saveFocus(memberProfile(), ORG, () => ({ choice: { domains: [SUPPORT] } }));
    emails = () => [];
    total = (call) => (call.query.get("domain_id") ? 0 : 2);
  });

  it("inbox next lists only the focused domain and reports the focus", async () => {
    const result = await run("inbox:next", ["--json"]);
    const listed = emailCalls().filter(
      (c) => c.query.get("awaiting") === "you",
    );
    expect(listed.length).toBeGreaterThan(0);
    expect(
      listed
        .filter((c) => c.query.get("count") !== "true")
        .every((c) => c.query.get("domain_id") === SUPPORT.id),
    ).toBe(true);
    expect(JSON.parse(result.stdout).focus).toMatchObject({
      domains: ["support.example.com"],
      source: "profile",
    });
  });

  it("emails watch filters by the focus and notes mail elsewhere once", async () => {
    const result = await run("emails:watch", [
      "--seconds",
      "3",
      "--interval",
      "1",
    ]);
    const polls = calls.filter(
      (c) => c.path === "/v1/emails/search" && c.query.get("limit") !== "1",
    );
    expect(polls.length).toBeGreaterThan(1);
    expect(polls.every((c) => c.query.get("domain_id") === SUPPORT.id)).toBe(
      true,
    );
    expect(
      result.stderr.match(/matching emails on other domains/g),
    ).toHaveLength(1);
    expect(result.stderr).toContain("Showing mail on support.example.com only");
  }, 10_000);
});
