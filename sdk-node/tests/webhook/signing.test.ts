import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { WebhookVerificationError } from "../../src/webhook/errors.js";
import {
  PRIMITIVE_CONFIRMED_HEADER,
  PRIMITIVE_SIGNATURE_HEADER,
  signWebhookPayload,
  verifyWebhookSignature,
} from "../../src/webhook/signing.js";

// =============================================================================
// TEST VECTORS - Use these to verify implementations in other languages
// =============================================================================

/**
 * Official test vectors for Primitive webhook signature verification.
 * These can be used to verify implementations in any language.
 *
 * Format:
 *   Header: Primitive-Signature: t={timestamp},v1={hex_signature}
 *   Signed payload: "{timestamp}.{raw_body}"
 *   Algorithm: HMAC-SHA256
 */
const TEST_VECTORS = {
  // Simple JSON payload
  simple: {
    secret: "whsec_test_secret_key_123",
    timestamp: 1734567890,
    rawBody: '{"event":"email.received","email_id":"msg_123"}',
  },
  // Payload with special characters
  specialChars: {
    secret: "whsec_another_secret!@#$%",
    timestamp: 1700000000,
    rawBody:
      '{"subject":"Test with \\"quotes\\" and \\n newlines","from":"test@example.com"}',
  },
  // Empty-ish payload
  minimal: {
    secret: "secret",
    timestamp: 1000000000,
    rawBody: "{}",
  },
  // Large payload (realistic webhook)
  realistic: {
    secret: "whsec_production_key_abc123xyz",
    timestamp: 1734567890,
    rawBody: JSON.stringify({
      id: "evt_abc123xyz789",
      event: "email.received",
      version: "2025-12-14",
      delivery: {
        endpoint_id: "ep_abc123",
        attempt: 1,
        attempted_at: "2025-12-14T12:00:00.000Z",
      },
      email: {
        id: "em_xyz789",
        received_at: "2025-12-14T11:59:50.000Z",
        headers: {
          from: "sender@example.com",
          to: "recipient@mydomain.com",
          subject: "Important Business Email",
        },
      },
    }),
  },
};

// Pre-compute expected signatures for test vectors
function computeExpectedSignature(
  secret: string,
  timestamp: number,
  rawBody: string,
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(signedPayload);
  return hmac.digest("hex");
}

describe("PRIMITIVE_SIGNATURE_HEADER", () => {
  it("exports the correct header name", () => {
    expect(PRIMITIVE_SIGNATURE_HEADER).toBe("Primitive-Signature");
  });
});

describe("PRIMITIVE_CONFIRMED_HEADER", () => {
  it("exports the correct header name", () => {
    expect(PRIMITIVE_CONFIRMED_HEADER).toBe("X-Primitive-Confirmed");
  });
});

