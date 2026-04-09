import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  confirmedHeaders,
  decodeRawEmail,
  type EmailReceivedEvent,
  getDownloadTimeRemaining,
  handleWebhook,
  isDownloadExpired,
  isEmailReceivedEvent,
  isRawIncluded,
  PrimitiveWebhookError,
  parseWebhookEvent,
  RawEmailDecodeError,
  verifyRawEmailDownload,
  WebhookPayloadError,
  WebhookValidationError,
  WebhookVerificationError,
} from "../../src/webhook/index.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";

const validPayload = JSON.parse(
  readFileSync(
    resolve(
      import.meta.dirname,
      "../../../test-fixtures/webhook/valid-email-received.json",
    ),
    "utf8",
  ),
) as EmailReceivedEvent;

describe("parseWebhookEvent", () => {
  describe("known events", () => {
    it("returns EmailReceivedEvent for email.received", () => {
      const result = parseWebhookEvent(validPayload);

      expect(result.event).toBe("email.received");
      if (result.event === "email.received") {
        expect(result.id).toBe("evt_abc123");
      }
    });

    it("throws validation error for malformed known events", () => {
      expect(() =>
        parseWebhookEvent({ event: "email.received", id: "test-123" }),
      ).toThrow(WebhookValidationError);
    });
  });

  describe("unknown events (forward compatibility)", () => {
    it("returns UnknownEvent for unrecognized event types", () => {
      const input = {
        event: "email.bounced",
        id: "evt-456",
        bounce_reason: "mailbox_full",
      };
      const result = parseWebhookEvent(input);

      expect(result.event).toBe("email.bounced");
      expect((result as Record<string, unknown>).bounce_reason).toBe(
        "mailbox_full",
      );
    });

    it("handles future event types gracefully", () => {
      const input = {
        event: "email.opened",
        id: "evt-789",
        opened_at: "2025-01-01T00:00:00Z",
      };

      expect(() => parseWebhookEvent(input)).not.toThrow();
      const result = parseWebhookEvent(input);
      expect(result.event).toBe("email.opened");
    });

    it("preserves id and version fields in UnknownEvent", () => {
      const input = {
        event: "email.clicked",
        id: "evt-abc",
        version: "2025-12-14",
        link_url: "https://example.com",
      };
      const result = parseWebhookEvent(input);

      expect(result.id).toBe("evt-abc");
      expect(result.version).toBe("2025-12-14");
    });
  });

  describe("error cases", () => {
    it("throws for null input", () => {
      expect(() => parseWebhookEvent(null)).toThrow(WebhookPayloadError);
    });

    it("throws for undefined input", () => {
      expect(() => parseWebhookEvent(undefined)).toThrow(WebhookPayloadError);
    });

    it("throws for missing event field", () => {
      expect(() => parseWebhookEvent({ id: "test" })).toThrow(
        WebhookPayloadError,
      );
    });

    it("throws for non-string event field", () => {
      expect(() => parseWebhookEvent({ event: 123 })).toThrow(
        WebhookPayloadError,
      );
    });

    it("throws for array input", () => {
      expect(() => parseWebhookEvent([{ event: "test" }])).toThrow(
        WebhookPayloadError,
      );
    });
  });
});

