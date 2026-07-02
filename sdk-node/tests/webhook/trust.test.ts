import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { EmailAuth, EmailReceivedEvent } from "../../src/types.js";
import { normalizeReceivedEmail } from "../../src/webhook/received-email.js";
import { isTrustedSender } from "../../src/webhook/trust.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const baseEvent = JSON.parse(
  readFileSync(
    join(__dirname, "../../../test-fixtures/webhook/valid-email-received.json"),
    "utf8",
  ),
) as EmailReceivedEvent;

function legitAuth(overrides: Partial<EmailAuth> = {}): EmailAuth {
  return {
    spf: "pass",
    dmarc: "pass",
    dmarcPolicy: "reject",
    dmarcFromDomain: "example.com",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dmarcSpfStrict: false,
    dmarcDkimStrict: false,
    dkimSignatures: [
      {
        domain: "example.com",
        selector: "default",
        result: "pass",
        aligned: true,
        keyBits: 2048,
        algo: "rsa-sha256",
      },
    ],
    ...overrides,
  };
}

function buildEvent(overrides: {
  from?: string;
  mailFrom?: string;
  auth?: EmailAuth;
}): EmailReceivedEvent {
  const event = structuredClone(baseEvent);
  if (overrides.from !== undefined) {
    event.email.headers.from = overrides.from;
  }
  if (overrides.mailFrom !== undefined) {
    event.email.smtp.mail_from = overrides.mailFrom;
  }
  event.email.auth = overrides.auth ?? legitAuth();
  return event;
}

describe("isTrustedSender", () => {
  it("trusts authenticated mail from the expected domain", () => {
    const result = isTrustedSender(buildEvent({ from: "sender@example.com" }), {
      domain: "example.com",
    });
    expect(result).toMatchObject({
      trusted: true,
      retryable: false,
      reason: "trusted",
    });
    expect(result.auth.verdict).toBe("legit");
  });

  it("does not trust an unparseable From header even when the envelope sender matches", () => {
    // normalizeReceivedEmail falls back to smtp.mail_from when the From
    // header fails to parse; that fallback is attacker-controlled and must
    // never satisfy the trust check.
    const event = buildEvent({
      from: "not-an-email",
      mailFrom: "sender@example.com",
    });
    expect(normalizeReceivedEmail(event).sender.address).toBe(
      "sender@example.com",
    );
    const result = isTrustedSender(event, { domain: "example.com" });
    expect(result.trusted).toBe(false);
    expect(result.reason).toBe("from-header-invalid");
  });

  it("rejects a matching Reply-To when the From does not match", () => {
    const event = buildEvent({
      from: "attacker@evil.example.net",
      auth: legitAuth({
        dmarcFromDomain: "evil.example.net",
        dkimSignatures: [
          {
            domain: "evil.example.net",
            selector: "default",
            result: "pass",
            aligned: true,
            keyBits: 2048,
            algo: "rsa-sha256",
          },
        ],
      }),
    });
    event.email.parsed.reply_to = [
      { address: "sender@example.com", name: null },
    ];
    const result = isTrustedSender(event, { domain: "example.com" });
    expect(result.trusted).toBe(false);
    expect(result.reason).toBe("dmarc-domain-mismatch");
  });

  it("treats a missing auth object as untrusted instead of throwing", () => {
    const event = buildEvent({ from: "sender@example.com" });
    (event.email as { auth?: EmailAuth }).auth = undefined;
    const result = isTrustedSender(event, { domain: "example.com" });
    expect(result).toMatchObject({
      trusted: false,
      retryable: false,
      reason: "auth-missing",
    });
    expect(result.auth.verdict).toBe("unknown");
  });

  it("treats malformed dkimSignatures as untrusted instead of throwing", () => {
    const event = buildEvent({ from: "sender@example.com" });
    (
      event.email.auth as unknown as { dkimSignatures: unknown }
    ).dkimSignatures = "corrupt";
    const result = isTrustedSender(event, { domain: "example.com" });
    expect(result.reason).toBe("auth-missing");
  });

  it("rejects group syntax in the From header", () => {
    const result = isTrustedSender(
      buildEvent({ from: "Friends: sender@example.com;" }),
      { domain: "example.com" },
    );
    expect(result.trusted).toBe(false);
    expect(result.reason).toBe("from-header-invalid");
  });

  it("normalizes a whitespace-padded dmarcFromDomain", () => {
    const result = isTrustedSender(
      buildEvent({
        from: "sender@example.com",
        auth: legitAuth({ dmarcFromDomain: " Example.com " }),
      }),
      { domain: "example.com" },
    );
    expect(result.trusted).toBe(true);
  });

  it("does not treat an empty expected domain as matching an empty dmarcFromDomain", () => {
    expect(() =>
      isTrustedSender(buildEvent({ from: "sender@example.com" }), {
        domain: "  ",
      }),
    ).toThrow(TypeError);
  });

  it("throws TypeError for invalid options", () => {
    const event = buildEvent({ from: "sender@example.com" });
    expect(() =>
      isTrustedSender(event, { domain: "user@example.com" }),
    ).toThrow(TypeError);
    expect(() =>
      isTrustedSender(event, {
        domain: "example.com",
        sender: "not-an-email",
      }),
    ).toThrow(TypeError);
    expect(() =>
      isTrustedSender(event, {
        domain: "example.com",
        sender: "Name <sender@example.com>",
      }),
    ).toThrow(TypeError);
    expect(() => isTrustedSender(event, {} as { domain: string })).toThrow(
      TypeError,
    );
  });

  it("keeps the retryable flag false for every non-temperror reason", () => {
    const cases: Array<{ event: EmailReceivedEvent; domain: string }> = [
      {
        event: buildEvent({
          from: "sender@example.com",
          auth: legitAuth({
            spf: "fail",
            dmarc: "fail",
            dmarcSpfAligned: false,
            dmarcDkimAligned: false,
            dkimSignatures: [],
          }),
        }),
        domain: "example.com",
      },
      {
        event: buildEvent({
          from: "sender@example.com",
          auth: legitAuth({
            dmarc: "none",
            dmarcPolicy: null,
            dmarcSpfAligned: false,
            dmarcDkimAligned: false,
            dkimSignatures: [],
          }),
        }),
        domain: "example.com",
      },
      {
        event: buildEvent({ from: "sender@example.com" }),
        domain: "other.example.net",
      },
    ];
    for (const testCase of cases) {
      const result = isTrustedSender(testCase.event, {
        domain: testCase.domain,
      });
      expect(result.trusted).toBe(false);
      expect(result.retryable).toBe(false);
    }
  });
});
