import { describe, expect, it } from "vitest";
import {
  formatReceivedAt,
  formatRow,
  truncate,
} from "../../src/oclif/commands/emails-latest.js";

describe("truncate", () => {
  it("right-pads short values to the requested width", () => {
    const out = truncate("abc", 8);
    expect(out).toBe("abc     ");
    expect(out.length).toBe(8);
  });

  it("returns exactly width chars when input length equals width", () => {
    const out = truncate("12345678", 8);
    expect(out).toBe("12345678");
    expect(out.length).toBe(8);
  });

  it("truncates with ... so the output is exactly width chars", () => {
    // 9 chars of slice + 3 chars sentinel = 12 total (width).
    const out = truncate("supercalifragilisticexpialidocious", 12);
    expect(out).toBe("supercali...");
    expect(out.length).toBe(12);
  });

  it("preserves column alignment when truncation fires on multiple columns", () => {
    // The motivating bug for the width-exact contract: a row with
    // multiple long values must keep its later columns at the same
    // visual offset as a row where every value fits. This guards
    // against regressions on the slice math.
    const a = truncate("looooooong-value-one", 10);
    const b = truncate("looooooong-value-two", 10);
    expect(a.length).toBe(10);
    expect(b.length).toBe(10);
    expect(a + b).toHaveLength(20);
  });
});

describe("formatReceivedAt", () => {
  it("renders an ISO timestamp as `YYYY-MM-DD HH:MM:SS` in UTC", () => {
    const out = formatReceivedAt("2026-04-30T14:22:00.000Z");
    expect(out).toBe("2026-04-30 14:22:00");
  });

  it("right-pads a missing value with the dash sentinel", () => {
    const out = formatReceivedAt(null);
    expect(out.startsWith("-")).toBe(true);
    expect(out.length).toBe(19);
  });

  it("right-pads an empty string with the dash sentinel", () => {
    expect(formatReceivedAt("")).toBe("-".padEnd(19));
  });

  it("falls back to the raw value when the input cannot be parsed as a date", () => {
    const out = formatReceivedAt("not-a-date");
    expect(out).toBe("not-a-date".padEnd(19));
  });

  it("zero-pads single-digit month/day/hour/minute/second", () => {
    const out = formatReceivedAt("2026-01-02T03:04:05.000Z");
    expect(out).toBe("2026-01-02 03:04:05");
  });
});

describe("formatRow", () => {
  function makeEmail(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "abc123def456ghij7890",
      sender: "alice@example.com",
      recipient: "support@yourcompany.com",
      subject: "needle",
      received_at: "2026-04-30T14:22:00.000Z",
      status: "completed",
      domain: "yourcompany.com",
      webhook_attempt_count: 0,
      ...overrides,
    } as never;
  }

  it("renders a basic row with the expected columns", () => {
    const row = formatRow(makeEmail());
    // ID column is the first 8 chars of the UUID.
    expect(row.startsWith("abc123de")).toBe(true);
    // Timestamp column is fixed-format UTC.
    expect(row).toContain("2026-04-30 14:22:00");
    expect(row).toContain("alice@example.com");
    expect(row).toContain("support@yourcompany.com");
    expect(row).toContain("needle");
  });

  it("collapses internal whitespace in the subject so embedded newlines don't break the row", () => {
    const row = formatRow(
      makeEmail({ subject: "first line\nsecond line\twith tab" }),
    );
    expect(row).not.toContain("\n");
    expect(row).not.toContain("\t");
    expect(row).toContain("first line second line with tab");
  });

  it("truncates a long subject with the ... sentinel", () => {
    const long =
      "this is a very long subject that should clearly exceed the display width and get cut off with ellipsis";
    const row = formatRow(makeEmail({ subject: long }));
    expect(row).toContain("...");
    // Original long subject must NOT appear in full.
    expect(row).not.toContain("ellipsis");
  });

  it("renders empty addresses as padded blanks instead of throwing", () => {
    const row = formatRow(makeEmail({ sender: null, recipient: null }));
    // Output should still be parseable as a row (no crash, no NaN).
    expect(row.length).toBeGreaterThan(0);
    expect(row).toContain("needle");
  });

  it("renders missing subject as empty (no crash)", () => {
    const row = formatRow(makeEmail({ subject: null }));
    expect(row.length).toBeGreaterThan(0);
  });
});
