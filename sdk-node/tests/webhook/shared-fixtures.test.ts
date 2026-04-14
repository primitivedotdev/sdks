import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  decodeRawEmail,
  handleWebhook,
  isRawIncluded,
  PrimitiveWebhookError,
  parseWebhookEvent,
  RawEmailDecodeError,
  safeValidateEmailReceivedEvent,
  validateEmailAuth,
  validateEmailReceivedEvent,
  verifyRawEmailDownload,
  verifyWebhookSignature,
  WebhookValidationError,
  WebhookVerificationError,
} from "../../src/index.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";
import {
  signStandardWebhooksPayload,
  verifyStandardWebhooksSignature,
} from "../../src/webhook/standard-webhooks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../../test-fixtures");

function loadJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, ...parts), "utf8")) as T;
}

function loadText(...parts: string[]): string {
  return readFileSync(join(FIXTURES_DIR, ...parts), "utf8");
}

describe("shared compatibility fixtures", () => {
  it("validates shared webhook cases", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        payload: unknown;
        expected: { valid: boolean; id?: string; error_code?: string };
      }>;
    }>("webhook", "validation-cases.json");

    for (const testCase of fixtures.cases) {
      if (testCase.expected.valid) {
        const event = validateEmailReceivedEvent(testCase.payload);
        expect(event.id, testCase.name).toBe(testCase.expected.id);
        const safeResult = safeValidateEmailReceivedEvent(testCase.payload);
        expect(safeResult.success, testCase.name).toBe(true);
      } else {
        expect(
          () => validateEmailReceivedEvent(testCase.payload),
          testCase.name,
        ).toThrow(WebhookValidationError);
        const safeResult = safeValidateEmailReceivedEvent(testCase.payload);
        expect(safeResult.success, testCase.name).toBe(false);
        if (!safeResult.success) {
          expect(safeResult.error.code, testCase.name).toBe(
            testCase.expected.error_code,
          );
        }
      }
    }
  });

  it("verifies shared signing fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        raw_body: string;
        secret: string;
        timestamp: number;
        verify_secret?: string;
        now_seconds?: number;
        signature_header?: string;
        expected_v1: string;
        expected_valid: boolean;
        expected_error_code?: string;
      }>;
    }>("signing", "vectors.json");

    for (const testCase of fixtures.cases) {
      const signed = signWebhookPayload(
        testCase.raw_body,
        testCase.secret,
        testCase.timestamp,
      );
      expect(signed.v1, testCase.name).toBe(testCase.expected_v1);

      const verifySecret = testCase.verify_secret ?? testCase.secret;
      const nowSeconds = testCase.now_seconds ?? testCase.timestamp;
      const signatureHeader = testCase.signature_header ?? signed.header;

      if (testCase.expected_valid) {
        expect(
          verifyWebhookSignature({
            rawBody: testCase.raw_body,
            signatureHeader,
            secret: verifySecret,
            nowSeconds,
          }),
          testCase.name,
        ).toBe(true);
      } else {
        try {
          verifyWebhookSignature({
            rawBody: testCase.raw_body,
            signatureHeader,
            secret: verifySecret,
            nowSeconds,
          });
          expect.fail(`Expected verification failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(WebhookVerificationError);
          expect((error as WebhookVerificationError).code, testCase.name).toBe(
            testCase.expected_error_code,
          );
        }
      }
    }
  });

  it("classifies shared auth fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        input: Parameters<typeof validateEmailAuth>[0];
        expected: { verdict: string; confidence: string };
      }>;
    }>("auth", "cases.json");

    for (const testCase of fixtures.cases) {
      const result = validateEmailAuth(testCase.input);
      expect(result.verdict, testCase.name).toBe(testCase.expected.verdict);
      expect(result.confidence, testCase.name).toBe(
        testCase.expected.confidence,
      );
    }
  });

  it("handles shared raw content fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        event: unknown;
        download_bytes_utf8?: string;
        expected: {
          included: boolean;
          decoded_utf8?: string;
          decode_error_code?: string;
          verify_download?: boolean;
          verify_download_error_code?: string;
        };
      }>;
    }>("raw", "cases.json");

    for (const testCase of fixtures.cases) {
      expect(isRawIncluded(testCase.event), testCase.name).toBe(
        testCase.expected.included,
      );

      if (testCase.expected.decoded_utf8) {
        expect(
          decodeRawEmail(testCase.event).toString("utf8"),
          testCase.name,
        ).toBe(testCase.expected.decoded_utf8);
      }

      if (testCase.expected.decode_error_code) {
        try {
          decodeRawEmail(testCase.event);
          expect.fail(`Expected decode failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(RawEmailDecodeError);
          expect((error as RawEmailDecodeError).code, testCase.name).toBe(
            testCase.expected.decode_error_code,
          );
        }
      }

      if (testCase.expected.verify_download) {
        const downloaded = Buffer.from(
          testCase.download_bytes_utf8 ?? "",
          "utf8",
        );
        expect(
          verifyRawEmailDownload(downloaded, testCase.event),
          testCase.name,
        ).toEqual(downloaded);
      }

      if (testCase.expected.verify_download_error_code) {
        try {
          verifyRawEmailDownload(
            Buffer.from(testCase.download_bytes_utf8 ?? "", "utf8"),
            testCase.event,
          );
          expect.fail(
            `Expected download verification failure for ${testCase.name}`,
          );
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(RawEmailDecodeError);
          expect((error as RawEmailDecodeError).code, testCase.name).toBe(
            testCase.expected.verify_download_error_code,
          );
        }
      }
    }
  });

  it("parses shared webhook event fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        input?: unknown;
        input_fixture?: string[];
        expected: {
          kind: "email.received" | "unknown" | "error";
          event?: string;
          id?: string;
          version?: string;
          error_code?: string;
        };
      }>;
    }>("parse-webhook-event", "cases.json");

    for (const testCase of fixtures.cases) {
      const input = testCase.input_fixture
        ? loadJson(...testCase.input_fixture)
        : testCase.input;

      if (testCase.expected.kind === "error") {
        try {
          parseWebhookEvent(input);
          expect.fail(`Expected parse failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(PrimitiveWebhookError);
          expect((error as PrimitiveWebhookError).code, testCase.name).toBe(
            testCase.expected.error_code,
          );
        }
        continue;
      }

      const event = parseWebhookEvent(input);
      expect(event.event, testCase.name).toBe(
        testCase.expected.event ?? testCase.expected.kind,
      );

      if (testCase.expected.kind === "email.received") {
        expect((event as { id: string }).id, testCase.name).toBe(
          testCase.expected.id,
        );
      } else {
        expect((event as { id?: string }).id, testCase.name).toBe(
          testCase.expected.id,
        );
        expect((event as { version?: string }).version, testCase.name).toBe(
          testCase.expected.version,
        );
      }
    }
  });

  it("handles shared webhook fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        body?: string;
        body_fixture?: string[];
        headers: Record<string, string>;
        secret: string;
        sign_secret?: string;
        timestamp?: number;
        tolerance_seconds?: number;
        expected: {
          valid: boolean;
          id?: string;
          error_code?: string;
        };
      }>;
    }>("handle-webhook", "cases.json");

    for (const testCase of fixtures.cases) {
      const body = testCase.body_fixture
        ? loadText(...testCase.body_fixture)
        : (testCase.body ?? "");
      const signSecret = testCase.sign_secret ?? testCase.secret;
      const signed =
        Object.values(testCase.headers).includes("{signed}") ||
        testCase.timestamp !== undefined
          ? signWebhookPayload(body, signSecret, testCase.timestamp)
          : null;
      const headers = Object.fromEntries(
        Object.entries(testCase.headers).map(([key, value]) => [
          key,
          value === "{signed}" ? (signed?.header ?? "") : value,
        ]),
      );

      if (testCase.expected.valid) {
        const event = handleWebhook({
          body,
          headers,
          secret: testCase.secret,
          toleranceSeconds: testCase.tolerance_seconds,
        });
        expect(event.id, testCase.name).toBe(testCase.expected.id);
        continue;
      }

      try {
        handleWebhook({
          body,
          headers,
          secret: testCase.secret,
          toleranceSeconds: testCase.tolerance_seconds,
        });
        expect.fail(`Expected handleWebhook failure for ${testCase.name}`);
      } catch (error) {
        expect(error, testCase.name).toBeInstanceOf(PrimitiveWebhookError);
        expect((error as PrimitiveWebhookError).code, testCase.name).toBe(
          testCase.expected.error_code,
        );
      }
    }
  });

  it("verifies shared standard webhooks signing fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        raw_body: string;
        secret: string;
        msg_id: string;
        timestamp: number;
        verify_secret?: string;
        now_seconds?: number;
        webhook_signature_header?: string;
        expected_signature: string;
        expected_valid: boolean;
        expected_error_code?: string;
      }>;
    }>("signing", "standard-webhooks-vectors.json");

    for (const testCase of fixtures.cases) {
      const signed = signStandardWebhooksPayload(
        testCase.raw_body,
        testCase.secret,
        testCase.msg_id,
        testCase.timestamp,
      );
      expect(signed.signature, testCase.name).toBe(
        `v1,${testCase.expected_signature}`,
      );

      const verifySecret = testCase.verify_secret ?? testCase.secret;
      const nowSeconds = testCase.now_seconds ?? testCase.timestamp;
      const signatureHeader =
        testCase.webhook_signature_header ?? signed.signature;

      if (testCase.expected_valid) {
        expect(
          verifyStandardWebhooksSignature({
            rawBody: testCase.raw_body,
            msgId: testCase.msg_id,
            timestamp: String(testCase.timestamp),
            signatureHeader,
            secret: verifySecret,
            nowSeconds,
          }),
          testCase.name,
        ).toBe(true);
      } else {
        try {
          verifyStandardWebhooksSignature({
            rawBody: testCase.raw_body,
            msgId: testCase.msg_id,
            timestamp: String(testCase.timestamp),
            signatureHeader,
            secret: verifySecret,
            nowSeconds,
          });
          expect.fail(`Expected verification failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(WebhookVerificationError);
          expect((error as WebhookVerificationError).code, testCase.name).toBe(
            testCase.expected_error_code,
          );
        }
      }
    }
  });

  it("handles shared standard webhooks webhook fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        body?: string;
        body_fixture?: string[];
        headers: Record<string, string>;
        secret: string;
        sign_secret?: string;
        msg_id?: string;
        timestamp?: number;
        tolerance_seconds?: number;
        expected: {
          valid: boolean;
          id?: string;
          error_code?: string;
        };
      }>;
    }>("handle-webhook", "standard-webhooks-cases.json");

    for (const testCase of fixtures.cases) {
      const body = testCase.body_fixture
        ? loadText(...testCase.body_fixture)
        : (testCase.body ?? "");
      const signSecret = testCase.sign_secret ?? testCase.secret;
      const msgId = testCase.msg_id ?? "msg_default";
      const needsSign = Object.values(testCase.headers).includes(
        "{signed_standard}",
      );
      const signed = needsSign
        ? signStandardWebhooksPayload(
            body,
            signSecret,
            msgId,
            testCase.timestamp,
          )
        : null;

      const headers = Object.fromEntries(
        Object.entries(testCase.headers).map(([key, value]) => {
          if (value === "{signed_standard}")
            return [key, signed?.signature ?? ""];
          if (value === "{timestamp}")
            return [key, String(signed?.timestamp ?? testCase.timestamp ?? "")];
          return [key, value];
        }),
      );

      if (testCase.expected.valid) {
        const event = handleWebhook({
          body,
          headers,
          secret: testCase.secret,
          toleranceSeconds: testCase.tolerance_seconds,
        });
        expect(event.id, testCase.name).toBe(testCase.expected.id);
        continue;
      }

      try {
        handleWebhook({
          body,
          headers,
          secret: testCase.secret,
          toleranceSeconds: testCase.tolerance_seconds,
        });
        expect.fail(`Expected handleWebhook failure for ${testCase.name}`);
      } catch (error) {
        expect(error, testCase.name).toBeInstanceOf(PrimitiveWebhookError);
        expect((error as PrimitiveWebhookError).code, testCase.name).toBe(
          testCase.expected.error_code,
        );
      }
    }
  });
});
