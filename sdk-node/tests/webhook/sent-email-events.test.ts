import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, expectTypeOf, it } from "vitest";
import {
  handleWebhook,
  handleWebhookEvent,
  isEmailReceivedEvent,
  isKnownWebhookEventType,
  isSentEmailAcceptedEvent,
  isSentEmailCompletedEvent,
  isSentEmailDeliveredEvent,
  isSentEmailEvent,
  isSentEmailEventType,
  isSentEmailFailedEvent,
  isSentEmailRecipientResultEvent,
  PrimitiveWebhookError,
  parseWebhookEvent,
  SENT_EMAIL_EVENT_TYPES,
  type SentEmailEvent,
  type SentEmailRecipientResultEvent,
  safeValidateSentEmailEvent,
  sentEmailEventJsonSchema,
  signWebhookPayload,
  validateSentEmailEvent,
  WEBHOOK_EVENT_TYPES,
  WebhookValidationError,
} from "../../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../../test-fixtures");

function loadJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, ...parts), "utf8")) as T;
}

function loadText(...parts: string[]): string {
  return readFileSync(join(FIXTURES_DIR, ...parts), "utf8");
}

type InputPatch = {
  fixture: string[];
  set?: Record<string, unknown>;
  delete?: string[];
};

type ParseCase = {
  name: string;
  input?: unknown;
  input_fixture?: string[];
  input_patch?: InputPatch;
  event_type?: string;
  expected: {
    kind: "sent_email" | "unknown" | "error";
    event?: string;
    id?: string;
    error_code?: string;
    fields?: Record<string, unknown>;
    absent?: string[];
  };
};

type HandleCase = {
  name: string;
  body?: string;
  body_fixture?: string[];
  headers: Record<string, string>;
  secret: string;
  sign_secret?: string;
  timestamp?: number;
  expected: {
    valid: boolean;
    event?: string;
    id?: string;
    error_code?: string;
  };
};

const cases = loadJson<{
  parse_cases: ParseCase[];
  handle_cases: HandleCase[];
}>("sent-email-events", "cases.json");

function segments(path: string): string[] {
  return path.split(".");
}