describe("signWebhookPayload", () => {
  const secret = "test-secret-key";
  const rawBody = JSON.stringify({
    message_id: "msg_123",
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Test Email",
  });

  it("generates signature in t={timestamp},v1={hex} format", () => {
    const { header } = signWebhookPayload(rawBody, secret);
    expect(header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/);
  });

  it("returns current timestamp by default", () => {
    const before = Math.floor(Date.now() / 1000);
    const { timestamp } = signWebhookPayload(rawBody, secret);
    const after = Math.floor(Date.now() / 1000);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("accepts custom timestamp", () => {
    const customTimestamp = 1734567890;
    const { header, timestamp } = signWebhookPayload(
      rawBody,
      secret,
      customTimestamp,
    );

    expect(timestamp).toBe(customTimestamp);
    expect(header).toMatch(/^t=1734567890,v1=[a-f0-9]{64}$/);
  });

  it("produces consistent signatures for same inputs", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const result1 = signWebhookPayload(rawBody, secret, timestamp);
    const result2 = signWebhookPayload(rawBody, secret, timestamp);

    expect(result1.header).toBe(result2.header);
    expect(result1.timestamp).toBe(result2.timestamp);
  });

  it("produces different signatures for different timestamps", () => {
    const timestamp1 = 1000000000;
    const timestamp2 = 2000000000;

    const result1 = signWebhookPayload(rawBody, secret, timestamp1);
    const result2 = signWebhookPayload(rawBody, secret, timestamp2);

    expect(result1.header).not.toBe(result2.header);
  });

  it("produces different signatures for different bodies", () => {
    const body2 = JSON.stringify({ subject: "Different Subject" });
    const timestamp = Math.floor(Date.now() / 1000);

    const result1 = signWebhookPayload(rawBody, secret, timestamp);
    const result2 = signWebhookPayload(body2, secret, timestamp);

    expect(result1.header).not.toBe(result2.header);
  });

  it("produces different signatures for different secrets", () => {
    const timestamp = Math.floor(Date.now() / 1000);

    const result1 = signWebhookPayload(rawBody, "secret1", timestamp);
    const result2 = signWebhookPayload(rawBody, "secret2", timestamp);

    expect(result1.header).not.toBe(result2.header);
  });

  it("uses {timestamp}.{body} format for signing (Stripe-style)", () => {
    const timestamp = 1734567890;
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    // Manually compute expected signature using Stripe-style format
    const signedPayload = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(signedPayload);
    const expectedHex = hmac.digest("hex");

    expect(header).toBe(`t=${timestamp},v1=${expectedHex}`);
  });

  it("returns v1 hex for debugging", () => {
    const timestamp = 1734567890;
    const { v1 } = signWebhookPayload(rawBody, secret, timestamp);

    expect(v1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts Buffer inputs", () => {
    const bodyBuffer = Buffer.from(rawBody);
    const secretBuffer = Buffer.from(secret);
    const timestamp = 1734567890;

    const result1 = signWebhookPayload(rawBody, secret, timestamp);
    const result2 = signWebhookPayload(bodyBuffer, secretBuffer, timestamp);

    expect(result1.header).toBe(result2.header);
  });
});

describe("secret validation", () => {
  it("throws MISSING_SECRET for empty secret", () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=123,v1=abc",
        secret: "",
      }),
    ).toThrow(WebhookVerificationError);

    try {
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=123,v1=abc",
        secret: "",
      });
    } catch (e) {
      expect((e as WebhookVerificationError).code).toBe("MISSING_SECRET");
    }
  });

  it("throws MISSING_SECRET for undefined secret", () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=123,v1=abc",
        secret: undefined as unknown as string,
      }),
    ).toThrow(WebhookVerificationError);

    try {
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=123,v1=abc",
        secret: undefined as unknown as string,
      });
    } catch (e) {
      expect((e as WebhookVerificationError).code).toBe("MISSING_SECRET");
    }
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "test-secret-key";
  const rawBody = JSON.stringify({
    message_id: "msg_123",
    from: "test@example.com",
  });

  it("returns true for valid signatures", () => {
    const { header } = signWebhookPayload(rawBody, secret);
    const result = verifyWebhookSignature({
      rawBody,
      signatureHeader: header,
      secret,
    });
    expect(result).toBe(true);
  });

  it("ignores malformed signature parts when a valid signature is present", () => {
    const { header } = signWebhookPayload(rawBody, secret, 123);
    const result = verifyWebhookSignature({
      rawBody,
      signatureHeader: `=oops, foo=, ${header}, v1=`,
      secret,
      nowSeconds: 123,
    });

    expect(result).toBe(true);
  });

  it("throws INVALID_SIGNATURE_HEADER for malformed header", () => {
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: "", secret }),
    ).toThrow(WebhookVerificationError);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: "", secret }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SIGNATURE_HEADER" }));
  });

  it("throws INVALID_SIGNATURE_HEADER for missing t=", () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "v1=abc123",
        secret,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SIGNATURE_HEADER" }));
  });

  it("throws INVALID_SIGNATURE_HEADER for missing v1=", () => {
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "t=1234567890",
        secret,
      }),
    ).toThrow(expect.objectContaining({ code: "INVALID_SIGNATURE_HEADER" }));
  });

  it("throws TIMESTAMP_OUT_OF_RANGE for old signatures", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });

  it("throws TIMESTAMP_OUT_OF_RANGE for future signatures", () => {
    const timestamp = Math.floor(Date.now() / 1000) + 2 * 60; // 2 minutes in future
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });

  it("throws SIGNATURE_MISMATCH for invalid signature", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    const invalidSig = `t=${timestamp},v1=${"0".repeat(64)}`;

    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: invalidSig,
        secret,
      }),
    ).toThrow(expect.objectContaining({ code: "SIGNATURE_MISMATCH" }));
  });

  it("throws SIGNATURE_MISMATCH for wrong secret", () => {
    const { header } = signWebhookPayload(rawBody, "secret1");

    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret: "secret2",
      }),
    ).toThrow(expect.objectContaining({ code: "SIGNATURE_MISMATCH" }));
  });

  it("error includes helpful message", () => {
    try {
      verifyWebhookSignature({ rawBody, signatureHeader: "", secret });
    } catch (e) {
      expect(e).toBeInstanceOf(WebhookVerificationError);
      expect((e as WebhookVerificationError).message).toContain(
        "Invalid Primitive-Signature",
      );
    }
  });

  it("accepts custom toleranceSeconds", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 10 * 60; // 10 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    // Should fail with default tolerance (5 min)
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));

    // Should pass with extended tolerance
    const result = verifyWebhookSignature({
      rawBody,
      signatureHeader: header,
      secret,
      toleranceSeconds: 15 * 60,
    });
    expect(result).toBe(true);
  });

  it("accepts nowSeconds for deterministic testing", () => {
    const timestamp = 1734567890;
    const now = 1734567900; // 10 seconds later
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    const result = verifyWebhookSignature({
      rawBody,
      signatureHeader: header,
      secret,
      nowSeconds: now,
    });
    expect(result).toBe(true);
  });

  it("rejects old signatures with fixed nowSeconds", () => {
    const timestamp = 1734567890;
    const now = 1734567890 + 6 * 60; // 6 minutes later
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
        nowSeconds: now,
      }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });
});

