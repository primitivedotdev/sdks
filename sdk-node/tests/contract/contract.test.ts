import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import * as contractPackage from "../../src/contract/index.js";
import {
  type BuildEventFromParsedDataOptions,
  buildEmailReceivedEvent,
  buildEventFromParsedData,
  type EmailAnalysis,
  type EmailAuth,
  type EmailReceivedEventInput,
  generateEventId,
  type ParsedDataComplete,
  type ParsedInputComplete,
  type ParsedInputFailed,
  RAW_EMAIL_INLINE_THRESHOLD,
  WEBHOOK_VERSION,
} from "../../src/contract/index.js";
import { validateEmailReceivedEvent } from "../../src/webhook/index.js";

describe("contract", () => {
  describe("constants", () => {
    it("exports correct inline threshold", () => {
      expect(RAW_EMAIL_INLINE_THRESHOLD).toBe(262144);
    });

    it("exports correct webhook version", () => {
      expect(WEBHOOK_VERSION).toBe("2025-12-14");
    });

    it("re-exports the contract API from the package root", () => {
      expect(contractPackage.buildEmailReceivedEvent).toBe(
        buildEmailReceivedEvent,
      );
      expect(contractPackage.generateEventId).toBe(generateEventId);
    });
  });

  describe("generateEventId", () => {
    it("generates deterministic event IDs", () => {
      const id1 = generateEventId("endpoint-123", "email-456");
      const id2 = generateEventId("endpoint-123", "email-456");
      expect(id1).toBe(id2);
    });

    it("generates different IDs for different inputs", () => {
      const id1 = generateEventId("endpoint-123", "email-456");
      const id2 = generateEventId("endpoint-123", "email-789");
      const id3 = generateEventId("endpoint-456", "email-456");
      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
    });

    it("returns evt_ prefixed string", () => {
      const id = generateEventId("endpoint-123", "email-456");
      expect(id).toMatch(/^evt_[a-f0-9]+$/);
    });

    it("includes the webhook version in the event ID hash for old SDK compat", () => {
      const id = generateEventId("endpoint-123", "email-456");
      const versionedHash = createHash("sha256")
        .update(`email.received:${WEBHOOK_VERSION}:endpoint-123:email-456`)
        .digest("hex");

      expect(id).toBe(`evt_${versionedHash}`);
    });
  });

  describe("buildEmailReceivedEvent", () => {
    const rawBytes = Buffer.from(
      "From: from@example.com\r\nTo: to@example.com\r\n\r\nTest body",
    );
    const rawSha256 = createHash("sha256").update(rawBytes).digest("hex");

    const baseInput: EmailReceivedEventInput = {
      email_id: "email-123",
      endpoint_id: "endpoint-456",
      message_id: "<msg@example.com>",
      sender: "from@example.com",
      recipient: "to@example.com",
      subject: "Test Subject",
      received_at: "2025-01-01T12:00:00Z",
      smtp_helo: "mail.example.com",
      smtp_mail_from: "from@example.com",
      smtp_rcpt_to: ["to@example.com"],
      raw_bytes: rawBytes,
      raw_sha256: rawSha256,
      raw_size_bytes: rawBytes.length,
      attempt_count: 1,
      date_header: "Wed, 1 Jan 2025 12:00:00 +0000",
      download_url: "https://example.com/download/email-123",
      download_expires_at: "2025-01-02T12:00:00Z",
      attachments_download_url: null,
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
      analysis: {},
    };

    it("builds valid EmailReceivedEvent", () => {
      const event = buildEmailReceivedEvent(baseInput, {
        event_id:
          "evt_fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
        attempted_at: "2025-01-01T12:01:00Z",
      });

      expect(event.id).toBe(
        "evt_fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      );
      expect(event.event).toBe("email.received");
      expect(event.version).toBe("2025-12-14");
      expect(event.delivery.endpoint_id).toBe("endpoint-456");
      expect(event.delivery.attempt).toBe(1);
      expect(event.delivery.attempted_at).toBe("2025-01-01T12:01:00Z");
      expect(event.email.id).toBe("email-123");
      expect(event.email.received_at).toBe("2025-01-01T12:00:00Z");
      expect(event.email.smtp.helo).toBe("mail.example.com");
      expect(event.email.smtp.mail_from).toBe("from@example.com");
      expect(event.email.smtp.rcpt_to).toEqual(["to@example.com"]);
      expect(event.email.headers.message_id).toBe("<msg@example.com>");
      expect(event.email.headers.subject).toBe("Test Subject");
      expect(event.email.headers.from).toBe("from@example.com");
      expect(event.email.headers.to).toBe("to@example.com");
      expect(event.email.headers.date).toBe("Wed, 1 Jan 2025 12:00:00 +0000");
    });

    it("produces events that validate against the sdk schema", () => {
      const event = buildEmailReceivedEvent(baseInput);

      expect(validateEmailReceivedEvent(event)).toEqual(event);
    });

    it("accepts schema-valid RFC 3339 timestamps with explicit offsets", () => {
      const event = buildEmailReceivedEvent(
        {
          ...baseInput,
          received_at: "2025-01-01T12:00:00+00:00",
          download_expires_at: "2025-01-02T12:00:00+00:00",
        },
        {
          attempted_at: "2025-01-01T12:01:00+00:00",
        },
      );

      expect(event.email.received_at).toBe("2025-01-01T12:00:00+00:00");
      expect(event.email.content.download.expires_at).toBe(
        "2025-01-02T12:00:00+00:00",
      );
      expect(event.delivery.attempted_at).toBe("2025-01-01T12:01:00+00:00");
    });

    it("does not require attachments_storage_key in parsed input", () => {
      const parsed: ParsedInputComplete = {
        status: "complete",
        body_text: "Plain text body",
        body_html: "<p>HTML body</p>",
        attachments: [],
      };

      const event = buildEmailReceivedEvent({
        ...baseInput,
        parsed,
      });

      expect(event.email.parsed.status).toBe("complete");
    });

    it("inlines small raw emails", () => {
      const event = buildEmailReceivedEvent(baseInput);

      expect(event.email.content.raw.included).toBe(true);
      if (event.email.content.raw.included) {
        expect(event.email.content.raw.encoding).toBe("base64");
        expect(event.email.content.raw.data).toBe(
          baseInput.raw_bytes.toString("base64"),
        );
      }
    });

    it("excludes large raw emails", () => {
      const largeRawBytes = Buffer.alloc(RAW_EMAIL_INLINE_THRESHOLD + 1, "x");
      const largeInput: EmailReceivedEventInput = {
        ...baseInput,
        raw_bytes: largeRawBytes,
        raw_sha256: createHash("sha256").update(largeRawBytes).digest("hex"),
        raw_size_bytes: largeRawBytes.length,
      };

      const event = buildEmailReceivedEvent(largeInput);

      expect(event.email.content.raw.included).toBe(false);
      if (!event.email.content.raw.included) {
        expect(event.email.content.raw.reason_code).toBe("size_exceeded");
        expect("data" in event.email.content.raw).toBe(false);
      }
    });

    it("preserves parsed bodies for large emails", () => {
      const largeRawBytes = Buffer.alloc(RAW_EMAIL_INLINE_THRESHOLD + 1, "x");
      const parsed: ParsedInputComplete = {
        status: "complete",
        body_text: "This would be a very large body",
        body_html: "<p>This would be very large HTML</p>",
        attachments: [],
        attachments_storage_key: null,
      };

      const largeInput: EmailReceivedEventInput = {
        ...baseInput,
        raw_bytes: largeRawBytes,
        raw_sha256: createHash("sha256").update(largeRawBytes).digest("hex"),
        raw_size_bytes: largeRawBytes.length,
        parsed,
      };

      const event = buildEmailReceivedEvent(largeInput);

      expect(event.email.content.raw.included).toBe(false);
      expect(event.email.parsed.status).toBe("complete");
      if (event.email.parsed.status === "complete") {
        expect(event.email.parsed.body_text).toBe(
          "This would be a very large body",
        );
        expect(event.email.parsed.body_html).toBe(
          "<p>This would be very large HTML</p>",
        );
        expect(event.email.parsed.attachments).toEqual([]);
      }
    });

    it("handles parsed complete status", () => {
      const parsed: ParsedInputComplete = {
        status: "complete",
        body_text: "Plain text body",
        body_html: '<p>HTML body</p><img src="x" onerror="alert(1)">',
        attachments: [
          {
            filename: "test.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
            sha256: "b".repeat(64),
            part_index: 1,
            tar_path: "attachments/test.pdf",
          },
        ],
        attachments_storage_key: "storage/attachments.tar.gz",
      };

      const inputWithParsed: EmailReceivedEventInput = {
        ...baseInput,
        parsed,
        attachments_download_url: "https://example.com/attachments.tar.gz",
      };

      const event = buildEmailReceivedEvent(inputWithParsed);

      expect(event.email.parsed.status).toBe("complete");
      if (event.email.parsed.status === "complete") {
        expect(event.email.parsed.error).toBeNull();
        expect(event.email.parsed.body_text).toBe("Plain text body");
        expect(event.email.parsed.body_html).toBe(
          '<p>HTML body</p><img src="x" onerror="alert(1)">',
        );
        expect(event.email.parsed.attachments).toHaveLength(1);
        expect(event.email.parsed.attachments[0].filename).toBe("test.pdf");
        expect(event.email.parsed.attachments_download_url).toBe(
          "https://example.com/attachments.tar.gz",
        );
      }
    });

    it("forces attachments_download_url to null when there are no attachments", () => {
      const parsed: ParsedInputComplete = {
        status: "complete",
        body_text: "Plain text body",
        body_html: "<p>HTML body</p>",
        attachments: [],
        attachments_storage_key: null,
      };

      const event = buildEmailReceivedEvent({
        ...baseInput,
        parsed,
        attachments_download_url: "https://example.com/attachments.tar.gz",
      });

      expect(event.email.parsed.status).toBe("complete");
      if (event.email.parsed.status === "complete") {
        expect(event.email.parsed.attachments).toEqual([]);
        expect(event.email.parsed.attachments_download_url).toBeNull();
      }
    });

    it("handles parsed failed status", () => {
      const parsed: ParsedInputFailed = {
        status: "failed",
        error: {
          code: "PARSE_FAILED",
          message: "Invalid MIME structure",
          retryable: false,
        },
      };

      const inputWithParsed: EmailReceivedEventInput = {
        ...baseInput,
        parsed,
      };

      const event = buildEmailReceivedEvent(inputWithParsed);

      expect(event.email.parsed.status).toBe("failed");
      if (event.email.parsed.status === "failed") {
        expect(event.email.parsed.error.code).toBe("PARSE_FAILED");
        expect(event.email.parsed.error.message).toBe("Invalid MIME structure");
        expect(event.email.parsed.body_text).toBeNull();
        expect(event.email.parsed.body_html).toBeNull();
        expect(event.email.parsed.attachments).toEqual([]);
      }
    });

    it("defaults to failed parsed status when not provided", () => {
      const event = buildEmailReceivedEvent(baseInput);

      expect(event.email.parsed.status).toBe("failed");
      if (event.email.parsed.status === "failed") {
        expect(event.email.parsed.error.code).toBe("PARSE_FAILED");
        expect(event.email.parsed.error.message).toBe("Parsing not attempted");
      }
    });

    it("rejects mismatched raw_size_bytes", () => {
      expect(() =>
        buildEmailReceivedEvent({
          ...baseInput,
          raw_size_bytes: baseInput.raw_size_bytes + 1,
        }),
      ).toThrow(/raw_size_bytes/);
    });

    it("rejects mismatched raw_sha256", () => {
      expect(() =>
        buildEmailReceivedEvent({
          ...baseInput,
          raw_sha256: "0".repeat(64),
        }),
      ).toThrow(/raw_sha256/);
    });

    describe("email address fields", () => {
      it("defaults new address fields to null when not provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        expect(event.email.parsed.status).toBe("complete");
        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.reply_to).toBeNull();
          expect(event.email.parsed.cc).toBeNull();
          expect(event.email.parsed.bcc).toBeNull();
          expect(event.email.parsed.in_reply_to).toBeNull();
          expect(event.email.parsed.references).toBeNull();
        }
      });

      it("includes reply_to when provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          reply_to: [
            { address: "reply@example.com", name: "Reply Handler" },
            { address: "reply2@example.com", name: null },
          ],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.reply_to).toHaveLength(2);
          expect(event.email.parsed.reply_to?.[0].address).toBe(
            "reply@example.com",
          );
          expect(event.email.parsed.reply_to?.[0].name).toBe("Reply Handler");
          expect(event.email.parsed.reply_to?.[1].name).toBeNull();
        }
      });

      it("includes cc when provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          cc: [
            { address: "cc1@example.com", name: "CC One" },
            { address: "cc2@example.com", name: "CC Two" },
          ],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.cc).toHaveLength(2);
          expect(event.email.parsed.cc?.[0].address).toBe("cc1@example.com");
        }
      });

      it("includes bcc when provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          bcc: [{ address: "hidden@example.com", name: "Hidden Recipient" }],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.bcc).toHaveLength(1);
          expect(event.email.parsed.bcc?.[0].address).toBe(
            "hidden@example.com",
          );
        }
      });

      it("includes in_reply_to when provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          in_reply_to: ["<original-message@example.com>"],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.in_reply_to).toEqual([
            "<original-message@example.com>",
          ]);
        }
      });

      it("includes references when provided", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          references: [
            "<msg1@example.com>",
            "<msg2@example.com>",
            "<msg3@example.com>",
          ],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.references).toHaveLength(3);
          expect(event.email.parsed.references?.[0]).toBe("<msg1@example.com>");
        }
      });

      it("includes all address fields when provided together", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: "<p>Test</p>",
          reply_to: [{ address: "reply@example.com", name: "Reply" }],
          cc: [{ address: "cc@example.com", name: null }],
          bcc: [{ address: "bcc@example.com", name: "Hidden" }],
          in_reply_to: ["<original@example.com>"],
          references: ["<ref1@example.com>", "<ref2@example.com>"],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.reply_to).toHaveLength(1);
          expect(event.email.parsed.cc).toHaveLength(1);
          expect(event.email.parsed.bcc).toHaveLength(1);
          expect(event.email.parsed.in_reply_to).toHaveLength(1);
          expect(event.email.parsed.references).toHaveLength(2);
        }
      });

      it("sets address fields to null for failed parsed status", () => {
        const parsed: ParsedInputFailed = {
          status: "failed",
          error: {
            code: "PARSE_FAILED",
            message: "Could not parse",
            retryable: false,
          },
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "failed") {
          expect(event.email.parsed.reply_to).toBeNull();
          expect(event.email.parsed.cc).toBeNull();
          expect(event.email.parsed.bcc).toBeNull();
          expect(event.email.parsed.in_reply_to).toBeNull();
          expect(event.email.parsed.references).toBeNull();
        }
      });

      it("sets address fields to null when no parsed data provided", () => {
        const event = buildEmailReceivedEvent(baseInput);

        if (event.email.parsed.status === "failed") {
          expect(event.email.parsed.reply_to).toBeNull();
          expect(event.email.parsed.cc).toBeNull();
          expect(event.email.parsed.bcc).toBeNull();
          expect(event.email.parsed.in_reply_to).toBeNull();
          expect(event.email.parsed.references).toBeNull();
        }
      });

      it("preserves empty arrays for address fields", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          reply_to: [],
          cc: [],
          bcc: [],
          in_reply_to: [],
          references: [],
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.reply_to).toEqual([]);
          expect(event.email.parsed.cc).toEqual([]);
          expect(event.email.parsed.bcc).toEqual([]);
          expect(event.email.parsed.in_reply_to).toEqual([]);
          expect(event.email.parsed.references).toEqual([]);
        }
      });

      it("handles explicit null values for address fields", () => {
        const parsed: ParsedInputComplete = {
          status: "complete",
          body_text: "Test body",
          body_html: null,
          reply_to: null,
          cc: null,
          bcc: null,
          in_reply_to: null,
          references: null,
          attachments: [],
          attachments_storage_key: null,
        };

        const event = buildEmailReceivedEvent({ ...baseInput, parsed });

        if (event.email.parsed.status === "complete") {
          expect(event.email.parsed.reply_to).toBeNull();
          expect(event.email.parsed.cc).toBeNull();
          expect(event.email.parsed.bcc).toBeNull();
          expect(event.email.parsed.in_reply_to).toBeNull();
          expect(event.email.parsed.references).toBeNull();
        }
      });
    });

    it("handles null values correctly", () => {
      const inputWithNulls: EmailReceivedEventInput = {
        ...baseInput,
        message_id: null,
        subject: null,
        smtp_helo: null,
        date_header: null,
      };

      const event = buildEmailReceivedEvent(inputWithNulls);

      expect(event.email.headers.message_id).toBeNull();
      expect(event.email.headers.subject).toBeNull();
      expect(event.email.smtp.helo).toBeNull();
      expect(event.email.headers.date).toBeNull();
    });

    it("generates event ID when not provided", () => {
      const event = buildEmailReceivedEvent(baseInput);

      expect(event.id).toMatch(/^evt_/);
    });

    it("uses current time for attempted_at when not provided", () => {
      const before = new Date().toISOString();
      const event = buildEmailReceivedEvent(baseInput);
      const after = new Date().toISOString();

      expect(event.delivery.attempted_at >= before).toBe(true);
      expect(event.delivery.attempted_at <= after).toBe(true);
    });

    describe("ISO 8601 timestamp validation", () => {
      it("accepts valid ISO 8601 with milliseconds", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025-01-15T10:30:00.123Z",
          download_expires_at: "2025-01-16T10:30:00.456Z",
        };

        const event = buildEmailReceivedEvent(input);
        expect(event.email.received_at).toBe("2025-01-15T10:30:00.123Z");
      });

      it("accepts valid ISO 8601 without milliseconds", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025-01-15T10:30:00Z",
        };

        const event = buildEmailReceivedEvent(input);
        expect(event.email.received_at).toBe("2025-01-15T10:30:00Z");
      });

      it("rejects loose date formats like 'Tuesday'", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "Tuesday",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /Invalid received_at/,
        );
      });

      it("rejects American date format like 'Jan 15, 2025'", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "Jan 15, 2025",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /Invalid received_at/,
        );
      });

      it("rejects date without time", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025-01-15",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /Invalid received_at/,
        );
      });

      it("accepts explicit UTC offsets", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025-01-15T10:30:00+05:00",
        };

        expect(buildEmailReceivedEvent(input).email.received_at).toBe(
          "2025-01-15T10:30:00+05:00",
        );
      });

      it("rejects empty string", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /Invalid received_at/,
        );
      });

      it("error message includes the invalid timestamp", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "not-a-date",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(/not-a-date/);
      });

      it("error message suggests correct format", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025/01/15",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(/RFC 3339/);
        expect(() => buildEmailReceivedEvent(input)).toThrow(/\+00:00/);
      });

      it("rejects invalid download_expires_at format", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          download_expires_at: "not-a-date",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /Invalid download_expires_at/,
        );
      });

      it("rejects invalid attempted_at override format", () => {
        expect(() =>
          buildEmailReceivedEvent(baseInput, {
            attempted_at: "Tuesday",
          }),
        ).toThrow(/Invalid attempted_at/);
      });

      it("rejects regex-shaped timestamps that are not real dates", () => {
        const input: EmailReceivedEventInput = {
          ...baseInput,
          received_at: "2025-99-99T99:99:99Z",
        };

        expect(() => buildEmailReceivedEvent(input)).toThrow(
          /not a valid date/,
        );
      });
    });
  });

  describe("buildEventFromParsedData", () => {
    const rawBytes = Buffer.from(
      "From: from@example.com\r\nTo: to@example.com\r\n\r\nTest body",
    );

    const emptyParsed: ParsedDataComplete = {
      status: "complete",
      error: null,
      body_text: "Test body",
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    };

    const auth: EmailAuth = {
      spf: "pass",
      dmarc: "pass",
      dmarcPolicy: "reject",
      dmarcFromDomain: "example.com",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dmarcSpfStrict: false,
      dmarcDkimStrict: false,
      dkimSignatures: [],
    };

    const analysis: EmailAnalysis = {};

    const baseOptions: BuildEventFromParsedDataOptions = {
      emailId: "email_self_host_1",
      endpointId: "endpoint_local",
      rawBytes,
      parsed: emptyParsed,
      messageId: "<abc@example.com>",
      sender: "from@example.com",
      recipient: "to@example.com",
      subject: "Test Subject",
      receivedAt: "2025-01-01T12:00:00Z",
      smtpHelo: "mail.example.com",
      smtpMailFrom: "from@example.com",
      smtpRcptTo: ["to@example.com"],
      auth,
      analysis,
      downloadUrl: "https://example.com/download/email-123",
      downloadExpiresAt: "2025-01-02T12:00:00Z",
      attachmentsDownloadUrl: null,
      attemptCount: 1,
      dateHeader: "Wed, 1 Jan 2025 12:00:00 +0000",
    };

    it("builds a schema-valid event for a plain text email with no attachments", () => {
      const event = buildEventFromParsedData(baseOptions);
      expect(validateEmailReceivedEvent(event)).toEqual(event);
      expect(event.email.parsed.status).toBe("complete");
      if (event.email.parsed.status === "complete") {
        expect(event.email.parsed.attachments).toEqual([]);
        expect(event.email.parsed.attachments_download_url).toBeNull();
      }
    });

    it("populates content.attachments and attachmentsDownloadUrl together", () => {
      const withAttachment: ParsedDataComplete = {
        ...emptyParsed,
        attachments: [
          {
            filename: "doc.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
            sha256: "c".repeat(64),
            part_index: 0,
            tar_path: "0_doc.pdf",
          },
        ],
        attachments_download_url:
          "https://example.com/attachments/email-123.tar.gz",
      };

      const event = buildEventFromParsedData({
        ...baseOptions,
        parsed: withAttachment,
        attachmentsDownloadUrl:
          "https://example.com/attachments/email-123.tar.gz",
      });

      expect(event.email.parsed.status).toBe("complete");
      if (event.email.parsed.status === "complete") {
        expect(event.email.parsed.attachments).toHaveLength(1);
        expect(event.email.parsed.attachments[0].filename).toBe("doc.pdf");
        expect(event.email.parsed.attachments_download_url).toBe(
          "https://example.com/attachments/email-123.tar.gz",
        );
      }
    });

    it("omits raw.data for emails over the inline threshold", () => {
      const large = Buffer.alloc(RAW_EMAIL_INLINE_THRESHOLD + 1, "x");
      const event = buildEventFromParsedData({
        ...baseOptions,
        rawBytes: large,
      });

      expect(event.email.content.raw.included).toBe(false);
      expect(event.email.content.download.url).toBe(baseOptions.downloadUrl);
      if (!event.email.content.raw.included) {
        expect("data" in event.email.content.raw).toBe(false);
      }
    });

    it("includes both raw.data and download.url for emails under the threshold", () => {
      const event = buildEventFromParsedData(baseOptions);

      expect(event.email.content.raw.included).toBe(true);
      expect(event.email.content.download.url).toBe(baseOptions.downloadUrl);
      if (event.email.content.raw.included) {
        expect(event.email.content.raw.data).toBe(rawBytes.toString("base64"));
        const expectedSha = createHash("sha256").update(rawBytes).digest("hex");
        expect(event.email.content.raw.sha256).toBe(expectedSha);
      }
    });

    it("accepts messageId === null without crashing", () => {
      const event = buildEventFromParsedData({
        ...baseOptions,
        messageId: null,
      });
      expect(event.email.headers.message_id).toBeNull();
    });

    it("preserves non-ASCII subject text", () => {
      const subject = "Résumé from 山田太郎 — ★ 2025";
      const event = buildEventFromParsedData({
        ...baseOptions,
        subject,
      });
      expect(event.email.headers.subject).toBe(subject);
    });

    it("produces the expected rcpt_to array for multiple recipients", () => {
      const event = buildEventFromParsedData({
        ...baseOptions,
        smtpRcptTo: ["first@example.com", "second@example.com"],
      });
      expect(event.email.smtp.rcpt_to).toEqual([
        "first@example.com",
        "second@example.com",
      ]);
    });

    it("throws when attachmentsDownloadUrl is non-null with zero attachments", () => {
      expect(() =>
        buildEventFromParsedData({
          ...baseOptions,
          attachmentsDownloadUrl: "https://example.com/should-not-be-set",
        }),
      ).toThrow(/attachments/i);
    });

    it("throws when attachmentsDownloadUrl is null with attachments present", () => {
      const withAttachment: ParsedDataComplete = {
        ...emptyParsed,
        attachments: [
          {
            filename: "doc.pdf",
            content_type: "application/pdf",
            size_bytes: 1024,
            sha256: "c".repeat(64),
            part_index: 0,
            tar_path: "0_doc.pdf",
          },
        ],
        attachments_download_url: null,
      };

      expect(() =>
        buildEventFromParsedData({
          ...baseOptions,
          parsed: withAttachment,
          attachmentsDownloadUrl: null,
        }),
      ).toThrow(/attachments/i);
    });

    it("throws when smtpRcptTo is empty (runtime guard for untyped callers)", () => {
      // The tuple type `[string, ...string[]]` catches this at compile time for
      // typed callers; the cast simulates a JS or type-cast caller slipping past.
      expect(() =>
        buildEventFromParsedData({
          ...baseOptions,
          smtpRcptTo: [] as unknown as [string, ...string[]],
        }),
      ).toThrow(/smtpRcptTo/);
    });

    it("computes raw_size_bytes and raw_sha256 from the raw bytes", () => {
      const event = buildEventFromParsedData(baseOptions);
      const expectedSha = createHash("sha256").update(rawBytes).digest("hex");

      expect(event.email.content.raw.size_bytes).toBe(rawBytes.length);
      expect(event.email.content.raw.sha256).toBe(expectedSha);
    });

    it("forwards buildOptions to the underlying builder", () => {
      const event = buildEventFromParsedData({
        ...baseOptions,
        buildOptions: {
          event_id:
            "evt_000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
          attempted_at: "2025-01-01T12:01:00Z",
        },
      });
      expect(event.id).toBe(
        "evt_000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
      );
      expect(event.delivery.attempted_at).toBe("2025-01-01T12:01:00Z");
    });

    it("is re-exported from the contract package root", () => {
      expect(contractPackage.buildEventFromParsedData).toBe(
        buildEventFromParsedData,
      );
    });
  });
});
