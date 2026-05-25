import { describe, expect, it } from "vitest";
import WhoamiCommand, {
  formatWhoamiSummary,
} from "../../src/oclif/commands/whoami.js";
import { COMMANDS } from "../../src/oclif/index.js";

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
    const output = formatWhoamiSummary(makeAccount());

    expect(output).toContain("Authenticated as cli@example.com");
    expect(output).toContain("Account id: acct-1");
    expect(output).toContain("Plan: pro");
    expect(output).not.toContain("onboarding");
    expect(output).not.toContain("stripe");
    expect(output).not.toContain("webhook");
  });
});