describe("timestamp validation (replay attack prevention)", () => {
  const secret = "test-secret-key";
  const rawBody = JSON.stringify({
    message_id: "msg_123",
    from: "test@example.com",
  });

  it("accepts signatures less than 5 minutes old", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 4 * 60; // 4 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("accepts signatures exactly at the 5 minute threshold", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 5 * 60; // 5 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("rejects signatures older than 5 minutes (replay attack)", () => {
    const timestamp = Math.floor(Date.now() / 1000) - 6 * 60; // 6 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow();
  });

  it("accepts signatures with minor clock skew (30 seconds in future)", () => {
    const timestamp = Math.floor(Date.now() / 1000) + 30; // 30 seconds in future
    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("rejects signatures too far in the future (2 minutes)", () => {
    const timestamp = Math.floor(Date.now() / 1000) + 2 * 60; // 2 minutes in future
    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow();
  });
});

describe("timestamp edge cases", () => {
  const secret = "test-secret";
  const rawBody = '{"test":"data"}';

  it("rejects timestamp from 1970 (epoch)", () => {
    const { header } = signWebhookPayload(rawBody, secret, 0);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });

  it("rejects timestamp from year 2100", () => {
    const year2100 = Math.floor(new Date("2100-01-01").getTime() / 1000);
    const { header } = signWebhookPayload(rawBody, secret, year2100);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });

  it("rejects negative timestamp", () => {
    const header = `t=-1000,v1=${"a".repeat(64)}`;
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow();
  });

  it("rejects MAX_SAFE_INTEGER timestamp", () => {
    const { header } = signWebhookPayload(
      rawBody,
      secret,
      Number.MAX_SAFE_INTEGER,
    );
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });

  it("handles timestamp at exactly tolerance boundary (inclusive)", () => {
    const now = Math.floor(Date.now() / 1000);
    const exactlyAtLimit = now - 300; // Exactly 5 minutes ago
    const { header } = signWebhookPayload(rawBody, secret, exactlyAtLimit);

    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("rejects timestamp 1 second past tolerance", () => {
    const now = Math.floor(Date.now() / 1000);
    const pastLimit = now - 301; // 5 minutes + 1 second ago
    const { header } = signWebhookPayload(rawBody, secret, pastLimit);

    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).toThrow(expect.objectContaining({ code: "TIMESTAMP_OUT_OF_RANGE" }));
  });
});

describe("key rotation (multiple signatures)", () => {
  const secret = "test-secret-key";
  const rawBody = JSON.stringify({ test: "data" });

  it("accepts any valid signature when multiple are provided", () => {
    const { header, v1 } = signWebhookPayload(rawBody, secret);
    const timestamp = header.match(/t=(\d+)/)?.[1];

    // Header with invalid sig first, then valid sig
    const multiSigHeader = `t=${timestamp},v1=${"0".repeat(64)},v1=${v1}`;
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: multiSigHeader,
        secret,
      }),
    ).not.toThrow();
  });

  it("skips non-hex signatures in multi-sig header", () => {
    const { header, v1 } = signWebhookPayload(rawBody, secret);
    const timestamp = header.match(/t=(\d+)/)?.[1];

    // Header with non-hex sig first, then valid sig
    const multiSigHeader = `t=${timestamp},v1=not-valid-hex!!!,v1=${v1}`;
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: multiSigHeader,
        secret,
      }),
    ).not.toThrow();
  });
});

