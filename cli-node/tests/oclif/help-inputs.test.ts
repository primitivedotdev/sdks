import { operationManifest } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { operationHelpInputs } from "../../src/oclif/help-inputs.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("help input classification", () => {
  it("shows schema requirements without requiring individual flags in the parser", () => {
    const operation = operationManifest.find(
      (op) => op.sdkName === "inviteOrganizationMember",
    );
    expect(operation).toBeDefined();
    const command = COMMANDS[
      "organizations:invite-organization-member"
    ] as unknown as {
      helpInputs: ReturnType<typeof operationHelpInputs>;
      flags: Record<string, { required?: boolean }>;
    };
    expect(command.helpInputs.requiredFlags).toEqual(["request-id", "email"]);
    expect(command.flags.email.required).not.toBe(true);
    expect(command.flags["request-id"].required).not.toBe(true);
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
