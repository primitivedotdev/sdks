import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import { operationHelpInputs } from "../../src/oclif/help-inputs.js";

describe("help input classification", () => {
  it("shows schema requirements without requiring individual flags in the parser", () => {
    const operation = operationManifest.find(
      (op) => op.sdkName === "inviteOrganizationMember",
    );
    if (!operation) throw new Error("Invitation operation missing");
    const command = createOperationCommand({
      ...operation,
      bodyRequired: true,
      requestSchema: {
        type: "object",
        required: ["request_id", "email"],
        properties: {
          request_id: { type: "string", format: "uuid" },
          email: { type: "string" },
        },
      },
    }) as unknown as {
      helpInputs: ReturnType<typeof operationHelpInputs>;
      flags: Record<string, { required?: boolean }>;
    };
    expect(command.helpInputs.requiredFlags).toEqual(["request-id", "email"]);
    expect(command.flags.email.required).not.toBe(true);
    expect(command.flags["request-id"].required).not.toBe(true);
  });

  it("describes marked defaults as optional while retaining caller requirements", () => {
    const operation = operationManifest.find(
      (op) => op.sdkName === "inviteOrganizationMember",
    );
    if (!operation) throw new Error("Invitation operation missing");
    const requestSchema = {
      type: "object",
      required: ["request_id", "email"],
      properties: {
        request_id: {
          type: "string",
          format: "uuid",
          "x-primitive-retry-id": true,
        },
        email: { type: "string" },
      },
    };
    const command = createOperationCommand({
      ...operation,
      bodyRequired: true,
      requestSchema,
    }) as unknown as {
      helpInputs: ReturnType<typeof operationHelpInputs>;
      flags: Record<string, { description?: string; required?: boolean }>;
    };
    expect(command.helpInputs).toEqual({
      requiredFlags: ["email"],
      requiredJsonFields: [],
    });
    expect(command.flags["request-id"].description).toContain(
      "generated when omitted",
    );
    expect(command.flags["request-id"].required).not.toBe(true);
    expect(
      operationHelpInputs(
        {
          bodyRequired: true,
          requestSchema: {
            ...requestSchema,
            required: ["request_id"],
          },
        },
        new Map([["request-id", "request_id"]]),
      ),
    ).toEqual({ requiredFlags: [], requiredJsonFields: [] });
    expect(
      operationHelpInputs(
        { bodyRequired: false, requestSchema },
        new Map([
          ["request-id", "request_id"],
          ["email", "email"],
        ]),
      ),
    ).toEqual({ requiredFlags: ["email"], requiredJsonFields: [] });
  });

  it("keeps requirements on optional bodies out of unconditional required inputs", () => {
    const requestSchema = { type: "object", required: ["email"] };
    const map = new Map([["email", "email"]]);
    expect(
      operationHelpInputs({ bodyRequired: false, requestSchema }, map),
    ).toEqual({
      requiredFlags: [],
      requiredJsonFields: [],
    });
  });

  it("identifies required JSON-only properties and positional alternatives", () => {
    expect(
      operationHelpInputs(
        {
          bodyRequired: true,
          requestSchema: {
            required: ["email", "config"],
          },
        },
        new Map([["email", "email"]]),
        "id",
      ),
    ).toEqual({
      requiredFlags: ["email", "id"],
      requiredJsonFields: ["$.config"],
    });
    expect(
      operationHelpInputs({ bodyRequired: true, requestSchema: {} }, new Map()),
    ).toEqual({
      requiredFlags: [],
      requiredJsonFields: ["$"],
    });
  });

  it("does not turn alternative branches into unconditional required fields", () => {
    const requestSchema = {
      oneOf: [
        { required: ["email", "if_absent"] },
        { required: ["email", "if_version"] },
      ],
    };
    expect(
      operationHelpInputs(
        { bodyRequired: true, requestSchema },
        new Map([["email", "email"]]),
      ),
    ).toEqual({
      requiredFlags: ["email"],
      requiredJsonFields: [],
    });
  });
});