describe("end-to-end: sign and verify", () => {
  it("round-trip works correctly", () => {
    const secret = `whsec_${crypto.randomBytes(24).toString("base64")}`;
    const rawBody = JSON.stringify({
      message_id: "msg_123",
      from: "test@example.com",
      to: "user@domain.com",
      subject: "Integration Test",
      text: "This is a test",
      headers: { "X-Test": "value" },
    });

    // Sign
    const { header } = signWebhookPayload(rawBody, secret);

    // Verify with same secret - should succeed
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();

    // Verify with different secret - should fail
    const otherSecret = `whsec_${crypto.randomBytes(24).toString("base64")}`;
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret: otherSecret,
      }),
    ).toThrow(expect.objectContaining({ code: "SIGNATURE_MISMATCH" }));
  });

  it("works with empty JSON body", () => {
    const secret = "test-secret";
    const rawBody = "{}";

    const { header } = signWebhookPayload(rawBody, secret);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("works with complex nested JSON", () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({
      deeply: {
        nested: {
          array: [1, 2, { more: "data" }],
          nullValue: null,
          booleans: [true, false],
        },
      },
    });

    const { header } = signWebhookPayload(rawBody, secret);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("handles unicode in body", () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({
      subject: "Hello 世界 🌍",
      from: "tëst@example.com",
    });

    const { header } = signWebhookPayload(rawBody, secret);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });

  it("handles special characters in body", () => {
    const secret = "test-secret";
    const rawBody = JSON.stringify({
      text: "Line1\nLine2\tTabbed",
      html: '<script>alert("xss")</script>',
    });

    const { header } = signWebhookPayload(rawBody, secret);
    expect(() =>
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret }),
    ).not.toThrow();
  });
});

describe("test vectors - cross-language verification", () => {
  it("vector: simple payload", () => {
    const { secret, timestamp, rawBody } = TEST_VECTORS.simple;

    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    const expectedHex = computeExpectedSignature(secret, timestamp, rawBody);

    expect(header).toBe(`t=${timestamp},v1=${expectedHex}`);

    // Verify it validates
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

  });

  it("vector: minimal payload", () => {
    const { secret, timestamp, rawBody } = TEST_VECTORS.minimal;

    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    const expectedHex = computeExpectedSignature(secret, timestamp, rawBody);

    expect(header).toBe(`t=${timestamp},v1=${expectedHex}`);
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();
  });

  it("vector: realistic webhook payload", () => {
    const { secret, timestamp, rawBody } = TEST_VECTORS.realistic;

    const { header } = signWebhookPayload(rawBody, secret, timestamp);
    const expectedHex = computeExpectedSignature(secret, timestamp, rawBody);

    expect(header).toBe(`t=${timestamp},v1=${expectedHex}`);
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();
  });
});

describe("security edge cases", () => {
  const secret = "test-secret";
  const rawBody = '{"test":"data"}';

  it("rejects signature with modified timestamp in header but valid sig", () => {
    // Sign with timestamp T1
    const t1 = Math.floor(Date.now() / 1000);
    const { v1 } = signWebhookPayload(rawBody, secret, t1);

    // Attacker modifies timestamp in header to T2 but keeps original signature
    const t2 = t1 + 100;
    const tamperedHeader = `t=${t2},v1=${v1}`;

    // Should fail because signature was computed with T1
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: tamperedHeader,
        secret,
      }),
    ).toThrow();
  });

  it("rejects if body is modified after signing", () => {
    const { header } = signWebhookPayload(rawBody, secret);
    const modifiedBody = '{"test":"modified"}';

    expect(() =>
      verifyWebhookSignature({
        rawBody: modifiedBody,
        signatureHeader: header,
        secret,
      }),
    ).toThrow();
  });

  it("rejects if even whitespace is modified in body", () => {
    const { header } = signWebhookPayload(rawBody, secret);
    const modifiedBody = '{ "test": "data" }'; // Added spaces

    expect(() =>
      verifyWebhookSignature({
        rawBody: modifiedBody,
        signatureHeader: header,
        secret,
      }),
    ).toThrow();
  });

  it("rejects signature with wrong length hex", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    // SHA-256 produces 64 hex chars, this is 63
    const wrongLengthSig = `t=${timestamp},v1=${"a".repeat(63)}`;

    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: wrongLengthSig,
        secret,
      }),
    ).toThrow();
  });

  it("handles very long bodies", () => {
    const longBody = JSON.stringify({ data: "x".repeat(1000000) }); // ~1MB
    const { header } = signWebhookPayload(longBody, secret);

    expect(() =>
      verifyWebhookSignature({
        rawBody: longBody,
        signatureHeader: header,
        secret,
      }),
    ).not.toThrow();
  });

  it("handles secrets with special characters", () => {
    const specialSecret = "secret!@#$%^&*()_+-=[]{}|;:,.<>?/~`";
    const { header } = signWebhookPayload(rawBody, specialSecret);

    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret: specialSecret,
      }),
    ).not.toThrow();
  });
});

