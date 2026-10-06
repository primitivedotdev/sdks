import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";
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
});

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
    expect(output).toContain("Account id: acct-1");
    expect(output).toContain("Plan: pro");
    expect(output).not.toContain("onboarding");
    expect(output).not.toContain("stripe");
    expect(output).not.toContain("webhook");
    expect(output).not.toContain("Managed inbox");
  });

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
    "reports saved identity offline without calling the account API (json %s)",
    async (json) => {
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
          auth_method: "agent_connection",
        });
    },
  );

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
