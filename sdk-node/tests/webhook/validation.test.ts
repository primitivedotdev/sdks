import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeValidateEmailReceivedEvent,
  validateEmailReceivedEvent,
} from "../../src/validation.js";
import { WebhookValidationError } from "../../src/webhook/errors.js";

const validPayload = {
  id: "evt_abc123",
  event: "email.received",
  version: "2025-12-14",
  delivery: {
    endpoint_id: "ep_xyz789",
    attempt: 1,
    attempted_at: "2025-12-14T12:00:00Z",
  },
  email: {
    id: "em_def456",
    received_at: "2025-12-14T11:59:50Z",
    smtp: {
      helo: "mail.example.com",
      mail_from: "sender@example.com",
      rcpt_to: ["recipient@domain.com"],
    },
    headers: {
      message_id: "<abc123@example.com>",
      subject: "Test Email",
      from: "sender@example.com",
      to: "recipient@domain.com",
      date: "Sat, 14 Dec 2025 11:59:50 +0000",
    },
    content: {
      raw: {
        included: true,
        encoding: "base64",
        max_inline_bytes: 262144,
        size_bytes: 1234,
        sha256: "a".repeat(64),
        data: "SGVsbG8gV29ybGQ=",
      },
      download: {
        url: "https://api.primitive.dev/v1/downloads/raw/token123",
        expires_at: "2025-12-15T12:00:00Z",
      },
    },
    parsed: {
      status: "complete",
      error: null,
      body_text: "Hello World",
      body_html: "<p>Hello World</p>",
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    },
    analysis: {},
    auth: {
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
    },
  },
};

