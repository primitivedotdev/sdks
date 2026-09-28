import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type ContactRuleSelector,
  canonicalContactSelector,
  matchesContactPattern,
  matchesContactSelector,
} from "../../src/oclif/contact-rule-matcher.js";

describe("contact approval selectors", () => {
  it("canonicalizes exact addresses and keeps exact domain boundaries", () => {
    expect(
      canonicalContactSelector({
        kind: "address",
        value: " Agent@EXAMPLE.com ",
      }),
    ).toEqual({ kind: "address", value: "agent@example.com" });
    const selector = { kind: "domain", value: "example.com" } as const;
    expect(matchesContactSelector(selector, "agent@example.com")).toBe(true);
    for (const sender of [
      "agent@sub.example.com",
      "agent@notexample.com",
      "agent@example.com.evil.test",
      "Name <agent@example.com>",
    ])
      expect(matchesContactSelector(selector, sender)).toBe(false);
  });

  it("makes a leading domain wildcard match complete subdomain labels, never the apex", () => {
    const selector = { kind: "domain", value: "*.example.com" } as const;
    for (const sender of [
      "agent@research.example.com",
      "agent@a.b.example.com",
    ])
      expect(matchesContactSelector(selector, sender)).toBe(true);
    for (const sender of [
      "agent@example.com",
      "agent@notexample.com",
      "agent@example.com.evil.test",
      "agent@.example.com",
    ])
      expect(matchesContactSelector(selector, sender)).toBe(false);
  });

  it("supports bounded local-part globs without allowing the wildcard to cross domains", () => {
    const selector = {
      kind: "pattern",
      value: "research-*@example.com",
    } as const;
    expect(matchesContactSelector(selector, "research-a@example.com")).toBe(
      true,
    );
    expect(matchesContactSelector(selector, "research-@example.com")).toBe(
      true,
    );
    for (const sender of [
      "research-a@sub.example.com",
      "research-a@evil.test",
      "other@example.com",
    ])
      expect(matchesContactSelector(selector, sender)).toBe(false);
    expect(
      matchesContactSelector(
        { kind: "pattern", value: "research-*@*.example.com" },
        "research-a@lab.example.com",
      ),
    ).toBe(true);
    expect(
      matchesContactSelector(
        { kind: "pattern", value: "*@example.com" },
        "any@example.com",
      ),
    ).toBe(true);
  });

  it.each([
    ["domain", "*"],
    ["domain", "*.com"],
    ["domain", "example.*"],
    ["domain", "a.*.example.com"],
    ["domain", "*example.com"],
    ["domain", "example..com"],
    ["domain", "-example.com"],
    ["pattern", "*@*"],
    ["pattern", "*@*.com"],
    ["pattern", "research-?@example.com"],
    ["pattern", "[a-z]@example.com"],
    ["pattern", "(agent|owner)@example.com"],
    ["pattern", "agent@exa*mple.com"],
    ["pattern", "a\\d@example.com"],
    ["address", "*@example.com"],
    ["pattern", "r*h-*@example.com"],
    ["pattern", "research-*x@example.com"],
    ["address", "a@@example.com"],
    ["address", "a..b@example.com"],
  ] as const)("rejects unsafe or ambiguous %s selector %s", (kind, value) => {
    expect(() => canonicalContactSelector({ kind, value })).toThrow("selector");
  });

  it("rejects invalid runtime kinds and bounded input sizes", () => {
    expect(() =>
      canonicalContactSelector({
        kind: "regex",
        value: "example.com",
      } as unknown as ContactRuleSelector),
    ).toThrow("selector");
    expect(() =>
      canonicalContactSelector({
        kind: "pattern",
        value: `${"a".repeat(65)}@example.com`,
      }),
    ).toThrow("selector");
    expect(
      matchesContactSelector(
        { kind: "domain", value: "example.com" },
        "a\n@example.com",
      ),
    ).toBe(false);
  });
});

const vectors = JSON.parse(
  readFileSync(
    new URL(
      "../../../test-fixtures/contact-pattern-conformance.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  valid: { input: string; normalized: string }[];
  invalid: string[];
  matches: { pattern: string; address: string; expected: boolean }[];
};
describe("public contact-pattern conformance", () => {
  it.each(vectors.valid)("canonicalizes $input", ({ input, normalized }) => {
    expect(
      canonicalContactSelector({ kind: "pattern", value: input }).value,
    ).toBe(normalized);
  });
  it.each(vectors.invalid)("rejects %s", (value) =>
    expect(() =>
      canonicalContactSelector({ kind: "pattern", value }),
    ).toThrow());
  it.each(vectors.matches)("matches $pattern against $address", ({
    pattern,
    address,
    expected,
  }) => expect(matchesContactPattern(pattern, address)).toBe(expected));
  it("counts a local wildcard inside the 64-character bound", () => {
    expect(
      canonicalContactSelector({
        kind: "pattern",
        value: `${"a".repeat(63)}*@example.com`,
      }),
    ).toBeDefined();
    expect(() =>
      canonicalContactSelector({
        kind: "pattern",
        value: `${"a".repeat(64)}*@example.com`,
      }),
    ).toThrow();
  });
});
