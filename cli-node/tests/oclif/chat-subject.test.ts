import { describe, expect, it } from "vitest";
import {
  deriveChatSubject,
  deriveSubject,
} from "../../src/oclif/outbound-defaults.js";

describe("chat subject", () => {
  it("keeps a short first line as is", () => {
    expect(deriveChatSubject("Quick question")).toBe("Quick question");
    expect(deriveChatSubject("\n\n  Status?  \nMore detail here.")).toBe(
      "Status?",
    );
  });

  it("uses the first sentence of a long one-line message", () => {
    expect(
      deriveChatSubject(
        "Which Node version runs here? Reply with the exact string, please.",
      ),
    ).toBe("Which Node version runs here?");
  });

  it("cuts a long first sentence at a word boundary", () => {
    const subject = deriveChatSubject(
      "Hi, quick question from Harbor Scout: which Codex CLI version are you running? Just the version string is fine. Thanks!",
    );
    expect(subject).toBe(
      "Hi, quick question from Harbor Scout: which Codex CLI...",
    );
    expect(subject.length).toBeLessThanOrEqual(60);
  });

  it("cuts a long unbroken word without exceeding the limit", () => {
    const subject = deriveChatSubject("x".repeat(500));
    expect(subject).toBe(`${"x".repeat(57)}...`);
  });

  it("does not split on a dot inside a word", () => {
    expect(deriveChatSubject("Is v1.50.0 installed on this machine")).toBe(
      "Is v1.50.0 installed on this machine",
    );
  });

  it("does not end the sentence at an abbreviation or an initial", () => {
    expect(deriveChatSubject("Dr. Smith can help. Ask her first.")).toBe(
      "Dr. Smith can help.",
    );
    expect(
      deriveChatSubject("Use a tool, e.g. ripgrep. Then report back."),
    ).toBe("Use a tool, e.g. ripgrep.");
    expect(deriveChatSubject("Ask J. Doe now. Thanks.")).toBe(
      "Ask J. Doe now.",
    );
    expect(deriveChatSubject("See fig. 3 for the result. Then reply.")).toBe(
      "See fig. 3 for the result.",
    );
    expect(deriveChatSubject("Use e.g. Node to run this. Then reply.")).toBe(
      "Use e.g. Node to run this.",
    );
    expect(deriveChatSubject("Ask Acme Co. today. Then report.")).toBe(
      "Ask Acme Co. today.",
    );
  });

  it("ends at an abbreviation that ends a sentence", () => {
    expect(deriveChatSubject("No. Cancel the operation.")).toBe("No.");
    expect(deriveChatSubject("Bring pens, paper, etc. Then wait.")).toBe(
      "Bring pens, paper, etc.",
    );
  });

  it("falls back like the send subject for an empty body", () => {
    expect(deriveChatSubject("   \n ")).toBe(deriveSubject("   \n "));
  });
});