function getPath(value: unknown, path: string): unknown {
  let current: unknown = value;
  for (const segment of segments(path)) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function hasPath(value: unknown, path: string): boolean {
  const parts = segments(path);
  const last = parts.pop() as string;
  const parent = parts.length > 0 ? getPath(value, parts.join(".")) : value;
  return (
    parent !== null &&
    typeof parent === "object" &&
    Object.hasOwn(parent as object, last)
  );
}

function setPath(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
) {
  const parts = segments(path);
  const last = parts.pop() as string;
  let current: Record<string, unknown> = target;
  for (const part of parts) {
    current = current[part] as Record<string, unknown>;
  }
  current[last] = value;
}

function caseInput(testCase: ParseCase): unknown {
  if (testCase.input_fixture) return loadJson(...testCase.input_fixture);
  if (testCase.input_patch) {
    const body = loadJson<Record<string, unknown>>(
      ...testCase.input_patch.fixture,
    );
    for (const [path, value] of Object.entries(testCase.input_patch.set ?? {}))
      setPath(body, path, value);
    for (const key of testCase.input_patch.delete ?? []) delete body[key];
    return body;
  }
  return testCase.input;
}

describe("sent_email shared fixtures", () => {
  it("parses every shared case", () => {
    for (const testCase of cases.parse_cases) {
      const input = caseInput(testCase);

      if (testCase.expected.kind === "error") {
        try {
          parseWebhookEvent(input, testCase.event_type);
          expect.fail(`Expected parse failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(PrimitiveWebhookError);
          expect((error as PrimitiveWebhookError).code, testCase.name).toBe(
            testCase.expected.error_code,
          );
        }
        continue;
      }

      const event = parseWebhookEvent(input, testCase.event_type);
      expect(event.event, testCase.name).toBe(testCase.expected.event);
      expect((event as { id?: string }).id, testCase.name).toBe(
        testCase.expected.id,
      );
      expect(isSentEmailEvent(event), testCase.name).toBe(
        testCase.expected.kind === "sent_email",
      );
      for (const [path, value] of Object.entries(
        testCase.expected.fields ?? {},
      )) {
        expect(getPath(event, path), `${testCase.name}: ${path}`).toEqual(
          value,
        );
      }
      for (const path of testCase.expected.absent ?? []) {
        expect(hasPath(event, path), `${testCase.name}: ${path}`).toBe(false);
      }
    }
  });

  it("verifies and parses every shared signed case", () => {
    for (const testCase of cases.handle_cases) {
      const body = testCase.body_fixture
        ? loadText(...testCase.body_fixture)
        : (testCase.body ?? "");
      const signed = signWebhookPayload(
        body,
        testCase.sign_secret ?? testCase.secret,
        testCase.timestamp,
      );
      const headers = Object.fromEntries(
        Object.entries(testCase.headers).map(([key, value]) => [
          key,
          value === "{signed}" ? signed.header : value,
        ]),
      );

      if (testCase.expected.valid) {
        const event = handleWebhookEvent({
          body,
          headers,
          secret: testCase.secret,
        });
        expect(event.event, testCase.name).toBe(testCase.expected.event);
        expect((event as { id?: string }).id, testCase.name).toBe(
          testCase.expected.id,
        );
        expect(isSentEmailEvent(event), testCase.name).toBe(true);
        continue;
      }

      try {
        handleWebhookEvent({ body, headers, secret: testCase.secret });
        expect.fail(`Expected handleWebhookEvent failure for ${testCase.name}`);
      } catch (error) {
        expect(error, testCase.name).toBeInstanceOf(PrimitiveWebhookError);
        expect((error as PrimitiveWebhookError).code, testCase.name).toBe(
          testCase.expected.error_code,
        );
      }
    }
  });
});

describe("sent_email catalog and guards", () => {
  const failed = loadJson("sent-email-events", "failed-recipient.json");
  const delivered = loadJson("sent-email-events", "delivered-recipient.json");
  const accepted = loadJson("sent-email-events", "accepted.json");
  const completed = loadJson("sent-email-events", "completed.json");
  const rollup = loadJson("sent-email-events", "failed-rollup.json");

  it("lists the four events in the catalog", () => {
    expect([...SENT_EMAIL_EVENT_TYPES]).toEqual([
      "sent_email.accepted",
      "sent_email.delivered",
      "sent_email.failed",
      "sent_email.completed",
    ]);
    for (const name of SENT_EMAIL_EVENT_TYPES) {
      expect(WEBHOOK_EVENT_TYPES).toContain(name);
      expect(isKnownWebhookEventType(name)).toBe(true);
      expect(isSentEmailEventType(name)).toBe(true);
    }
    expect(isSentEmailEventType("sent_email.opened")).toBe(false);
    expect(isSentEmailEventType(null)).toBe(false);
  });

  it("narrows with the per-event guards", () => {
    expect(isSentEmailAcceptedEvent(accepted)).toBe(true);
    expect(isSentEmailAcceptedEvent(failed)).toBe(false);
    expect(isSentEmailDeliveredEvent(delivered)).toBe(true);
    expect(isSentEmailDeliveredEvent(failed)).toBe(false);
    expect(isSentEmailFailedEvent(failed)).toBe(true);
    expect(isSentEmailFailedEvent(rollup)).toBe(true);
    expect(isSentEmailCompletedEvent(completed)).toBe(true);
    expect(isSentEmailRecipientResultEvent(failed)).toBe(true);
    expect(isSentEmailRecipientResultEvent(rollup)).toBe(false);
    expect(isSentEmailRecipientResultEvent(completed)).toBe(false);
    expect(isEmailReceivedEvent(failed)).toBe(false);
  });

  it("does not narrow a malformed body that names a sent_email event", () => {
    const malformed = { ...(failed as Record<string, unknown>) };
    delete malformed.outcome;
    expect(isSentEmailEvent(malformed)).toBe(false);
    expect(isSentEmailFailedEvent(malformed)).toBe(false);
    expect(isSentEmailEvent("sent_email.failed")).toBe(false);
    expect(isSentEmailEvent(null)).toBe(false);
  });

  it("reports the field of the event shape the body selects", () => {
    const malformed = { ...(failed as Record<string, unknown>) };
    delete malformed.outcome;
    const result = safeValidateSentEmailEvent(malformed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(WebhookValidationError);
      expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(result.error.field).toBe("outcome");
    }

    const noRecipients = { ...(rollup as Record<string, unknown>) };
    delete noRecipients.recipients;
    expect(() => validateSentEmailEvent(noRecipients)).toThrow(
      WebhookValidationError,
    );

    expect(() => validateSentEmailEvent([])).toThrow(WebhookValidationError);
    expect(safeValidateSentEmailEvent(completed).success).toBe(true);
  });

  it("keeps handleWebhook typed to email.received", () => {
    const body = loadText("sent-email-events", "completed.json");
    const signed = signWebhookPayload(body, "whsec_test");
    expect(() =>
      handleWebhook({
        body,
        headers: {
          "Primitive-Signature": signed.header,
          "X-Webhook-Event": "sent_email.completed",
        },
        secret: "whsec_test",
      }),
    ).toThrow(WebhookValidationError);
  });

  it("exposes a discriminated union keyed on event and scope", () => {
    const event = validateSentEmailEvent(failed);
    if (event.event === "sent_email.failed" && event.scope === "recipient") {
      expectTypeOf(event).toEqualTypeOf<SentEmailRecipientResultEvent>();
      expect(event.recipient.type).toBe("cc");
      expect(event.outcome.failure_kind).toBe("rejected");
    } else {
      expect.fail("expected a per-recipient failure");
    }
    expectTypeOf(event).toExtend<SentEmailEvent>();
  });

  it("exports the canonical schema", () => {
    expect(sentEmailEventJsonSchema.$ref).toBe("#/definitions/SentEmailEvent");
    expect(Object.keys(sentEmailEventJsonSchema.definitions)).toContain(
      "SentEmailCompletedEvent",
    );
  });
});
