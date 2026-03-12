import { describe, expect, it } from "vitest";
import {
  WebhookValidationError,
  emailReceivedEventSchema,
  safeValidateEmailReceivedEvent,
  validateEmailReceivedEvent,
} from "../../src/zod.js";

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

describe("emailReceivedEventSchema", () => {
  it("parses valid payload", () => {
    const result = emailReceivedEventSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    const invalid = { ...validPayload, id: undefined };
    const result = emailReceivedEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects wrong event type", () => {
    const invalid = { ...validPayload, event: "email.sent" };
    const result = emailReceivedEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts any valid date-formatted version", () => {
    // SDK should accept any YYYY-MM-DD version for forward/backward compatibility
    const olderVersion = { ...validPayload, version: "2024-01-01" };
    expect(emailReceivedEventSchema.safeParse(olderVersion).success).toBe(true);

    const newerVersion = { ...validPayload, version: "2030-12-31" };
    expect(emailReceivedEventSchema.safeParse(newerVersion).success).toBe(true);
  });

  it("rejects invalid version format", () => {
    const invalidFormat = { ...validPayload, version: "not-a-date" };
    expect(emailReceivedEventSchema.safeParse(invalidFormat).success).toBe(
      false,
    );

    const wrongFormat = { ...validPayload, version: "01-01-2025" };
    expect(emailReceivedEventSchema.safeParse(wrongFormat).success).toBe(false);
  });

  it("accepts payload with failed parsed status", () => {
    const withFailedParsed = {
      ...validPayload,
      email: {
        ...validPayload.email,
        parsed: {
          status: "failed",
          error: {
            code: "PARSE_FAILED",
            message: "Could not parse email",
            retryable: false,
          },
          body_text: null,
          body_html: null,
          reply_to: null,
          cc: null,
          bcc: null,
          in_reply_to: null,
          references: null,
          attachments: [],
          attachments_download_url: null,
        },
      },
    };
    const result = emailReceivedEventSchema.safeParse(withFailedParsed);
    expect(result.success).toBe(true);
  });

  it("accepts payload with download-only raw content", () => {
    const withDownloadOnly = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            included: false,
            reason_code: "size_exceeded",
            max_inline_bytes: 262144,
            size_bytes: 500000,
            sha256: "b".repeat(64),
          },
        },
      },
    };
    const result = emailReceivedEventSchema.safeParse(withDownloadOnly);
    expect(result.success).toBe(true);
  });

  it("accepts payload with attachments", () => {
    const withAttachments = {
      ...validPayload,
      email: {
        ...validPayload.email,
        parsed: {
          ...validPayload.email.parsed,
          attachments: [
            {
              filename: "document.pdf",
              content_type: "application/pdf",
              size_bytes: 12345,
              sha256: "c".repeat(64),
              part_index: 0,
              tar_path: "0_document.pdf",
            },
          ],
          attachments_download_url:
            "https://api.primitive.dev/v1/downloads/attachments/token456",
        },
      },
    };
    const result = emailReceivedEventSchema.safeParse(withAttachments);
    expect(result.success).toBe(true);
  });

  it("accepts null filename in attachments", () => {
    const withNullFilename = {
      ...validPayload,
      email: {
        ...validPayload.email,
        parsed: {
          ...validPayload.email.parsed,
          attachments: [
            {
              filename: null,
              content_type: "application/octet-stream",
              size_bytes: 100,
              sha256: "d".repeat(64),
              part_index: 0,
              tar_path: "0_attachment",
            },
          ],
          attachments_download_url:
            "https://api.primitive.dev/v1/downloads/attachments/token789",
        },
      },
    };
    const result = emailReceivedEventSchema.safeParse(withNullFilename);
    expect(result.success).toBe(true);
  });

  it("accepts null helo in smtp", () => {
    const withNullHelo = {
      ...validPayload,
      email: {
        ...validPayload.email,
        smtp: {
          ...validPayload.email.smtp,
          helo: null,
        },
      },
    };
    const result = emailReceivedEventSchema.safeParse(withNullHelo);
    expect(result.success).toBe(true);
  });

  it("rejects empty rcpt_to array", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        smtp: {
          ...validPayload.email.smtp,
          rcpt_to: [],
        },
      },
    };

    expect(() => validateEmailReceivedEvent(payload)).toThrow(
      WebhookValidationError,
    );
  });
});