describe("WebhookVerificationError", () => {
  const secret = "test-secret";
  const rawBody = '{"test":"data"}';

  it("has suggestion property", () => {
    try {
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "invalid",
        secret,
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as WebhookVerificationError;
      expect(err.suggestion).toBeDefined();
      expect(err.suggestion.length).toBeGreaterThan(10);
    }
  });

  it("toJSON includes all fields", () => {
    try {
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "invalid",
        secret,
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as WebhookVerificationError;
      const json = err.toJSON();
      expect(json.name).toBe("WebhookVerificationError");
      expect(json.code).toBeDefined();
      expect(json.message).toBeDefined();
      expect(json.suggestion).toBeDefined();
    }
  });

  it("toString includes suggestion", () => {
    try {
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "invalid",
        secret,
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as WebhookVerificationError;
      expect(err.toString()).toContain("Suggestion:");
    }
  });

  it("provides appropriate suggestion for each error code", () => {
    // INVALID_SIGNATURE_HEADER
    try {
      verifyWebhookSignature({
        rawBody,
        signatureHeader: "invalid",
        secret,
      });
    } catch (e) {
      expect((e as WebhookVerificationError).suggestion).toContain(
        "Primitive-Signature",
      );
    }

    // TIMESTAMP_OUT_OF_RANGE
    const oldTimestamp = Math.floor(Date.now() / 1000) - 10 * 60;
    const { header } = signWebhookPayload(rawBody, secret, oldTimestamp);
    try {
      verifyWebhookSignature({ rawBody, signatureHeader: header, secret });
    } catch (e) {
      expect((e as WebhookVerificationError).suggestion).toContain("clock");
    }

    // SIGNATURE_MISMATCH
    const { header: validHeader } = signWebhookPayload(rawBody, secret);
    try {
      verifyWebhookSignature({
        rawBody,
        signatureHeader: validHeader,
        secret: "wrong-secret",
      });
    } catch (e) {
      expect((e as WebhookVerificationError).suggestion).toContain("secret");
    }
  });
});

describe("re-serialization detection", () => {
  const secret = "test-secret";

  it("detects pretty-printed JSON and gives helpful error", () => {
    // Sign with compact JSON
    const compactBody = '{"event":"email.received"}';
    const { header } = signWebhookPayload(compactBody, secret);

    // Simulate framework re-serializing to pretty-printed JSON
    const prettyBody = JSON.stringify({ event: "email.received" }, null, 2);

    try {
      verifyWebhookSignature({
        rawBody: prettyBody,
        signatureHeader: header,
        secret,
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as WebhookVerificationError;
      expect(err.code).toBe("SIGNATURE_MISMATCH");
      expect(err.message).toContain("re-serialized");
      expect(err.message).toContain("pretty-printed");
    }
  });

  it("gives standard error for non-pretty-printed mismatch", () => {
    const body = '{"event":"email.received"}';
    const { header } = signWebhookPayload(body, "correct-secret");

    try {
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: header,
        secret: "wrong-secret",
      });
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as WebhookVerificationError;
      expect(err.code).toBe("SIGNATURE_MISMATCH");
      expect(err.message).not.toContain("pretty-printed");
      expect(err.message).toContain("raw request body");
    }
  });

  it("does not false-positive on compact JSON with newlines in values", () => {
    const body = '{"event":"email.received","body":"line1\\nline2"}';
    const { header } = signWebhookPayload(body, secret);

    // Should verify successfully (no re-serialization)
    expect(() =>
      verifyWebhookSignature({
        rawBody: body,
        signatureHeader: header,
        secret,
      }),
    ).not.toThrow();
  });
});

