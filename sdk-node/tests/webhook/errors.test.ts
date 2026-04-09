import { describe, expect, it } from "vitest";
import {
  PrimitiveWebhookError,
  RawEmailDecodeError,
  WebhookPayloadError,
  WebhookValidationError,
  WebhookVerificationError,
} from "../../src/webhook/errors.js";

describe("PrimitiveWebhookError formatting", () => {
  it("serializes base webhook errors to JSON", () => {
    const error = new WebhookVerificationError("MISSING_SECRET");

    expect(error.toJSON()).toEqual({
      name: "WebhookVerificationError",
      code: "MISSING_SECRET",
      message: "No webhook secret was provided",
      suggestion:
        "Pass your webhook secret from the Primitive dashboard. Check that the environment variable is set.",
    });
    expect(error.toString()).toContain("Suggestion:");
    expect(error).toBeInstanceOf(PrimitiveWebhookError);
  });

  it("formats validation errors without extra error counts", () => {
    const error = new WebhookValidationError(
      "payload",
      "bad payload",
      "fix it",
      [],
    );

    expect(error.toString()).toBe(
      "WebhookValidationError [SCHEMA_VALIDATION_FAILED]: bad payload\n\nSuggestion: fix it",
    );
  });

  it("formats validation errors with pluralized extra counts", () => {
    const error = new WebhookValidationError(
      "payload",
      "bad payload",
      "fix it",
      [
        {
          instancePath: "/event",
          keyword: "const",
          params: {},
          schemaPath: "",
        },
        { instancePath: "/id", keyword: "type", params: {}, schemaPath: "" },
        {
          instancePath: "/email",
          keyword: "required",
          params: {},
          schemaPath: "",
        },
      ],
    );

    expect(error.toString()).toContain("(and 2 more validation errors)");
    expect(error.toJSON()).toEqual({
      name: "WebhookValidationError",
      code: "SCHEMA_VALIDATION_FAILED",
      field: "payload",
      message: "bad payload",
      suggestion: "fix it",
      additionalErrorCount: 2,
    });
  });

  it("formats validation errors with singular extra counts", () => {
    const error = new WebhookValidationError(
      "payload",
      "bad payload",
      "fix it",
      [
        {
          instancePath: "/event",
          keyword: "const",
          params: {},
          schemaPath: "",
        },
        { instancePath: "/id", keyword: "type", params: {}, schemaPath: "" },
      ],
    );

    expect(error.toString()).toContain("(and 1 more validation error)");
  });

  it("uses default payload and raw-email error definitions", () => {
    const payloadError = new WebhookPayloadError("PAYLOAD_EMPTY_BODY");
    const rawError = new RawEmailDecodeError("HASH_MISMATCH", "custom message");
    const defaultRawError = new RawEmailDecodeError("NOT_INCLUDED");

    expect(payloadError.message).toBe("Request body is empty");
    expect(payloadError.suggestion).toContain("request body was empty");
    expect(rawError.message).toBe("custom message");
    expect(rawError.suggestion).toContain("corrupted");
    expect(defaultRawError.message).toBe(
      "Raw email content not included inline",
    );
  });
});