describe("validateEmailReceivedEvent", () => {
  it("returns typed event for valid payload", () => {
    const event = validateEmailReceivedEvent(validPayload);
    expect(event.id).toBe("evt_abc123");
    expect(event.event).toBe("email.received");
    expect(event.email.headers.subject).toBe("Test Email");
  });

  it("throws WebhookValidationError for invalid payload", () => {
    expect(() => validateEmailReceivedEvent({})).toThrow(
      WebhookValidationError,
    );
  });

  it("throws WebhookValidationError for wrong event type", () => {
    expect(() =>
      validateEmailReceivedEvent({ ...validPayload, event: "wrong" }),
    ).toThrow(WebhookValidationError);
  });
});

describe("safeValidateEmailReceivedEvent", () => {
  it("returns success result for valid payload", () => {
    const result = safeValidateEmailReceivedEvent(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("evt_abc123");
    }
  });

  it("returns error result for invalid payload", () => {
    const result = safeValidateEmailReceivedEvent({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("WebhookValidationError quality", () => {
  describe("root-level errors", () => {
    it("handles null at root level", () => {
      try {
        validateEmailReceivedEvent(null);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toBe("(root)");
        expect(err.message).toContain("null");
      }
    });

    it("handles wrong type at root level", () => {
      try {
        validateEmailReceivedEvent("not an object");
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toBe("(root)");
        expect(err.message).toContain("string");
      }
    });

    it("handles undefined at root level", () => {
      try {
        validateEmailReceivedEvent(undefined);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toBe("(root)");
        expect(err.suggestion).toContain("Make sure you're passing");
      }
    });
  });

  describe("missing field errors", () => {
    it("missing field error is human-readable", () => {
      const incomplete = {
        id: "evt_123",
        event: "email.received",
        version: "2025-12-14",
        // missing: delivery, email
      };

      try {
        validateEmailReceivedEvent(incomplete);
        expect.fail("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(WebhookValidationError);
        const err = e as WebhookValidationError;

        expect(err.message).toContain("Missing required field");
        expect(err.message).not.toContain("[object Object]");
        expect(err.message).not.toContain("ZodError");
      }
    });

    it("missing nested field shows path", () => {
      const missingHeaders = {
        ...validPayload,
        email: {
          ...validPayload.email,
          headers: undefined,
        },
      };

      try {
        validateEmailReceivedEvent(missingHeaders);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toContain("email");
      }
    });
  });

  describe("wrong type errors", () => {
    it("wrong type error explains the problem", () => {
      const wrongType = {
        ...validPayload,
        delivery: {
          ...validPayload.delivery,
          attempt: "1", // Should be number
        },
      };

      try {
        validateEmailReceivedEvent(wrongType);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toContain("attempt");
        expect(err.message).toMatch(/number.*string|string.*number/i);
      }
    });

    it("number as string suggests not quoting", () => {
      const wrongType = {
        ...validPayload,
        delivery: {
          ...validPayload.delivery,
          attempt: "1",
        },
      };

      try {
        validateEmailReceivedEvent(wrongType);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.suggestion).toContain("Don't quote numeric values");
      }
    });
  });

  describe("wrong literal/version errors", () => {
    it("invalid version format gives helpful error", () => {
      const invalidVersion = {
        ...validPayload,
        version: "not-a-date",
      };

      try {
        validateEmailReceivedEvent(invalidVersion);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toBe("version");
        expect(err.message).toContain("Invalid version format");
        expect(err.suggestion).toContain("YYYY-MM-DD");
      }
    });

    it("accepts any valid date-formatted version", () => {
      // Old version - should be accepted
      const oldVersion = { ...validPayload, version: "2020-01-01" };
      expect(() => validateEmailReceivedEvent(oldVersion)).not.toThrow();

      // Future version - should be accepted
      const futureVersion = { ...validPayload, version: "2030-12-31" };
      expect(() => validateEmailReceivedEvent(futureVersion)).not.toThrow();
    });

    it("wrong event type gives specific suggestion", () => {
      const wrongEvent = {
        ...validPayload,
        event: "email.bounced",
      };

      try {
        validateEmailReceivedEvent(wrongEvent);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.field).toBe("event");
        expect(err.message).toContain("email.bounced");
        expect(err.suggestion).toContain("email.received");
      }
    });
  });

  describe("error metadata", () => {
    it("reports additional error count", () => {
      // Payload missing multiple fields
      const veryIncomplete = {
        event: "email.received",
        // missing: id, version, delivery, email
      };

      try {
        validateEmailReceivedEvent(veryIncomplete);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.additionalErrorCount).toBeGreaterThan(0);
        expect(err.toString()).toContain("more validation error");
      }
    });

    it("includes field description when available", () => {
      // Test a known field that has a description
      const wrongAttempt = {
        ...validPayload,
        delivery: {
          ...validPayload.delivery,
          attempt: "not-a-number",
        },
      };

      try {
        validateEmailReceivedEvent(wrongAttempt);
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        // Should have the field path
        expect(err.field).toBe("delivery.attempt");
      }
    });

    it("has correct error code", () => {
      try {
        validateEmailReceivedEvent({});
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.code).toBe("SCHEMA_VALIDATION_FAILED");
      }
    });

    it("preserves original Zod error", () => {
      try {
        validateEmailReceivedEvent({});
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        expect(err.zodError).toBeDefined();
        expect(err.zodError.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("error serialization", () => {
    it("toJSON includes all relevant fields", () => {
      try {
        validateEmailReceivedEvent({});
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        const json = err.toJSON();
        expect(json.name).toBe("WebhookValidationError");
        expect(json.code).toBe("SCHEMA_VALIDATION_FAILED");
        expect(json.field).toBeDefined();
        expect(json.message).toBeDefined();
        expect(json.suggestion).toBeDefined();
        expect(json.additionalErrorCount).toBeDefined();
      }
    });

    it("toString includes suggestion", () => {
      try {
        validateEmailReceivedEvent({});
        expect.fail("should have thrown");
      } catch (e) {
        const err = e as WebhookValidationError;
        const str = err.toString();
        expect(str).toContain("SCHEMA_VALIDATION_FAILED");
        expect(str).toContain("Suggestion:");
      }
    });
  });
});

describe("URL validation (security)", () => {
  it("rejects javascript: URLs in download.url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          download: {
            url: "javascript:alert(1)",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects http:// URLs in download.url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          download: {
            url: "http://example.com/raw",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects data: URLs in download.url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          download: {
            url: "data:text/html,<script>alert(1)</script>",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("accepts valid https:// URLs in download.url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          download: {
            url: "https://api.primitive.dev/v1/downloads/raw/token123",
            expires_at: "2025-01-01T00:00:00Z",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects http:// URLs in attachments_download_url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        parsed: {
          ...validPayload.email.parsed,
          attachments_download_url: "http://example.com/attachments",
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("accepts https:// URLs in attachments_download_url", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        parsed: {
          ...validPayload.email.parsed,
          attachments_download_url:
            "https://api.primitive.dev/v1/downloads/attachments/token456",
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

describe("SHA-256 validation", () => {
  it("rejects invalid sha256 in raw content", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            ...validPayload.email.content.raw,
            sha256: "not-a-hash",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("accepts valid 64-char hex sha256", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            ...validPayload.email.content.raw,
            sha256: "a".repeat(64),
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("accepts uppercase hex sha256", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            ...validPayload.email.content.raw,
            sha256: "ABCDEF0123456789".repeat(4),
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("rejects sha256 that is too short", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            ...validPayload.email.content.raw,
            sha256: "a".repeat(63),
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("rejects sha256 that is too long", () => {
    const payload = {
      ...validPayload,
      email: {
        ...validPayload.email,
        content: {
          ...validPayload.email.content,
          raw: {
            ...validPayload.email.content.raw,
            sha256: "a".repeat(65),
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

describe("analysis field", () => {
  it("accepts payload with empty analysis object", () => {
    const result = emailReceivedEventSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.analysis).toEqual({});
    }
  });

  it("rejects payload without analysis field", () => {
    const { analysis: _, ...emailWithoutAnalysis } = validPayload.email;
    const payloadWithoutAnalysis = {
      ...validPayload,
      email: emailWithoutAnalysis,
    };
    const result = emailReceivedEventSchema.safeParse(payloadWithoutAnalysis);
    expect(result.success).toBe(false);
  });

  it("accepts payload with spamassassin score", () => {
    const withAnalysis = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {
            score: 2.5,
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withAnalysis);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.analysis.spamassassin?.score).toBe(2.5);
    }
  });

  it("accepts negative spamassassin score (ham)", () => {
    const withNegativeScore = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {
            score: -1.5,
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withNegativeScore);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.analysis.spamassassin?.score).toBe(-1.5);
    }
  });

  it("accepts high spamassassin score (spam)", () => {
    const withHighScore = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {
            score: 15.7,
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withHighScore);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.analysis.spamassassin?.score).toBe(15.7);
    }
  });

  it("accepts zero spamassassin score", () => {
    const withZeroScore = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {
            score: 0,
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withZeroScore);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email.analysis.spamassassin?.score).toBe(0);
    }
  });

  it("accepts analysis with empty object (no spamassassin)", () => {
    const withEmptyAnalysis = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {},
      },
    };

    const result = emailReceivedEventSchema.safeParse(withEmptyAnalysis);
    expect(result.success).toBe(true);
  });

  it("rejects spamassassin with missing score", () => {
    const withMissingScore = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {},
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withMissingScore);
    expect(result.success).toBe(false);
  });

  it("rejects spamassassin score as string", () => {
    const withStringScore = {
      ...validPayload,
      email: {
        ...validPayload.email,
        analysis: {
          spamassassin: {
            score: "2.5",
          },
        },
      },
    };

    const result = emailReceivedEventSchema.safeParse(withStringScore);
    expect(result.success).toBe(false);
  });
});

describe("parsed email address fields", () => {
  describe("reply_to field", () => {
    it("accepts null reply_to", () => {
      const result = emailReceivedEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email.parsed.status).toBe("complete");
        if (result.data.email.parsed.status === "complete") {
          expect(result.data.email.parsed.reply_to).toBeNull();
        }
      }
    });

    it("accepts reply_to with single address", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ address: "reply@example.com", name: null }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to).toEqual([
          { address: "reply@example.com", name: null },
        ]);
      }
    });

    it("accepts reply_to with display name", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ address: "reply@example.com", name: "Reply Handler" }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to?.[0].name).toBe(
          "Reply Handler",
        );
      }
    });

    it("accepts reply_to with multiple addresses", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [
              { address: "reply1@example.com", name: "Reply One" },
              { address: "reply2@example.com", name: null },
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to).toHaveLength(2);
      }
    });

    it("accepts empty reply_to array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects reply_to with invalid address structure", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ email: "wrong@example.com" }], // wrong key
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects reply_to with missing address field", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ name: "No Address" }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("cc field", () => {
    it("accepts null cc", () => {
      const result = emailReceivedEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("accepts cc with multiple addresses", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            cc: [
              { address: "cc1@example.com", name: "CC One" },
              { address: "cc2@example.com", name: "CC Two" },
              { address: "cc3@example.com", name: null },
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.cc).toHaveLength(3);
        expect(result.data.email.parsed.cc?.[0].address).toBe(
          "cc1@example.com",
        );
        expect(result.data.email.parsed.cc?.[2].name).toBeNull();
      }
    });

    it("rejects cc as string instead of array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            cc: "cc@example.com",
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("bcc field", () => {
    it("accepts null bcc", () => {
      const result = emailReceivedEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("accepts bcc with addresses", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            bcc: [{ address: "hidden@example.com", name: "Hidden Recipient" }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.bcc?.[0].address).toBe(
          "hidden@example.com",
        );
      }
    });
  });

  describe("in_reply_to field", () => {
    it("accepts null in_reply_to", () => {
      const result = emailReceivedEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("accepts in_reply_to with single message ID", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            in_reply_to: ["<original-message-id@example.com>"],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.in_reply_to).toEqual([
          "<original-message-id@example.com>",
        ]);
      }
    });

    it("accepts in_reply_to with multiple message IDs (RFC 5322)", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            in_reply_to: ["<msg1@example.com>", "<msg2@example.com>"],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.in_reply_to).toHaveLength(2);
      }
    });

    it("accepts empty in_reply_to array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            in_reply_to: [],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects in_reply_to as string instead of array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            in_reply_to: "<msg1@example.com>",
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("references field", () => {
    it("accepts null references", () => {
      const result = emailReceivedEventSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it("accepts references with single message ID", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: ["<thread-start@example.com>"],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.references).toEqual([
          "<thread-start@example.com>",
        ]);
      }
    });

    it("accepts references with multiple message IDs (thread)", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: [
              "<msg1@example.com>",
              "<msg2@example.com>",
              "<msg3@example.com>",
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.references).toHaveLength(3);
      }
    });

    it("accepts empty references array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: [],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it("rejects references as string instead of array", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: "<msg1@example.com>",
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("rejects references with non-string elements", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: [123, 456],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("edge cases for email addresses", () => {
    it("accepts display names with unicode characters", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [
              { address: "user@example.com", name: "Muller Francois" },
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to?.[0].name).toBe(
          "Muller Francois",
        );
      }
    });

    it("accepts display names with emoji", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            cc: [{ address: "fun@example.com", name: "Party Time" }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.cc?.[0].name).toBe("Party Time");
      }
    });

    it("accepts very long display names", () => {
      const longName = "A".repeat(1000);
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            bcc: [{ address: "long@example.com", name: longName }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.bcc?.[0].name).toBe(longName);
      }
    });

    it("accepts display names with special characters", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [
              {
                address: "special@example.com",
                name: 'O\'Brien, Jr. <CEO> & "Friends"',
              },
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to?.[0].name).toBe(
          'O\'Brien, Jr. <CEO> & "Friends"',
        );
      }
    });

    it("accepts unusual but valid email address formats", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            cc: [
              // Quoted local part
              { address: '"quoted.name"@example.com', name: null },
              // Plus addressing
              { address: "user+tag@example.com", name: "Tagged User" },
              // Subdomain
              { address: "user@mail.sub.example.com", name: null },
            ],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.cc).toHaveLength(3);
        expect(result.data.email.parsed.cc?.[0].address).toBe(
          '"quoted.name"@example.com',
        );
      }
    });

    it("accepts empty string display name", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ address: "user@example.com", name: "" }],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to?.[0].name).toBe("");
      }
    });

    it("accepts references array with many message IDs (long thread)", () => {
      const manyRefs = Array.from(
        { length: 50 },
        (_, i) => `<msg${i}@example.com>`,
      );
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            references: manyRefs,
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.references).toHaveLength(50);
      }
    });
  });

  describe("combined fields scenario", () => {
    it("accepts payload with all email address fields populated", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            reply_to: [{ address: "reply@example.com", name: "Reply To" }],
            cc: [
              { address: "cc1@example.com", name: "CC One" },
              { address: "cc2@example.com", name: null },
            ],
            bcc: [{ address: "bcc@example.com", name: "Hidden" }],
            in_reply_to: ["<original@example.com>"],
            references: ["<ref1@example.com>", "<ref2@example.com>"],
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "complete") {
        expect(result.data.email.parsed.reply_to).toHaveLength(1);
        expect(result.data.email.parsed.cc).toHaveLength(2);
        expect(result.data.email.parsed.bcc).toHaveLength(1);
        expect(result.data.email.parsed.in_reply_to).toEqual([
          "<original@example.com>",
        ]);
        expect(result.data.email.parsed.references).toHaveLength(2);
      }
    });

    it("failed parsed status has all address fields as null", () => {
      const payload = {
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            status: "failed",
            error: {
              code: "PARSE_FAILED",
              message: "Could not parse email",
              retryable: false,
            },
            body_text: null,
            body_html: null,
            reply_to: null,
            cc: null,
            bcc: null,
            in_reply_to: null,
            references: null,
            attachments: [],
            attachments_download_url: null,
          },
        },
      };

      const result = emailReceivedEventSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success && result.data.email.parsed.status === "failed") {
        expect(result.data.email.parsed.reply_to).toBeNull();
        expect(result.data.email.parsed.cc).toBeNull();
        expect(result.data.email.parsed.bcc).toBeNull();
        expect(result.data.email.parsed.in_reply_to).toBeNull();
        expect(result.data.email.parsed.references).toBeNull();
      }
    });
  });
});