describe("validation", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock(
      "../../src/generated/email-received-event.validator.generated.js",
    );
  });

  it("returns typed event for valid payload", () => {
    const event = validateEmailReceivedEvent(validPayload);
    expect(event.id).toBe("evt_abc123");
  });

  it("gives an old-style root payload message for non-objects", () => {
    try {
      validateEmailReceivedEvent("not an object");
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toBe("payload");
      expect(validationError.message).toBe(
        "Expected webhook payload object but received string",
      );
      expect(validationError.suggestion).toContain(
        "Webhook payloads must be objects",
      );
    }
  });

  it("gives an old-style root payload suggestion for undefined input", () => {
    try {
      validateEmailReceivedEvent(undefined);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.suggestion).toContain(
        "Make sure you're passing the parsed JSON body",
      );
    }
  });

  it("gives an old-style root payload suggestion for null input", () => {
    try {
      validateEmailReceivedEvent(null);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toBe(
        "Expected webhook payload object but received null",
      );
      expect(validationError.suggestion).toContain(
        "Did you forget to parse the JSON",
      );
    }
  });

  it("uses the payload label in generic fallback suggestions", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "",
          keyword: "customKeyword",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.suggestion).toContain("webhook payload");
    }
  });

  it("throws WebhookValidationError for invalid payload", () => {
    expect(() => validateEmailReceivedEvent({})).toThrow(
      WebhookValidationError,
    );
  });

  it("accepts any valid date-formatted version", () => {
    expect(
      validateEmailReceivedEvent({ ...validPayload, version: "2030-12-31" })
        .version,
    ).toBe("2030-12-31");
  });

  it("rejects invalid download expiry timestamps", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          content: {
            ...validPayload.email.content,
            download: {
              ...validPayload.email.content.download,
              expires_at: "Tuesday",
            },
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toBe("email.content.download.expires_at");
    }
  });

  it("returns safe failure shape for invalid payload", () => {
    const result = safeValidateEmailReceivedEvent({ event: "email.received" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(result.error.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it("formats const validation failures with field-specific guidance", () => {
    try {
      validateEmailReceivedEvent({ ...validPayload, event: "email.opened" });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toBe("event");
      expect(validationError.message).toContain("Invalid value for event");
    }
  });

  it("falls back to a payload-level error when the validator reports no issues", async () => {
    const mockedValidator = Object.assign(() => false, { errors: undefined });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "SCHEMA_VALIDATION_FAILED",
        field: "payload",
        validationErrors: [],
        message: "Webhook payload failed schema validation",
      });
      expect((error as WebhookValidationError).message).toBe(
        "Webhook payload failed schema validation",
      );
    }
  });

  it("handles null validator errors in the safe validation path", async () => {
    const mockedValidator = Object.assign(() => false, { errors: null });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { safeValidateEmailReceivedEvent: safeValidateWithMock } =
      await import("../../src/validation.js");

    const result = safeValidateWithMock(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.validationErrors).toEqual([]);
      expect(result.error.field).toBe("payload");
    }
  });

  it("formats generic validation failures with field-specific guidance", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], algo: 123 },
            ],
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toContain("email.auth.dkimSignatures");
      expect(validationError.message).toContain(
        "expected string,null but got number",
      );
      expect(validationError.suggestion).toContain("Check that");
    }
  });

  it("describes Date payload values as dates in type errors", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/received_at",
          keyword: "type",
          params: { type: "string" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() =>
      validateWithMock({
        ...validPayload,
        email: {
          ...validPayload.email,
          received_at: new Date("2025-12-14T11:59:50Z"),
        },
      }),
    ).toThrowError(/expected string but got date/);
  });

  it("suggests not quoting numeric values for type mismatches", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        delivery: {
          ...validPayload.delivery,
          attempt: "1",
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain(
        "Invalid type for delivery.attempt: expected integer but got string",
      );
      expect(validationError.suggestion).toContain(
        "Don't quote numeric values in JSON",
      );
    }
  });

  it("formats required validation failures without a reported property name", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email",
          keyword: "required",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /Missing required field: unknown/,
    );
  });

  it("uses fallback messages when validator errors omit details", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/event",
          keyword: "const",
          params: {},
          schemaPath: "",
        },
        {
          instancePath: "/event",
          keyword: "type",
          params: {},
          schemaPath: "",
        },
        {
          instancePath: "/event",
          keyword: "pattern",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    for (const expected of [
      /must match the expected constant/,
      /wrong type/,
      /Validation failed for event: pattern/,
    ]) {
      try {
        validateWithMock(validPayload);
      } catch (error) {
        expect((error as WebhookValidationError).message).toMatch(expected);
      }
      mockedValidator.errors?.shift();
    }
  });

  it("accepts extra unknown top-level fields like the old validator", () => {
    expect(
      validateEmailReceivedEvent({ ...validPayload, extra_field: "ok" }).id,
    ).toBe("evt_abc123");
  });

  it("accepts extra unknown nested fields like the old validator", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        delivery: { ...validPayload.delivery, extra_delivery: true },
        email: {
          ...validPayload.email,
          auth: { ...validPayload.email.auth, extra_auth: "ok" },
        },
      }).id,
    ).toBe("evt_abc123");
  });

  it("rejects javascript URLs in download.url", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          content: {
            ...validPayload.email.content,
            download: {
              ...validPayload.email.content.download,
              url: "javascript:alert(1)",
            },
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must be a valid HTTPS URL");
      expect(validationError.suggestion).toContain(
        "complete URL including the scheme",
      );
    }
  });

  it("surfaces HTTPS-specific pattern guidance for url fields", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/download/url",
          keyword: "pattern",
          params: { pattern: "^https://" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /valid HTTPS URL/,
    );
  });

  it("formats enum validation failures with allowed values", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/auth/spf",
          keyword: "enum",
          params: { allowedValues: ["pass", "fail", "none"] },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: { ...validPayload.email.auth, spf: "mystery" },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain('got "mystery"');
      expect(validationError.message).toContain('"pass", "fail", "none"');
    }
  });

  it("handles enum validation failures when AJV omits allowed values", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/auth/spf",
          keyword: "enum",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("expected one of:");
    }
  });

  it("falls back to a generic type message when AJV omits the expected type", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/delivery/attempt",
          keyword: "type",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(/wrong type/);
  });

  it("uses explicit const suggestions for non-event fields", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/raw/encoding",
          keyword: "const",
          params: { allowedValue: "base64" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock({
        ...validPayload,
        email: {
          ...validPayload.email,
          content: {
            ...validPayload.email.content,
            raw: { ...validPayload.email.content.raw, encoding: "utf8" },
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.suggestion).toContain(
        'Expected the literal value "base64"',
      );
    }
  });

  it("falls back to an unknown literal suggestion when a non-event const value is null", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/raw/encoding",
          keyword: "const",
          params: { allowedValue: null },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.suggestion).toContain(
        'Expected the literal value "unknown"',
      );
    }
  });

  it("falls back to the generic const suggestion for non-event fields without allowed values", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/raw/encoding",
          keyword: "const",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.suggestion).toContain(
        '"email.content.raw.encoding"',
      );
    }
  });

  it("omits the actual value when a const violation has no readable payload value", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/raw/missingField",
          keyword: "const",
          params: { allowedValue: true },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /Invalid value for email.content.raw.missingField: expected true$/,
    );
  });

  it("formats version pattern failures like the old validator", () => {
    try {
      validateEmailReceivedEvent({ ...validPayload, version: "not-a-date" });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toBe(
        'Invalid version format: "not-a-date"',
      );
      expect(validationError.suggestion).toContain("YYYY-MM-DD");
    }
  });

  it("formats version pattern failures with an unknown value when the payload is missing it", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/version",
          keyword: "pattern",
          params: { pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock({})).toThrowError(
      /Invalid version format: "unknown"/,
    );
  });

  it("humanizes sha256 pattern failures", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          content: {
            ...validPayload.email.content,
            raw: {
              ...validPayload.email.content.raw,
              sha256: "abc123",
            },
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain(
        "64-character hex SHA-256 string",
      );
    }
  });

  it("formats generic pattern failures with the regex context", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "pattern",
          params: { pattern: "^em_" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /must match pattern: \^em_/,
    );
  });

  it("formats non-url format failures with generic format guidance", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "format",
          params: { format: "email" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must be a valid email");
      expect(validationError.suggestion).toContain(
        'Check the format of "email.id"',
      );
    }
  });

  it("formats generic format failures when AJV omits the format name", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "format",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /must be a valid unknown format/,
    );
  });

  it("formats url format failures with URL guidance", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/content/download/url",
          keyword: "format",
          params: { format: "uri" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must be a valid URI");
      expect(validationError.suggestion).toContain(
        "complete URL including the scheme",
      );
    }
  });

  it("handles nested instance paths even when the payload is not traversable", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "const",
          params: { allowedValue: "em_123" },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock("not an object")).toThrowError(
      /Invalid value for email.id: expected "em_123"$/,
    );
  });

  it("rejects http URLs in attachments_download_url", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            attachments_download_url: "http://example.com/attachments",
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("accepts https URLs in attachments_download_url", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            attachments_download_url:
              "https://api.primitive.dev/v1/downloads/attachments/token456",
          },
        },
      }).id,
    ).toBe("evt_abc123");
  });

  it("rejects fractional DKIM keyBits", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], keyBits: 1024.5 },
            ],
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects oversized DKIM keyBits", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], keyBits: 20000 },
            ],
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects negative forward attachment counters", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: false,
              results: [],
              attachments_found: -1,
              attachments_analyzed: 0,
              attachments_limit: null,
            },
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects zero forward attachments_limit", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: false,
              results: [],
              attachments_found: 0,
              attachments_analyzed: 0,
              attachments_limit: 0,
            },
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must be >= 1");
    }
  });

  it("formats minItems failures with item counts", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          smtp: {
            ...validPayload.email.smtp,
            rcpt_to: [],
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must have at least 1 item");
    }
  });

  it("formats minItems failures with plural item counts", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/smtp/rcpt_to",
          keyword: "minItems",
          params: { limit: 2 },
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /must have at least 2 items/,
    );
  });

  it("formats minItems failures when AJV omits the limit", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/smtp/rcpt_to",
          keyword: "minItems",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /must have at least 0 items/,
    );
  });

  it("formats minimum failures when AJV omits the limit", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/delivery/attempt",
          keyword: "minimum",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(/must be >= 0/);
  });

  it("formats maximum failures with numeric bounds", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], keyBits: 20000 },
            ],
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toContain("must be <= 16384");
    }
  });

  it("formats maximum failures when AJV omits the limit", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/delivery/attempt",
          keyword: "maximum",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(/must be <= 0/);
  });

  it("uses the default formatter for unsupported AJV keywords", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "customKeyword",
          params: {},
          schemaPath: "",
          message: "custom failure",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      const validationError = error as WebhookValidationError;
      expect(validationError.message).toBe(
        "Validation failed for email.id: custom failure",
      );
      expect(validationError.suggestion).toContain('"email.id"');
    }
  });

  it("falls back to the AJV keyword when an unsupported error omits its message", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email/id",
          keyword: "customKeyword",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock(
      "../../src/generated/email-received-event.validator.generated.js",
      () => ({
        default: mockedValidator,
      }),
    );

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(
      /Validation failed for email.id: customKeyword/,
    );
  });

  it("accepts valid integer forward attachment counters", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: true,
              results: [],
              attachments_found: 2,
              attachments_analyzed: 1,
              attachments_limit: 10,
            },
          },
        },
      }).id,
    ).toBe("evt_abc123");
  });
});