describe("customer implementation example", () => {
  const secret = "my-webhook-secret";
  const payload = {
    message_id: "msg_789",
    from: "sender@example.com",
    to: "recipient@domain.com",
    subject: "Test Email",
  };
  const rawBody = JSON.stringify(payload);

  it("customers can verify signature using Stripe-style format", () => {
    const { v1, timestamp } = signWebhookPayload(rawBody, secret);

    // Customer receives:
    // - Primitive-Signature: t={timestamp},v1={hex}

    // Customer computes their own HMAC using Stripe-style format
    const signedPayload = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(signedPayload);
    const expectedHex = hmac.digest("hex");

    // Verify they match
    expect(v1).toBe(expectedHex);
  });

  it("demonstrates complete customer verification flow using SDK", () => {
    // Our service generates signature
    const { header } = signWebhookPayload(rawBody, secret);

    // Customer receives webhook with header:
    // Primitive-Signature: t={timestamp},v1={hex}

    // Customer's verification code using the SDK:
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
      }),
    ).not.toThrow();
  });
});

describe("signature caching (performance optimization)", () => {
  const secret = "test-secret";
  const rawBody = '{"test":"data"}';

  it("cache hit: verifying same Buffer twice works correctly", () => {
    // Create a Buffer body (cache only works with Buffers, not strings)
    const bodyBuffer = Buffer.from(rawBody);
    const timestamp = Math.floor(Date.now() / 1000);
    const { header } = signWebhookPayload(bodyBuffer, secret, timestamp);

    // First verification - cache miss, computes signature
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

    // Second verification with same Buffer - cache hit
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();
  });

  it("cache invalidation: different secret requires recompute", () => {
    const bodyBuffer = Buffer.from(rawBody);
    const timestamp = Math.floor(Date.now() / 1000);

    // Sign with secret1
    const { header: header1 } = signWebhookPayload(
      bodyBuffer,
      "secret1",
      timestamp,
    );

    // Verify with secret1 - caches result
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header1,
        secret: "secret1",
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

    // Sign with secret2
    const { header: header2 } = signWebhookPayload(
      bodyBuffer,
      "secret2",
      timestamp,
    );

    // Verify with secret2 - must recompute (different secret hash)
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header2,
        secret: "secret2",
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

    // Verify wrong secret still fails (cache doesn't break security)
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header1,
        secret: "secret2",
        nowSeconds: timestamp,
      }),
    ).toThrow(expect.objectContaining({ code: "SIGNATURE_MISMATCH" }));
  });

  it("cache invalidation: different timestamp requires recompute", () => {
    const bodyBuffer = Buffer.from(rawBody);
    const timestamp1 = 1734567890;
    const timestamp2 = 1734567900;

    // Sign with timestamp1
    const { header: header1 } = signWebhookPayload(
      bodyBuffer,
      secret,
      timestamp1,
    );

    // Verify with timestamp1 - caches result
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header1,
        secret,
        nowSeconds: timestamp1,
      }),
    ).not.toThrow();

    // Sign with timestamp2
    const { header: header2 } = signWebhookPayload(
      bodyBuffer,
      secret,
      timestamp2,
    );

    // Verify with timestamp2 - must recompute (different timestamp)
    expect(() =>
      verifyWebhookSignature({
        rawBody: bodyBuffer,
        signatureHeader: header2,
        secret,
        nowSeconds: timestamp2,
      }),
    ).not.toThrow();
  });

  it("string bodies work correctly (no caching, but functional)", () => {
    // String bodies can't be cached (WeakMap requires object keys)
    // but they should still work correctly
    const timestamp = Math.floor(Date.now() / 1000);
    const { header } = signWebhookPayload(rawBody, secret, timestamp);

    // First verification
    expect(() =>
      verifyWebhookSignature({
        rawBody, // string, not Buffer
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

    // Second verification (no caching for strings, but still works)
    expect(() =>
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();
  });

  it("different Buffer instances with same content are cached separately", () => {
    // Two different Buffer instances with same content
    const buffer1 = Buffer.from(rawBody);
    const buffer2 = Buffer.from(rawBody);
    const timestamp = Math.floor(Date.now() / 1000);
    const { header } = signWebhookPayload(buffer1, secret, timestamp);

    // Verify with buffer1
    expect(() =>
      verifyWebhookSignature({
        rawBody: buffer1,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();

    // Verify with buffer2 (different instance, same content)
    // This is a cache miss but should still work
    expect(() =>
      verifyWebhookSignature({
        rawBody: buffer2,
        signatureHeader: header,
        secret,
        nowSeconds: timestamp,
      }),
    ).not.toThrow();
  });
});