describe("handleWebhook", () => {
  const secret = "test-webhook-secret";

  describe("success cases", () => {
    it("verifies, parses, and validates a valid webhook", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "primitive-signature": header },
        secret,
      });

      expect(event.id).toBe("evt_abc123");
      expect(event.event).toBe("email.received");
      expect(event.email.headers.subject).toBe("Test Email");
    });

    it("works with Buffer body", () => {
      const body = Buffer.from(JSON.stringify(validPayload));
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "primitive-signature": header },
        secret,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("accepts custom tolerance", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "primitive-signature": header },
        secret,
        toleranceSeconds: 600,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("finds signature with original casing (Primitive-Signature)", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "Primitive-Signature": header },
        secret,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("works with Fetch API Headers object", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);
      const headers = new Headers();
      headers.set("primitive-signature", header);

      const event = handleWebhook({
        body,
        headers,
        secret,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("finds signature with uppercase header name", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "PRIMITIVE-SIGNATURE": header },
        secret,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("uses the first signature when a header value is an array", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      const event = handleWebhook({
        body,
        headers: { "primitive-signature": [header, "ignored"] },
        secret,
      });

      expect(event.id).toBe("evt_abc123");
    });

    it("treats an empty signature array as a missing header", () => {
      const body = JSON.stringify(validPayload);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": [] },
          secret,
        }),
      ).toThrow(WebhookVerificationError);
    });

    it("treats a missing Fetch Headers signature as empty", () => {
      const body = JSON.stringify(validPayload);

      expect(() =>
        handleWebhook({
          body,
          headers: new Headers(),
          secret,
        }),
      ).toThrow(WebhookVerificationError);
    });

    it("treats an explicitly undefined signature value as empty", () => {
      const body = JSON.stringify(validPayload);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": undefined } as Record<
            string,
            string | string[] | undefined
          >,
          secret,
        }),
      ).toThrow(WebhookVerificationError);
    });
  });

  describe("verification errors", () => {
    it("throws WebhookVerificationError for missing signature header", () => {
      const body = JSON.stringify(validPayload);

      expect(() =>
        handleWebhook({
          body,
          headers: {},
          secret,
        }),
      ).toThrow(WebhookVerificationError);
    });

    it("throws WebhookVerificationError for invalid signature", () => {
      const body = JSON.stringify(validPayload);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": "t=123,v1=invalid" },
          secret,
        }),
      ).toThrow(WebhookVerificationError);
    });

    it("throws WebhookVerificationError for wrong secret", () => {
      const body = JSON.stringify(validPayload);
      const { header } = signWebhookPayload(body, secret);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": header },
          secret: "wrong-secret",
        }),
      ).toThrow(WebhookVerificationError);
    });
  });

  describe("payload errors", () => {
    it("throws WebhookPayloadError for invalid JSON", () => {
      const body = "{invalid json";
      const { header } = signWebhookPayload(body, secret);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": header },
          secret,
        }),
      ).toThrow(WebhookPayloadError);
    });
  });

  describe("validation errors", () => {
    it("throws WebhookValidationError for invalid payload structure", () => {
      const invalidPayload = { event: "email.received", id: "test" };
      const body = JSON.stringify(invalidPayload);
      const { header } = signWebhookPayload(body, secret);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": header },
          secret,
        }),
      ).toThrow(WebhookValidationError);
    });

    it("accepts any valid date-formatted version", () => {
      // SDK should accept different versions for forward/backward compatibility
      const differentVersion = { ...validPayload, version: "2020-01-01" };
      const body = JSON.stringify(differentVersion);
      const { header } = signWebhookPayload(body, secret);

      // Should NOT throw - any valid YYYY-MM-DD version is accepted
      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": header },
          secret,
        }),
      ).not.toThrow();
    });

    it("throws WebhookValidationError for invalid version format", () => {
      const invalidVersion = { ...validPayload, version: "not-a-date" };
      const body = JSON.stringify(invalidVersion);
      const { header } = signWebhookPayload(body, secret);

      expect(() =>
        handleWebhook({
          body,
          headers: { "primitive-signature": header },
          secret,
        }),
      ).toThrow(WebhookValidationError);
    });
  });
});

describe("PrimitiveWebhookError base class", () => {
  it("WebhookVerificationError instanceof PrimitiveWebhookError", () => {
    const err = new WebhookVerificationError(
      "SIGNATURE_MISMATCH",
      "test",
      "test",
    );
    expect(err instanceof PrimitiveWebhookError).toBe(true);
  });

  it("WebhookPayloadError instanceof PrimitiveWebhookError", () => {
    const err = new WebhookPayloadError("PAYLOAD_NULL", "test", "test");
    expect(err instanceof PrimitiveWebhookError).toBe(true);
  });

  it("WebhookValidationError instanceof PrimitiveWebhookError", () => {
    const err = new WebhookValidationError("field", "test", "test", []);
    expect(err instanceof PrimitiveWebhookError).toBe(true);
  });

  it("regular Error is not instanceof PrimitiveWebhookError", () => {
    const err = new Error("test");
    expect(err instanceof PrimitiveWebhookError).toBe(false);
  });

  it("RawEmailDecodeError instanceof PrimitiveWebhookError", () => {
    const err = new RawEmailDecodeError("NOT_INCLUDED", "test");
    expect(err instanceof PrimitiveWebhookError).toBe(true);
  });

  it("RawEmailDecodeError has suggestion property", () => {
    const notIncluded = new RawEmailDecodeError("NOT_INCLUDED", "test");
    expect(notIncluded.suggestion).toContain("download URL");

    const hashMismatch = new RawEmailDecodeError("HASH_MISMATCH", "test");
    expect(hashMismatch.suggestion).toContain("corrupted");
  });
});

