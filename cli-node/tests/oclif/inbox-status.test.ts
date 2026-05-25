import { describe, expect, it } from "vitest";
import InboxStatusCommand, {
  domainSummary,
  focusInboxStatus,
  formatDomainHeader,
  formatDomainRow,
  formatInboxDate,
  formatInboxStatus,
  statusText,
  yesNo,
} from "../../src/oclif/commands/inbox-status.js";
import { COMMANDS } from "../../src/oclif/index.js";

function makeDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: "domain-1",
    domain: "example.com",
    verified: true,
    active: true,
    managed: false,
    receiving_ready: true,
    processing_ready: true,
    processing_route_count: 1,
    endpoint_count: 0,
    enabled_endpoint_count: 0,
    function_endpoint_count: 0,
    email_count: 2,
    latest_email_received_at: "2026-05-25T07:00:00.000Z",
    status: "ready",
    ...overrides,
  } as never;
}

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    ready: true,
    receiving_ready: true,
    processing_ready: true,
    summary:
      "Inbound mail is ready and at least one processing route is enabled.",
    next_actions: [],
    domains: [makeDomain()],
    endpoints: {
      total: 1,
      enabled: 1,
      disabled: 0,
      fallback_enabled: 1,
      domain_scoped_enabled: 0,
      http_enabled: 1,
      function_enabled: 0,
    },
    functions: {
      total: 0,
      deployed: 0,
      pending: 0,
      failed: 0,
    },
    recent_emails: {
      total: 2,
      latest_received_at: "2026-05-25T07:00:00.000Z",
    },
    ...overrides,
  } as never;
}

describe("inbox status command registration", () => {
  it("registers the human shortcut and generated operation id", () => {
    expect(COMMANDS["inbox:status"]).toBe(InboxStatusCommand);
    expect(COMMANDS["inbox:get-inbox-status"]).toBe(InboxStatusCommand);
  });

  it("exposes --domain and --json flags", () => {
    const flags = InboxStatusCommand.flags as Record<string, unknown>;
    expect(flags.domain).toBeDefined();
    expect(flags.json).toBeDefined();
  });
});

describe("inbox status formatting", () => {
  it("renders status labels and booleans compactly", () => {
    expect(statusText("stored_only")).toBe("stored-only");
    expect(statusText("pending_dns")).toBe("pending-dns");
    expect(statusText("paused" as never)).toBe("paused");
    expect(yesNo(true)).toBe("yes");
    expect(yesNo(false)).toBe("no");
  });

  it("keeps unknown domain statuses printable", () => {
    const domain = makeDomain({ status: "paused" });

    expect(domainSummary(domain)).toBe("example.com has status paused.");
    expect(formatDomainRow(domain)).toContain("paused");
  });

  it("formats valid dates in UTC and missing dates as never", () => {
    expect(formatInboxDate("2026-05-25T07:00:00.000Z")).toBe(
      "2026-05-25 07:00:00 UTC",
    );
    expect(formatInboxDate(null)).toBe("never");
  });

  it("renders fixed table columns", () => {
    const header = formatDomainHeader();
    const row = formatDomainRow(makeDomain());

    expect(header).toContain("DOMAIN");
    expect(header).toContain("PROCESS");
    expect(row).toContain("example.com");
    expect(row).toContain("ready");
    expect(row).toContain("yes");
  });

  it("renders summary, resources, and next actions", () => {
    const output = formatInboxStatus(
      makeStatus({
        next_actions: [
          {
            kind: "send_test_email",
            message: "Send a test email.",
            command: "primitive inbox status",
          },
        ],
      }),
    );

    expect(output).toContain("Inbound mail is ready");
    expect(output).toContain("Domains");
    expect(output).toContain("Endpoints: 1/1 enabled");
    expect(output).toContain("Functions: 0/0 deployed");
    expect(output).toContain("Recent inbound: 2 emails");
    expect(output).toContain("Next actions");
    expect(output).toContain("primitive inbox status");
  });
});

describe("focusInboxStatus", () => {
  it("focuses aggregate status on a single domain", () => {
    const nextActions = [
      {
        kind: "configure_processing",
        message: "Configure a webhook endpoint or function.",
      },
    ];
    const focused = focusInboxStatus(
      makeStatus({
        next_actions: nextActions,
        functions: {
          total: 2,
          deployed: 1,
          pending: 1,
          failed: 0,
        },
        domains: [
          makeDomain({ domain: "ready.example.com" }),
          makeDomain({
            domain: "pending.example.com",
            receiving_ready: false,
            processing_ready: false,
            processing_route_count: 0,
            email_count: 0,
            latest_email_received_at: null,
            status: "pending_dns",
            verified: false,
          }),
        ],
      }),
      "pending.example.com",
    );

    expect(focused.ready).toBe(false);
    expect(focused.receiving_ready).toBe(false);
    expect(focused.domains).toHaveLength(1);
    const domain = focused.domains[0];
    if (!domain) throw new Error("expected focused domain");
    expect(domain.domain).toBe("pending.example.com");
    expect(focused.summary).toBe(domainSummary(domain));
    expect(focused.recent_emails).toEqual({
      total: 0,
      latest_received_at: null,
    });
    expect(focused.next_actions).toBe(nextActions);
    expect(focused.endpoints).toEqual({
      total: 1,
      enabled: 1,
      disabled: 0,
      fallback_enabled: 1,
      domain_scoped_enabled: 0,
      http_enabled: 1,
      function_enabled: 0,
    });
    expect(focused.functions).toEqual({
      total: 2,
      deployed: 1,
      pending: 1,
      failed: 0,
    });
  });

  it("throws when the requested domain is absent", () => {
    expect(() => focusInboxStatus(makeStatus(), "missing.example.com")).toThrow(
      /missing.example.com/,
    );
  });
});
