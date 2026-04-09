import { describe, expect, it } from "vitest";
import type { DkimSignature, EmailAuth } from "../../src/types.js";
import { validateEmailAuth } from "../../src/webhook/auth.js";

// Helper to create a base EmailAuth object
function createBaseAuth(overrides: Partial<EmailAuth> = {}): EmailAuth {
  return {
    spf: "pass",
    dmarc: "pass",
    dmarcPolicy: "none",
    dmarcFromDomain: "example.com",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dmarcSpfStrict: false,
    dmarcDkimStrict: false,
    dkimSignatures: [],
    ...overrides,
  };
}

// Helper to create a DKIM signature
function createDkimSignature(
  overrides: Partial<DkimSignature> = {},
): DkimSignature {
  return {
    domain: "example.com",
    selector: "default",
    result: "pass",
    aligned: true,
    keyBits: 2048,
    algo: "rsa-sha256",
    ...overrides,
  };
}

describe("validateEmailAuth", () => {
  // =============================================================================
  // LEGIT (HIGH CONFIDENCE) - DMARC pass with DKIM alignment
  // =============================================================================
  describe("legit (high confidence)", () => {
    it("returns legit with high confidence for DMARC pass with aligned DKIM", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
      expect(result.reasons).toContain(
        "DMARC passed with DKIM alignment (example.com)",
      );
    });

    it("returns legit with high confidence for multiple aligned DKIM signatures", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            domain: "example.com",
            result: "pass",
            aligned: true,
          }),
          createDkimSignature({
            domain: "mail.example.com",
            result: "pass",
            aligned: true,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
      expect(result.reasons[0]).toContain("example.com");
      expect(result.reasons[0]).toContain("mail.example.com");
    });

    it("returns legit with high confidence even with reject policy", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcPolicy: "reject",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("ignores non-aligned DKIM signatures when checking alignment", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            domain: "other.com",
            result: "pass",
            aligned: false,
          }),
          createDkimSignature({
            domain: "example.com",
            result: "pass",
            aligned: true,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
      // Should only mention the aligned signature
      expect(result.reasons[0]).not.toContain("other.com");
      expect(result.reasons[0]).toContain("example.com");
    });
  });

  // =============================================================================
  // LEGIT (MEDIUM CONFIDENCE) - DMARC pass with SPF only
  // =============================================================================
  describe("legit (medium confidence)", () => {
    it("returns legit with medium confidence for DMARC pass with SPF only", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "pass",
        dmarcSpfAligned: true,
        dmarcDkimAligned: false,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
      expect(result.reasons).toContain("DMARC passed with SPF alignment");
      expect(result.reasons.some((r) => r.includes("SPF can break"))).toBe(
        true,
      );
    });

    it("returns legit with medium confidence when DKIM signatures exist but none aligned", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "pass",
        dmarcSpfAligned: true,
        dmarcDkimAligned: false,
        dkimSignatures: [
          createDkimSignature({
            domain: "other.com",
            result: "pass",
            aligned: false,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
    });

    it("returns legit with medium confidence for edge case DMARC pass", () => {
      // Edge case: DMARC pass but neither alignment flag is true
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcSpfAligned: false,
        dmarcDkimAligned: false,
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
      expect(result.reasons).toContain("DMARC passed");
    });
  });

  // =============================================================================
  // WEAK KEY HANDLING
  // =============================================================================
  describe("weak DKIM keys", () => {
    it("downgrades to medium confidence when DKIM key is weak", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            result: "pass",
            aligned: true,
            keyBits: 512, // Weak key
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
      expect(
        result.reasons.some((r) => r.includes("Weak DKIM key (512 bits)")),
      ).toBe(true);
    });

    it("does not flag 1024-bit keys as weak", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            result: "pass",
            aligned: true,
            keyBits: 1024,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
      expect(result.reasons.some((r) => r.includes("Weak"))).toBe(false);
    });

    it("does not flag 2048-bit keys as weak", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            result: "pass",
            aligned: true,
            keyBits: 2048,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.confidence).toBe("high");
      expect(result.reasons.some((r) => r.includes("Weak"))).toBe(false);
    });

    it("handles null keyBits gracefully", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            result: "pass",
            aligned: true,
            keyBits: null,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
      expect(result.reasons.some((r) => r.includes("Weak"))).toBe(false);
    });

    it("reports multiple weak keys", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            domain: "a.com",
            result: "pass",
            aligned: true,
            keyBits: 512,
          }),
          createDkimSignature({
            domain: "b.com",
            result: "pass",
            aligned: true,
            keyBits: 768,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.confidence).toBe("medium");
      expect(result.reasons.filter((r) => r.includes("Weak")).length).toBe(2);
    });
  });

  describe("fallback handling", () => {
    it("returns the fallback unknown verdict for unexpected DMARC values", () => {
      const result = validateEmailAuth({
        ...createBaseAuth(),
        dmarc: "mystery" as EmailAuth["dmarc"],
      });

      expect(result).toEqual({
        verdict: "unknown",
        confidence: "low",
        reasons: ["Unable to determine email authenticity"],
      });
    });
  });

  // =============================================================================
  // SUSPICIOUS (HIGH CONFIDENCE) - DMARC fail with reject/quarantine
  // =============================================================================
  describe("suspicious (high confidence)", () => {
    it("returns suspicious with high confidence for DMARC fail + reject policy", () => {
      const auth = createBaseAuth({
        dmarc: "fail",
        dmarcPolicy: "reject",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("high");
      expect(result.reasons).toContain(
        "DMARC failed and domain has reject policy",
      );
      expect(result.reasons.some((r) => r.includes("explicitly rejects"))).toBe(
        true,
      );
    });

    it("returns suspicious with high confidence for DMARC fail + quarantine policy", () => {
      const auth = createBaseAuth({
        dmarc: "fail",
        dmarcPolicy: "quarantine",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("high");
      expect(result.reasons).toContain(
        "DMARC failed and domain has quarantine policy",
      );
    });
  });

  // =============================================================================
  // SUSPICIOUS (MEDIUM CONFIDENCE) - DMARC fail + none policy with SPF fail
  // =============================================================================
  describe("suspicious (medium confidence)", () => {
    it("returns suspicious with medium confidence for DMARC fail + SPF fail", () => {
      const auth = createBaseAuth({
        spf: "fail",
        dmarc: "fail",
        dmarcPolicy: "none",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("medium");
      expect(result.reasons.some((r) => r.includes("SPF failed"))).toBe(true);
    });

    it("returns suspicious with medium confidence for no DMARC + SPF fail", () => {
      const auth = createBaseAuth({
        spf: "fail",
        dmarc: "none",
        dmarcPolicy: null,
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("medium");
      expect(result.reasons).toContain("No DMARC record for sender domain");
      expect(result.reasons.some((r) => r.includes("SPF failed"))).toBe(true);
    });
  });

  // =============================================================================
  // SUSPICIOUS (LOW CONFIDENCE) - DMARC fail + none policy
  // =============================================================================
  describe("suspicious (low confidence)", () => {
    it("returns suspicious with low confidence for DMARC fail + none policy", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "fail",
        dmarcPolicy: "none",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("low");
      expect(result.reasons).toContain(
        "DMARC failed (domain is in monitoring mode)",
      );
    });

    it("returns suspicious with low confidence for DMARC fail + null policy", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "fail",
        dmarcPolicy: null,
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("low");
    });
  });

  // =============================================================================
  // UNKNOWN - No DMARC record
  // =============================================================================
  describe("unknown (no DMARC)", () => {
    it("returns unknown for no DMARC with DKIM pass", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [createDkimSignature({ result: "pass" })],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
      expect(result.reasons).toContain("No DMARC record for sender domain");
      expect(result.reasons.some((r) => r.includes("DKIM verified"))).toBe(
        true,
      );
    });

    it("returns unknown for no DMARC with only SPF pass", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
      expect(result.reasons).toContain("No DMARC record for sender domain");
      expect(result.reasons).toContain("No DKIM signatures present");
      expect(result.reasons.some((r) => r.includes("SPF alone is weak"))).toBe(
        true,
      );
    });

    it("returns unknown for no DMARC and no authentication", () => {
      const auth = createBaseAuth({
        spf: "none",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
      expect(result.reasons).toContain("No DMARC record for sender domain");
      expect(result.reasons).toContain("No valid authentication found");
    });

    it("includes SPF passed in reasons when applicable", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [createDkimSignature({ result: "pass" })],
      });

      const result = validateEmailAuth(auth);

      expect(result.reasons).toContain("SPF passed");
    });
  });

  // =============================================================================
  // ERROR CASES - temperror and permerror
  // =============================================================================
  describe("error handling", () => {
    it("returns unknown for DMARC temperror", () => {
      const auth = createBaseAuth({
        dmarc: "temperror",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
      expect(result.reasons.some((r) => r.includes("temperror"))).toBe(true);
      expect(
        result.reasons.some((r) => r.includes("DNS or policy errors")),
      ).toBe(true);
    });

    it("returns unknown for DMARC permerror", () => {
      const auth = createBaseAuth({
        dmarc: "permerror",
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
      expect(result.reasons.some((r) => r.includes("permerror"))).toBe(true);
    });

    it("includes SPF error in reasons without affecting verdict", () => {
      const auth = createBaseAuth({
        spf: "temperror",
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      // Still legit because DMARC passed with DKIM
      expect(result.verdict).toBe("legit");
      expect(
        result.reasons.some((r) => r.includes("SPF verification error")),
      ).toBe(true);
    });

    it("includes SPF permerror in reasons", () => {
      const auth = createBaseAuth({
        spf: "permerror",
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(
        result.reasons.some((r) => r.includes("SPF verification error")),
      ).toBe(true);
    });
  });

  // =============================================================================
  // SPF RESULT VARIATIONS
  // =============================================================================
  describe("SPF result variations", () => {
    it("handles SPF softfail", () => {
      const auth = createBaseAuth({
        spf: "softfail",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
    });

    it("handles SPF neutral", () => {
      const auth = createBaseAuth({
        spf: "neutral",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
    });

    it("handles SPF none", () => {
      const auth = createBaseAuth({
        spf: "none",
        dmarc: "none",
        dmarcPolicy: null,
        dkimSignatures: [],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
    });
  });

  // =============================================================================
  // DKIM SIGNATURE EDGE CASES
  // =============================================================================
  describe("DKIM signature edge cases", () => {
    it("ignores failed DKIM signatures when looking for aligned pass", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "fail", aligned: true }),
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("falls back to SPF when all aligned DKIM signatures failed", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "pass",
        dmarcSpfAligned: true,
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({ result: "fail", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
      expect(result.reasons).toContain("DMARC passed with SPF alignment");
    });

    it("handles empty DKIM signatures array", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dkimSignatures: [],
      });

      // With dmarcDkimAligned true but no signatures, should fall back to SPF
      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
    });

    it("handles DKIM temperror", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "pass",
        dmarcSpfAligned: true,
        dmarcDkimAligned: false,
        dkimSignatures: [
          createDkimSignature({ result: "temperror", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
    });

    it("handles DKIM permerror", () => {
      const auth = createBaseAuth({
        spf: "pass",
        dmarc: "pass",
        dmarcSpfAligned: true,
        dmarcDkimAligned: false,
        dkimSignatures: [
          createDkimSignature({ result: "permerror", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("medium");
    });
  });

  // =============================================================================
  // REAL-WORLD SCENARIOS
  // =============================================================================
  describe("real-world scenarios", () => {
    it("handles Gmail email", () => {
      const auth: EmailAuth = {
        spf: "pass",
        dmarc: "pass",
        dmarcPolicy: "reject",
        dmarcFromDomain: "gmail.com",
        dmarcSpfAligned: true,
        dmarcDkimAligned: true,
        dmarcSpfStrict: false,
        dmarcDkimStrict: false,
        dkimSignatures: [
          {
            domain: "gmail.com",
            selector: "20230601",
            result: "pass",
            aligned: true,
            keyBits: 2048,
            algo: "rsa-sha256",
          },
        ],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles Resend email (ESP sending on behalf of customer)", () => {
      const auth: EmailAuth = {
        spf: "pass",
        dmarc: "pass",
        dmarcPolicy: "none",
        dmarcFromDomain: "example.com",
        dmarcSpfAligned: false,
        dmarcDkimAligned: true,
        dmarcSpfStrict: false,
        dmarcDkimStrict: false,
        dkimSignatures: [
          {
            domain: "resend.dev",
            selector: "resend",
            result: "pass",
            aligned: false,
            keyBits: 1024,
            algo: "rsa-sha256",
          },
          {
            domain: "example.com",
            selector: "resend",
            result: "pass",
            aligned: true,
            keyBits: 1024,
            algo: "rsa-sha256",
          },
        ],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles Amazon SES email", () => {
      const auth: EmailAuth = {
        spf: "pass",
        dmarc: "pass",
        dmarcPolicy: "quarantine",
        dmarcFromDomain: "example.com",
        dmarcSpfAligned: true,
        dmarcDkimAligned: true,
        dmarcSpfStrict: false,
        dmarcDkimStrict: false,
        dkimSignatures: [
          {
            domain: "amazonses.com",
            selector: "abc123",
            result: "pass",
            aligned: false,
            keyBits: 1024,
            algo: "rsa-sha256",
          },
          {
            domain: "example.com",
            selector: "ses123",
            result: "pass",
            aligned: true,
            keyBits: 1024,
            algo: "rsa-sha256",
          },
        ],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles obvious phishing attempt", () => {
      const auth: EmailAuth = {
        spf: "fail",
        dmarc: "fail",
        dmarcPolicy: "reject",
        dmarcFromDomain: "paypal.com",
        dmarcSpfAligned: false,
        dmarcDkimAligned: false,
        dmarcSpfStrict: true,
        dmarcDkimStrict: true,
        dkimSignatures: [],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("high");
      expect(result.reasons.some((r) => r.includes("reject"))).toBe(true);
    });

    it("handles legacy domain without DMARC", () => {
      const auth: EmailAuth = {
        spf: "pass",
        dmarc: "none",
        dmarcPolicy: null,
        dmarcFromDomain: null,
        dmarcSpfAligned: false,
        dmarcDkimAligned: false,
        dmarcSpfStrict: null,
        dmarcDkimStrict: null,
        dkimSignatures: [],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("unknown");
      expect(result.confidence).toBe("low");
    });

    it("handles forwarded email where SPF breaks", () => {
      const auth: EmailAuth = {
        spf: "fail", // SPF fails because forwarding server's IP isn't authorized
        dmarc: "pass", // But DMARC passes via DKIM
        dmarcPolicy: "none",
        dmarcFromDomain: "original.com",
        dmarcSpfAligned: false,
        dmarcDkimAligned: true,
        dmarcSpfStrict: false,
        dmarcDkimStrict: false,
        dkimSignatures: [
          {
            domain: "original.com",
            selector: "key1",
            result: "pass",
            aligned: true,
            keyBits: 2048,
            algo: "rsa-sha256",
          },
        ],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles mailing list email", () => {
      // Mailing lists often rewrite From, breaking DMARC
      const auth: EmailAuth = {
        spf: "pass",
        dmarc: "fail",
        dmarcPolicy: "none",
        dmarcFromDomain: "list.example.org",
        dmarcSpfAligned: true,
        dmarcDkimAligned: false,
        dmarcSpfStrict: false,
        dmarcDkimStrict: false,
        dkimSignatures: [
          {
            domain: "list.example.org",
            selector: "list",
            result: "pass",
            aligned: false,
            keyBits: 2048,
            algo: "rsa-sha256",
          },
        ],
      };

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("suspicious");
      expect(result.confidence).toBe("low");
    });
  });

  // =============================================================================
  // DMARC ALIGNMENT MODE
  // =============================================================================
  describe("DMARC alignment mode", () => {
    it("accepts strict alignment when set", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dmarcDkimStrict: true,
        dmarcSpfStrict: true,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("accepts relaxed alignment when set", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dmarcDkimStrict: false,
        dmarcSpfStrict: false,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles null alignment mode", () => {
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcDkimAligned: true,
        dmarcDkimStrict: null,
        dmarcSpfStrict: null,
        dkimSignatures: [
          createDkimSignature({ result: "pass", aligned: true }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
    });
  });

  // =============================================================================
  // DMARC FROM DOMAIN
  // =============================================================================
  describe("DMARC from domain", () => {
    it("handles subdomain with organizational domain lookup", () => {
      // Email from test.primitive.dev, DMARC found at primitive.dev
      const auth = createBaseAuth({
        dmarc: "pass",
        dmarcFromDomain: "primitive.dev",
        dmarcDkimAligned: true,
        dkimSignatures: [
          createDkimSignature({
            domain: "primitive.dev",
            result: "pass",
            aligned: true,
          }),
        ],
      });

      const result = validateEmailAuth(auth);

      expect(result.verdict).toBe("legit");
      expect(result.confidence).toBe("high");
    });

    it("handles null dmarcFromDomain", () => {
      const auth = createBaseAuth({
        dmarc: "none",
        dmarcFromDomain: null,
      });

      const result = validateEmailAuth(auth);

      // Should still work, just have less information
      expect(result.verdict).toBe("unknown");
    });
  });
});
