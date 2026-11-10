import { describe, expect, it } from "vitest";
import {
  type ActivityItem,
  formatActivityRows,
  formatWithheld,
  throughLabel,
} from "../../src/oclif/commands/activity.js";
import { COMMANDS } from "../../src/oclif/index.js";

const item = (overrides: Partial<ActivityItem> = {}): ActivityItem => ({
  kind: "endpoint",
  id: "0b0f6a43-3c1c-4d4e-9b1a-1f2d3c4b5a69",
  name: "invoices hook",
  state: "enabled",
  created_at: "2026-11-10T12:34:56.000Z",
  ended_at: null,
  owned_now: "you",
  created_through: { kind: "member", id: null, name: null },
  ...overrides,
});

describe("activity created", () => {
  it("is registered beside the generated operation", () => {
    expect(COMMANDS["activity:created"]).toBeDefined();
    expect(COMMANDS["activity:list-activity-objects"]).toBeDefined();
  });

  it("prints one row per object, with what each came through for a person", () => {
    const out = formatActivityRows("you", [
      item(),
      item({
        kind: "api_key",
        name: "old key",
        state: "revoked",
        created_through: { kind: "member", id: null, name: null },
      }),
      item({
        kind: "recipient_route",
        name: "billing@example.com",
        owned_now: "someone_else",
        created_through: { kind: "org_key", id: "k", name: "deploy key" },
      }),
    ]);
    const lines = out.split("\n");
    expect(lines[0]).toMatch(
      /^KIND\s+STATE\s+CREATED \(UTC\)\s+NAME\s+THROUGH$/,
    );
    expect(lines[1]).toMatch(
      /^endpoint\s+enabled\s+2026-11-10 12:34\s+invoices hook\s+you$/,
    );
    expect(lines[2]).toContain("revoked");
    expect(lines[3]).toContain("enabled (transferred)");
    expect(lines[3]).toMatch(/key deploy key$/);
  });

  it("leaves out the THROUGH column for one credential, which made everything itself", () => {
    expect(
      formatActivityRows("this_credential", [item()]).split("\n")[0],
    ).not.toContain("THROUGH");
    expect(formatActivityRows("you", [])).toBe("Nothing to show.");
  });

  it("names each credential kind in words", () => {
    expect(
      throughLabel({ kind: "oauth", id: null, name: "Primitive CLI" }),
    ).toBe("app Primitive CLI");
    expect(
      throughLabel({
        kind: "connected_key",
        id: null,
        name: "agent@example.com",
      }),
    ).toBe("agent agent@example.com");
    expect(throughLabel({ kind: "org_key", id: null, name: null })).toBe("key");
  });

  it("says which kinds were left out and what would show them, without counts", () => {
    expect(formatWithheld([])).toBeNull();
    expect(
      formatWithheld([
        {
          kind: "function",
          reason: "permission_missing",
          permission: "functions:read",
        },
        { kind: "scheduled_send", reason: "mail_scope", permission: null },
        {
          kind: "api_key",
          reason: "not_for_this_credential",
          permission: null,
        },
      ]),
    ).toBe(
      "Not shown: function (needs functions:read), scheduled_send (needs access to every mailbox), api_key (not for this credential).",
    );
  });
});
