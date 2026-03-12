import { describe, expect, it } from "vitest";
import { bufferToString } from "../../src/webhook/encoding.js";
import { WebhookPayloadError } from "../../src/webhook/errors.js";

describe("bufferToString", () => {
  it("converts valid UTF-8 buffer to string", () => {
    const buffer = Buffer.from("Hello, World!");
    const result = bufferToString(buffer, "test input");
    expect(result).toBe("Hello, World!");
  });

  it("handles UTF-8 with multibyte characters", () => {
    const buffer = Buffer.from("Hello, ");
    const result = bufferToString(buffer, "test input");
    expect(result).toBe("Hello, ");
  });

  it("handles empty buffer", () => {
    const buffer = Buffer.from("");
    const result = bufferToString(buffer, "test input");
    expect(result).toBe("");
  });

  it("throws INVALID_ENCODING for invalid UTF-8 bytes", () => {
    // 0xFF is not valid in UTF-8
    const invalidBuffer = Buffer.from([0xff, 0xfe, 0x00, 0x01]);

    expect(() => bufferToString(invalidBuffer, "request body")).toThrow(
      WebhookPayloadError,
    );

    try {
      bufferToString(invalidBuffer, "request body");
    } catch (e) {
      const err = e as WebhookPayloadError;
      expect(err.code).toBe("INVALID_ENCODING");
      expect(err.message).toContain("request body");
      expect(err.message).toContain("invalid UTF-8");
      expect(err.suggestion).toContain("UTF-8");
    }
  });

  it("throws INVALID_ENCODING for truncated multibyte sequence", () => {
    // Start of a 3-byte UTF-8 sequence but truncated
    const truncated = Buffer.from([0xe2, 0x82]);

    expect(() => bufferToString(truncated, "payload")).toThrow(
      WebhookPayloadError,
    );

    try {
      bufferToString(truncated, "payload");
    } catch (e) {
      const err = e as WebhookPayloadError;
      expect(err.code).toBe("INVALID_ENCODING");
    }
  });

  it("includes label in error message", () => {
    const invalidBuffer = Buffer.from([0xff]);

    try {
      bufferToString(invalidBuffer, "webhook body");
    } catch (e) {
      const err = e as WebhookPayloadError;
      expect(err.message).toContain("webhook body");
    }
  });

  it("suggestion mentions base64 for binary data", () => {
    const invalidBuffer = Buffer.from([0xff]);

    try {
      bufferToString(invalidBuffer, "test");
    } catch (e) {
      const err = e as WebhookPayloadError;
      expect(err.suggestion).toContain("base64");
    }
  });
});
