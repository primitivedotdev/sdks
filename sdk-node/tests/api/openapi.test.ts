import { describe, expect, it } from "vitest";
import { openapiDocument, operationManifest } from "../../src/openapi/index.js";

function operation(operationId: string) {
  const found = operationManifest.find(
    (item) => item.operationId === operationId,
  );
  if (!found) throw new Error(`Missing operation ${operationId}`);
  return found;
}

describe("openapi export", () => {
  it("publishes the bundled OpenAPI document and full operation manifest", () => {
    expect(openapiDocument.openapi).toBe("3.1.0");
    expect(operationManifest).toHaveLength(119);
  });

  it("preserves request, response, and constrained header metadata", () => {
    const sendEmail = operation("sendEmail");
    expect(sendEmail.requestSchema).toMatchObject({ type: "object" });
    expect(sendEmail.responseSchema).toMatchObject({ type: "object" });
    expect(sendEmail.headerParams[0]).toMatchObject({
      maxLength: 255,
      minLength: 1,
      name: "Idempotency-Key",
      pattern: "^[\\x21-\\x7E]+$",
      required: false,
      type: "string",
    });

    const setMemory = operation("setMemory");
    expect(setMemory.headerParams[0]).toMatchObject({
      format: "uuid",
      name: "x-primitive-function-id",
      required: false,
      type: "string",
    });
  });
});