describe("isEmailReceivedEvent", () => {
  it("returns true for email.received events", () => {
    const event = { event: "email.received", id: "test" };
    expect(isEmailReceivedEvent(event)).toBe(true);
  });

  it("returns false for unknown events", () => {
    const event = { event: "email.bounced", id: "test" };
    expect(isEmailReceivedEvent(event)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isEmailReceivedEvent(null)).toBe(false);
  });

  it("returns false for non-objects", () => {
    expect(isEmailReceivedEvent("string")).toBe(false);
    expect(isEmailReceivedEvent(123)).toBe(false);
  });
});

describe("confirmedHeaders", () => {
  it("returns the correct header", () => {
    expect(confirmedHeaders()).toEqual({ "X-Primitive-Confirmed": "true" });
  });

  it("header value is exactly 'true' (string)", () => {
    const headers = confirmedHeaders();
    expect(headers["X-Primitive-Confirmed"]).toBe("true");
    expect(typeof headers["X-Primitive-Confirmed"]).toBe("string");
  });
});

describe("isDownloadExpired", () => {
  const createEvent = (expiresAt: string) =>
    ({
      email: {
        content: {
          download: { url: "https://example.com", expires_at: expiresAt },
        },
      },
    }) as EmailReceivedEvent;

  it("returns false for future expiration", () => {
    const future = new Date(Date.now() + 3600000).toISOString();
    expect(isDownloadExpired(createEvent(future))).toBe(false);
  });

  it("returns true for past expiration", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(isDownloadExpired(createEvent(past))).toBe(true);
  });

  it("returns true at exact expiration time", () => {
    const now = Date.now();
    const exact = new Date(now).toISOString();
    expect(isDownloadExpired(createEvent(exact), now)).toBe(true);
  });
});

describe("getDownloadTimeRemaining", () => {
  const createEvent = (expiresAt: string) =>
    ({
      email: {
        content: {
          download: { url: "https://example.com", expires_at: expiresAt },
        },
      },
    }) as EmailReceivedEvent;

  it("returns positive value for future expiration", () => {
    const now = Date.now();
    const future = new Date(now + 3600000).toISOString();
    const remaining = getDownloadTimeRemaining(createEvent(future), now);
    expect(remaining).toBeCloseTo(3600000, -2);
  });

  it("returns 0 for past expiration", () => {
    const past = new Date(Date.now() - 3600000).toISOString();
    expect(getDownloadTimeRemaining(createEvent(past))).toBe(0);
  });
});

