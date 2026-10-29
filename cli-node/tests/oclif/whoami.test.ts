import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";
import { appendRegistrationLog } from "../../src/oclif/registration-log.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), account: vi.fn() }));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.auth,
}));
vi.mock("@primitivedotdev/api-core", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/api-core")>()),
  getAccount: mocks.account,
}));

import WhoamiCommand, {
  formatWhoamiSummary,
} from "../../src/oclif/commands/whoami.js";
import { COMMANDS } from "../../src/oclif/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  process.exitCode = undefined;
});

const offline = () => {
  const fetchMock = vi.fn(async () => {
    throw new TypeError("fetch failed");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

function connectionRecord(status: string, address = "agent@example.test") {
  return new Response(
    JSON.stringify({
      success: true,
      data: { connection: { address, status } },
    }),
    { status: 200 },
  );
}

/** Answer /agent-connections/me with each response in turn. */
function serverAnswers(...responses: Array<() => Response>) {
  const fetchMock = vi.fn(async (input: unknown) => {
    expect(String(input)).toMatch(/\/agent-connections\/me$/);
    const next = responses.shift();
    if (!next) throw new Error("unexpected extra request");
    return next();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function connectedAuth(credential = ["pconn", "test"].join("_")) {
  return {
    apiClient: { client: {} },
    auth: {
      apiKey: credential,
      connectedAgent: {
        profileName: "work",
        agentAddress: "agent@example.test",
        ownerAddress: "owner@example.test",
        ownerMemberAddress: null,
        apiBaseUrl: "https://api.primitive.dev/v1",
        orgId: "org-1",
      },
    },
  };
}

async function runWhoami(argv: string[]): Promise<string> {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value: unknown) => {
    output.push(String(value));
  });
  await WhoamiCommand.run(argv, {
    root: resolve(import.meta.dirname, "../.."),
  });
  return output.join("\n");
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: "acct-1",
    email: "cli@example.com",
    plan: "pro",
    created_at: "2026-05-25T00:00:00.000Z",
    onboarding_completed: false,
    onboarding_step: "dns",
    stripe_subscription_status: "trialing",
    subscription_current_period_end: "2026-06-25T00:00:00.000Z",
    subscription_cancel_at_period_end: false,
    spam_threshold: null,
    discard_content_on_webhook_confirmed: false,
    webhook_secret_rotated_at: null,
    ...overrides,
  } as never;
}

describe("whoami command", () => {
  it("registers the credentials smoke-test command", () => {
    expect(COMMANDS.whoami).toBe(WhoamiCommand);
  });

  it("exposes explicit JSON output for raw account fields", () => {
    const flags = WhoamiCommand.flags as Record<string, unknown>;
    expect(flags.json).toBeDefined();
  });

  it("formats a concise summary without setup or billing internals", () => {
    const output = formatWhoamiSummary(makeAccount(), null);

    expect(output).toContain("Authenticated as cli@example.com");
    expect(output).toContain("Organization id: acct-1");
    expect(output).toContain("Plan: pro");
    expect(output).not.toContain("onboarding");
    expect(output).not.toContain("stripe");
    expect(output).not.toContain("webhook");
    expect(output).not.toContain("Managed inbox");
  });

  it("names the organization when the saved login recorded its name", () => {
    const output = formatWhoamiSummary(makeAccount(), null, "Acme Agents");

    expect(output).toContain("Organization: Acme Agents (acct-1)");
    expect(output).not.toContain("Organization id:");
  });

  it.each([
    [
      "the saved login's organization",
      "acct-1",
      "Organization: Acme Agents (acct-1)",
      "Acme Agents",
    ],
    [
      "another organization's saved login",
      "org-other",
      "Organization id: acct-1",
      null,
    ],
    ["no saved login (an API key)", null, "Organization id: acct-1", null],
  ])(
    "names the organization from %s in text and JSON",
    async (_case, savedOrgId, line, jsonName) => {
      mocks.auth.mockResolvedValue({
        apiClient: { client: {} },
        auth: {
          credentials: savedOrgId
            ? { org_id: savedOrgId, org_name: "Acme Agents" }
            : null,
        },
        baseUrlOverridden: false,
      });
      mocks.account.mockResolvedValue({ data: { data: makeAccount() } });
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((value: unknown) => {
        output.push(String(value));
      });
      const root = resolve(import.meta.dirname, "../..");
      await WhoamiCommand.run([], { root });
      expect(output.join("\n")).toContain(line);
      output.length = 0;
      await WhoamiCommand.run(["--json"], { root });
      const json = JSON.parse(output.join("\n"));
      expect(json.org_name).toBe(jsonName);
      // The account payload passes through unchanged beside the new field.
      expect(json).toMatchObject({
        id: "acct-1",
        email: "cli@example.com",
        plan: "pro",
      });
    },
  );

  it("includes the managed inbox line when a managed domain is present", () => {
    const output = formatWhoamiSummary(
      makeAccount(),
      "crisp-crane.primitive.email",
    );

    expect(output).toContain(
      "Managed inbox: any-local-part@crisp-crane.primitive.email",
    );
  });

  it.each([true, false])(
    "keeps the saved identity, labelled offline, when Primitive cannot be reached (json %s)",
    async (json) => {
      const fetchMock = offline();
      const credential = ["pconn", "test"].join("_");
      mocks.auth.mockResolvedValue({
        apiClient: { client: {} },
        auth: {
          apiKey: credential,
          connectedAgent: {
            profileName: "work",
            agentAddress: "agent@example.test",
            ownerAddress: "owner@example.test",
            ownerMemberAddress: "ada_123456789@example.test",
            apiBaseUrl: "https://api.primitive-staging-1.com/v1",
            orgId: "org-1",
          },
        },
      });
      const output: string[] = [];
      vi.spyOn(console, "log").mockImplementation((value: unknown) => {
        output.push(String(value));
      });
      await WhoamiCommand.run(json ? ["--json"] : [], {
        root: resolve(import.meta.dirname, "../.."),
      });
      const text = output.join("\n");
      expect(mocks.account).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
      expect(text).toContain("Primitive could not be reached");
      expect(text).toContain("agent@example.test");
      expect(text).toContain(
        "primitive agent connect --profile work --status --json",
      );
      expect(text).toContain("not verified");
      expect(text).toContain("ada_123456789@example.test");
      if (!json)
        expect(text).toContain(
          "Owner personal address (send reports here): ada_123456789@example.test",
        );
      expect(text).not.toContain(credential);
      if (json)
        expect(JSON.parse(text)).toMatchObject({
          verification: "offline",
          offline_reason: "unreachable",
          auth_method: "agent_connection",
        });
    },
  );

  it.each([true, false])(
    "reports a connection Primitive accepts as live (json %s)",
    async (json) => {
      serverAnswers(() => connectionRecord("connected"));
      mocks.auth.mockResolvedValue(connectedAuth());
      const text = await runWhoami(json ? ["--json"] : []);
      expect(process.exitCode).toBeUndefined();
      expect(text.split("\n")[0]).toBe(json ? "{" : "agent@example.test");
      expect(text).toContain("Primitive accepted this connection.");
      if (json)
        expect(JSON.parse(text)).toMatchObject({
          address: "agent@example.test",
          verification: "live",
          connection_state: "connected",
        });
      expect(mocks.account).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["a confirmed 401", () => new Response("{}", { status: 401 })],
    ["a revoked record", () => connectionRecord("revoked")],
  ] as const)(
    "says the connection was revoked and exits 1 on %s",
    async (_label, confirm) => {
      const credential = ["pconn", "revoked"].join("_");
      for (const json of [false, true]) {
        serverAnswers(() => new Response("{}", { status: 401 }), confirm);
        mocks.auth.mockResolvedValue(connectedAuth(credential));
        const text = await runWhoami(json ? ["--json"] : []);
        expect(process.exitCode).toBe(1);
        expect(text).not.toContain(credential);
        expect(text).toContain("connection was revoked");
        if (json)
          expect(JSON.parse(text)).toMatchObject({
            address: "agent@example.test",
            profile: "work",
            verification: "revoked",
          });
        else
          expect(text).toContain(
            "Primitive no longer accepts the connection for agent@example.test.",
          );
        process.exitCode = undefined;
      }
    },
  );

  it("does not call a single refused request a revocation", async () => {
    serverAnswers(
      () => new Response("{}", { status: 401 }),
      () => connectionRecord("connected"),
    );
    mocks.auth.mockResolvedValue(connectedAuth());
    const text = await runWhoami(["--json"]);
    expect(process.exitCode).toBeUndefined();
    expect(JSON.parse(text)).toMatchObject({
      verification: "offline",
      offline_reason: "unconfirmed",
    });
  });

  it.each([
    [
      "external",
      "Inspect the Claude hook receiver with `primitive agent connect --profile work --status --json`.",
    ],
    [
      "native",
      `Inspect the receiver with \`PRIMITIVE_AGENT_PROFILE=work primitive listen --status --notify-session ${session}\`.`,
    ],
  ])(
    "points a %s receiver at the status command for its mode",
    async (receiverMode, hint) => {
      offline();
      const directory = mkdtempSync(join(tmpdir(), "primitive-whoami-"));
      try {
        vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
        writeMailJson(
          join(agentProfileDirectory(directory, "work"), "setup.json"),
          { session, receiverMode },
        );
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: {
            apiKey: ["pconn", "test"].join("_"),
            connectedAgent: {
              profileName: "work",
              agentAddress: "agent@example.test",
              ownerAddress: "owner@example.test",
              ownerMemberAddress: null,
              apiBaseUrl: "https://api.primitive.dev/v1",
              orgId: "org-1",
            },
          },
        });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run(["--json"], {
          root: resolve(import.meta.dirname, "../.."),
        });
        const { guidance } = JSON.parse(output.join("\n"));
        expect(guidance).toContain(hint);
        if (receiverMode === "external")
          expect(guidance).not.toContain("listen --status");
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it.each([
    [{}, "env"],
    [
      {
        CLAUDE_CODE_SESSION_ID: session,
        PRIMITIVE_AGENT_ADDRESS: "agent@example.test",
      },
      "session_hook",
    ],
  ] as const)(
    "prints the agent address first and names where the identity came from (%j)",
    async (env, source) => {
      offline();
      for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      try {
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: {
            apiKey: ["pconn", "test"].join("_"),
            connectedAgent: {
              profileName: `session-${session}`,
              agentAddress: "agent@example.test",
              ownerAddress: "owner@example.test",
              ownerMemberAddress: null,
              apiBaseUrl: "https://api.primitive.dev/v1",
              orgId: "org-1",
            },
          },
        });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run([], {
          root: resolve(import.meta.dirname, "../.."),
        });
        await WhoamiCommand.run(["--json"], {
          root: resolve(import.meta.dirname, "../.."),
        });
        expect(output[0].split("\n")[0]).toBe("agent@example.test");
        expect(JSON.parse(output[1])).toMatchObject({
          address: "agent@example.test",
          profile: `session-${session}`,
          source,
        });
        expect(mocks.account).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllEnvs();
      }
    },
  );

  it.each([true, false])(
    "names this session's failed registration under the member login (json %s)",
    async (json) => {
      const directory = mkdtempSync(join(tmpdir(), "primitive-whoami-"));
      try {
        vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
        vi.stubEnv("CLAUDE_CODE_SESSION_ID", session);
        appendRegistrationLog(directory, `session-${session}`, {
          event: "failed",
          phase: "setup_attempted",
          code: "setup_unfinished",
          orgId: "org-1",
          address: "pending@example.test",
          detail:
            "This session's agent pending@example.test is created but not connected: in the Primitive app open it and choose Copy again, then paste that setup instruction here; `agent connect` finishes the same address.",
        });
        mocks.auth.mockResolvedValue({
          apiClient: { client: {} },
          auth: { apiKey: undefined },
          baseUrlOverridden: false,
        });
        mocks.account.mockResolvedValue({ data: { data: makeAccount() } });
        const output: string[] = [];
        vi.spyOn(console, "log").mockImplementation((value: unknown) => {
          output.push(String(value));
        });
        await WhoamiCommand.run(json ? ["--json"] : [], {
          root: resolve(import.meta.dirname, "../.."),
        });
        const text = output.join("\n");
        if (json)
          expect(JSON.parse(text)).toMatchObject({
            id: "acct-1",
            session_registration: {
              address: "pending@example.test",
              lastFailure: { code: "setup_unfinished" },
            },
          });
        else
          expect(text).toContain(
            "The last registration attempt for this session (pending@example.test) failed at",
          );
        expect(text).toContain("choose Copy again");
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );

  it("does not call account or imply sign-in is needed for a raw connection credential", async () => {
    mocks.auth.mockResolvedValue({
      apiClient: { client: {} },
      auth: { apiKey: ["pconn", "test"].join("_") },
    });
    await expect(
      WhoamiCommand.run([], { root: resolve(import.meta.dirname, "../..") }),
    ).rejects.toThrow("Select its saved profile");
    expect(mocks.account).not.toHaveBeenCalled();
  });
});
