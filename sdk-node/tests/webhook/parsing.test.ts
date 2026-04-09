import { describe, expect, it, vi } from "vitest";
import { WebhookPayloadError } from "../../src/webhook/errors.js";
import { parseJsonBody } from "../../src/webhook/parsing.js";

describe("parseJsonBody", () => {
  it("throws a helpful empty body error", () => {
    expect(() => parseJsonBody("   ")).toThrow(WebhookPayloadError);
  });

  it("strips a UTF-8 BOM before parsing JSON", () => {
    expect(parseJsonBody('\ufeff{"event":"email.received"}')).toEqual({
      event: "email.received",
    });
  });

  it("includes the JSON parser message when no position is available", () => {
    vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw new SyntaxError("totally broken");
    });

    try {
      parseJsonBody('{"event":"email.received"}');
      throw new Error("expected parseJsonBody to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookPayloadError);
      const payloadError = error as WebhookPayloadError;
      expect(payloadError.code).toBe("JSON_PARSE_FAILED");
      expect(payloadError.suggestion).toContain("Invalid JSON:");
    }
  });
});
