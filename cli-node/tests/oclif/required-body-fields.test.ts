import { describe, expect, it } from "vitest";
import { thrownErrorBody } from "../../src/oclif/json-output.js";
import {
  assertRequiredBodyFields,
  missingBodyFields,
} from "../../src/oclif/required-body-fields.js";

const flags = new Map([
  ["email", "--email"],
  ["request_id", "--request-id"],
]);
const schema = { type: "object", required: ["request_id", "email"] };
const requestId = {
  field: "request_id",
  flag: "--request-id",
  json_path: "$.request_id",
};
const email = { field: "email", flag: "--email", json_path: "$.email" };

describe("required request body fields", () => {
  it("lists every omission and preserves machine-readable details on a usage error", () => {
    expect(missingBodyFields(schema, undefined, flags, true)).toEqual([
      requestId,
      email,
    ]);
    try {
      assertRequiredBodyFields(schema, { email: "a@example.com" }, flags, true);
      expect.unreachable("expected a missing-field error");
    } catch (error) {
      expect(thrownErrorBody(error)).toEqual({
        code: "usage_error",
        message: expect.stringContaining("--request-id"),
        details: { missing: [requestId] },
      });
      expect(error).toMatchObject({ oclif: { exit: 2 } });
    }
  });

  it("checks an optional body only when supplied, and counts false, zero, null and empty strings as present", () => {
    expect(missingBodyFields(schema, undefined, flags, false)).toEqual([]);
    expect(missingBodyFields(schema, {}, flags, false)).toEqual([
      requestId,
      email,
    ]);
    for (const value of [false, 0, null, ""]) {
      expect(
        missingBodyFields(
          schema,
          { email: value, request_id: value },
          flags,
          true,
        ),
      ).toEqual([]);
    }
    expect(
      missingBodyFields(
        schema,
        Object.create({ email: "inherited" }),
        flags,
        true,
      ),
    ).toEqual([requestId, email]);
  });

  it("names JSON-only fields and checks supplied nested objects and array elements", () => {
    const nested = {
      type: "object",
      properties: {
        config: { type: ["object", "null"], required: ["url"] },
        items: { type: "array", items: { type: "object", required: ["a.b"] } },
      },
    };
    for (const value of [{}, { config: null }]) {
      expect(missingBodyFields(nested, value, flags, true)).toEqual([]);
    }
    expect(
      missingBodyFields(nested, { config: {}, items: [{}] }, flags, true),
    ).toEqual([
      { field: "url", flag: null, json_path: "$.config.url" },
      { field: "a.b", flag: null, json_path: '$.items[0]["a.b"]' },
    ]);
    expect(
      missingBodyFields({ required: ["config"], ...nested }, {}, flags, true),
    ).toEqual([{ field: "config", flag: null, json_path: "$.config" }]);
  });

  it("combines allOf requirements without duplicates", () => {
    expect(
      missingBodyFields(
        { required: ["email"], allOf: [schema, schema] },
        {},
        flags,
        true,
      ),
    ).toEqual([email, requestId]);
  });

  it("does not invent requirements from unresolved recursive references", () => {
    const ref = { $ref: "#/components/schemas/MemoryJsonValue" };
    expect(missingBodyFields(ref, {}, flags, true)).toEqual([]);
    expect(
      missingBodyFields(
        { required: ["value"], properties: { value: ref } },
        { value: { nested: {} } },
        flags,
        true,
      ),
    ).toEqual([]);
  });

  it("does not require every alternative, and narrows only on supplied literal choices", () => {
    const branches = [
      {
        properties: { mode: { const: "http" } },
        required: ["email", "status_code"],
      },
      {
        properties: { mode: { enum: ["exec"] } },
        required: ["email", "exit_code"],
      },
    ];
    for (const keyword of ["oneOf", "anyOf"]) {
      const union = { [keyword]: branches };
      expect(missingBodyFields(union, {}, flags, true)).toEqual([email]);
      expect(
        missingBodyFields(
          union,
          { mode: "exec", email: "a@example.com" },
          flags,
          true,
        ),
      ).toEqual([{ field: "exit_code", flag: null, json_path: "$.exit_code" }]);
      expect(
        missingBodyFields(union, { mode: "invalid" }, flags, true),
      ).toEqual([]);
      expect(missingBodyFields(union, { mode: {} }, flags, true)).toEqual([
        email,
      ]);
    }
    expect(missingBodyFields({ oneOf: [schema, {}] }, {}, flags, true)).toEqual(
      [],
    );
  });

  it("leaves non-object type failures to the server and identifies a required body without named fields", () => {
    for (const body of [null, false, "invalid", []]) {
      expect(missingBodyFields(schema, body, flags, true)).toEqual([]);
    }
    expect(() =>
      assertRequiredBodyFields(schema, null, flags, true),
    ).not.toThrow();
    expect(() =>
      assertRequiredBodyFields(null, undefined, flags, true),
    ).toThrow(
      expect.objectContaining({
        details: { missing: [{ field: "body", flag: null, json_path: "$" }] },
      }),
    );
  });
});
