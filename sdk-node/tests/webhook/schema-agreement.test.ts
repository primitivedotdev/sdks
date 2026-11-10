import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import {
  addValidatorFormats,
  VALIDATOR_AJV_OPTIONS,
} from "../../scripts/validator-ajv.js";
import {
  emailReceivedEventJsonSchema,
  PRIMITIVE_SIGNATURE_HEADER,
  receive,
  signWebhookPayload,
  validateEmailReceivedEvent,
  WebhookValidationError,
} from "../../src/index.js";

// The exported schema must describe exactly what the SDK accepts: a payload
// that passes the schema must pass validateEmailReceivedEvent and receive(),
// and a payload the schema refuses must be refused by both.

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEBHOOK_FIXTURES = join(__dirname, "../../../test-fixtures/webhook");
const SECRET = "whsec_schema_agreement";
const PAYLOAD_FILES = [
  "valid-email-received.json",
  "address-scoped-email.json",
];

function loadText(name: string): string {
  return readFileSync(join(WEBHOOK_FIXTURES, name), "utf8");
}

const validationCases = (
  JSON.parse(loadText("validation-cases.json")) as {
    cases: Array<{ name: string; payload: unknown }>;
  }
).cases;

const payloads: Array<[string, unknown]> = [
  ...validationCases.map((testCase): [string, unknown] => [
    `validation-cases.json ${testCase.name}`,
    testCase.payload,
  ]),
  ...PAYLOAD_FILES.map((file): [string, unknown] => [
    file,
    JSON.parse(loadText(file)),
  ]),
];

const schemaAccepts = addValidatorFormats(
  new Ajv(VALIDATOR_AJV_OPTIONS),
).compile(emailReceivedEventJsonSchema);

function refusesWithValidationError(run: () => unknown): boolean {
  try {
    run();
    return false;
  } catch (error) {
    if (error instanceof WebhookValidationError) return true;
    throw error;
  }
}

function receiveBody(body: string) {
  const { header } = signWebhookPayload(body, SECRET);
  return receive({
    body,
    headers: { [PRIMITIVE_SIGNATURE_HEADER]: header },
    secret: SECRET,
  });
}

describe("emailReceivedEventJsonSchema agrees with the SDK validator", () => {
  it.each(payloads)("gives the same verdict for %s", (_name, payload) => {
    const accepted = schemaAccepts(payload);

    expect(
      refusesWithValidationError(() => validateEmailReceivedEvent(payload)),
    ).toBe(!accepted);
    expect(
      refusesWithValidationError(() => receiveBody(JSON.stringify(payload))),
    ).toBe(!accepted);
  });

  it("covers payloads on both sides of the schema", () => {
    const verdicts = new Set(
      payloads.map(([, payload]) => schemaAccepts(payload)),
    );
    expect(verdicts).toEqual(new Set([true, false]));
  });

  it.each(PAYLOAD_FILES)(
    "round trips %s through the SDK signer and receive()",
    (file) => {
      const body = loadText(file);
      const event = JSON.parse(body);
      expect(schemaAccepts(event)).toBe(true);

      const email = receiveBody(body);

      expect(email.id).toBe(event.email.id);
      expect(email.eventId).toBe(event.id);
      expect(email.raw).toEqual(event);
    },
  );

  it("round trips a signed Request through receive()", async () => {
    const body = loadText("valid-email-received.json");
    const { header } = signWebhookPayload(body, SECRET);
    const request = new Request("https://example.com/webhooks/email", {
      method: "POST",
      headers: { [PRIMITIVE_SIGNATURE_HEADER]: header },
      body,
    });

    const email = await receive(request, { secret: SECRET });

    expect(email.raw).toEqual(JSON.parse(body));
  });
});