describe("isRawIncluded", () => {
  it("returns true when raw content is included", () => {
    const event = {
      email: {
        content: {
          raw: {
            included: true,
            data: "abc",
            sha256: "xyz",
            size_bytes: 100,
            max_inline_bytes: 262144,
            encoding: "base64",
          },
          download: {
            url: "https://example.com",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    } as EmailReceivedEvent;
    expect(isRawIncluded(event)).toBe(true);
  });

  it("returns false when raw content must be downloaded", () => {
    const event = {
      email: {
        content: {
          raw: {
            included: false,
            reason_code: "size_exceeded",
            size_bytes: 500000,
            max_inline_bytes: 262144,
            sha256: "abc",
          },
          download: {
            url: "https://example.com",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    } as EmailReceivedEvent;
    expect(isRawIncluded(event)).toBe(false);
  });
});

describe("decodeRawEmail", () => {
  const createEventWithRaw = (data: string, sha256?: string) =>
    ({
      email: {
        content: {
          raw: {
            included: true,
            encoding: "base64",
            data,
            sha256:
              sha256 ??
              createHash("sha256")
                .update(Buffer.from(data, "base64"))
                .digest("hex"),
            size_bytes: Buffer.from(data, "base64").length,
            max_inline_bytes: 262144,
          },
          download: {
            url: "https://example.com",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    }) as EmailReceivedEvent;

  it("decodes base64 content", () => {
    const content = "Hello, World!";
    const base64 = Buffer.from(content).toString("base64");
    const event = createEventWithRaw(base64);

    const result = decodeRawEmail(event);
    expect(result.toString()).toBe(content);
  });

  it("verifies SHA-256 by default", () => {
    const base64 = Buffer.from("test").toString("base64");
    const event = createEventWithRaw(base64, "wrong-hash");

    expect(() => decodeRawEmail(event)).toThrow(RawEmailDecodeError);
  });

  it("skips verification when verify: false", () => {
    const base64 = Buffer.from("test").toString("base64");
    const event = createEventWithRaw(base64, "wrong-hash");

    expect(() => decodeRawEmail(event, { verify: false })).not.toThrow();
  });

  it("throws for download-only content", () => {
    const event = {
      email: {
        content: {
          raw: {
            included: false,
            reason_code: "size_exceeded",
            size_bytes: 500000,
            max_inline_bytes: 262144,
            sha256: "abc",
          },
          download: {
            url: "https://example.com",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    } as EmailReceivedEvent;

    expect(() => decodeRawEmail(event)).toThrow(RawEmailDecodeError);
  });
});

describe("verifyRawEmailDownload", () => {
  const createEventWithHash = (sha256: string) =>
    ({
      email: {
        content: {
          raw: {
            included: false,
            reason_code: "size_exceeded",
            size_bytes: 500000,
            max_inline_bytes: 262144,
            sha256,
          },
          download: {
            url: "https://example.com",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    }) as EmailReceivedEvent;

  it("returns Buffer for valid content", () => {
    const content = "Hello, World!";
    const buffer = Buffer.from(content);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const event = createEventWithHash(sha256);

    const result = verifyRawEmailDownload(buffer, event);
    expect(result.toString()).toBe(content);
  });

  it("accepts ArrayBuffer input", () => {
    const content = "Test content";
    const buffer = Buffer.from(content);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const event = createEventWithHash(sha256);

    // Simulate ArrayBuffer from fetch response
    const arrayBuffer = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );

    const result = verifyRawEmailDownload(arrayBuffer, event);
    expect(result.toString()).toBe(content);
  });

  it("throws RawEmailDecodeError for hash mismatch", () => {
    const buffer = Buffer.from("actual content");
    const event = createEventWithHash("a".repeat(64)); // wrong hash

    expect(() => verifyRawEmailDownload(buffer, event)).toThrow(
      RawEmailDecodeError,
    );
  });

  it("error has HASH_MISMATCH code", () => {
    const buffer = Buffer.from("test");
    const event = createEventWithHash("b".repeat(64));

    try {
      verifyRawEmailDownload(buffer, event);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as RawEmailDecodeError).code).toBe("HASH_MISMATCH");
    }
  });

  it("error message includes expected and actual hash", () => {
    const buffer = Buffer.from("test");
    const expectedHash = "c".repeat(64);
    const event = createEventWithHash(expectedHash);

    try {
      verifyRawEmailDownload(buffer, event);
      expect.fail("should have thrown");
    } catch (err) {
      const message = (err as RawEmailDecodeError).message;
      expect(message).toContain(expectedHash);
      expect(message).toContain("SHA-256");
    }
  });

  it("accepts Uint8Array input", () => {
    const content = "Uint8Array test";
    const buffer = Buffer.from(content);
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const event = createEventWithHash(sha256);

    // Create Uint8Array (common in browser/Deno contexts)
    const uint8Array = new Uint8Array(buffer);

    const result = verifyRawEmailDownload(uint8Array, event);
    expect(result.toString()).toBe(content);
  });

  it("handles empty content", () => {
    const buffer = Buffer.from("");
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const event = createEventWithHash(sha256);

    const result = verifyRawEmailDownload(buffer, event);
    expect(result.length).toBe(0);
  });

  it("handles binary content (non-UTF8)", () => {
    // Simulate binary email with attachment bytes
    const binaryContent = Buffer.from([
      0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd, 0x89, 0x50, 0x4e, 0x47,
    ]);
    const sha256 = createHash("sha256").update(binaryContent).digest("hex");
    const event = createEventWithHash(sha256);

    const result = verifyRawEmailDownload(binaryContent, event);
    expect(result.equals(binaryContent)).toBe(true);
  });

  it("handles large content", () => {
    // 1MB of data
    const largeContent = Buffer.alloc(1024 * 1024, "x");
    const sha256 = createHash("sha256").update(largeContent).digest("hex");
    const event = createEventWithHash(sha256);

    const result = verifyRawEmailDownload(largeContent, event);
    expect(result.length).toBe(1024 * 1024);
  });
});
