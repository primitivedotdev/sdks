// Run with: pnpm --filter @primitivedotdev/api-core test:scripts
// Importing the script must not run it: main() exits when no path is given.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeNode, syncOpenApi } from "./sync-openapi.ts";

const NULL = { type: "null" };

describe("rule 2: nullable schemas", () => {
  it("adds null to the type and the enum of an anyOf-null enum", () => {
    const out = normalizeNode({
      description: "Owner key status.",
      anyOf: [{ type: "string", enum: ["active", "revoked"] }, NULL],
    });
    assert.deepEqual(out, {
      type: ["string", "null"],
      enum: ["active", "revoked", null],
      description: "Owner key status.",
    });
  });

  it("turns a const into an enum of the value and null", () => {
    const out = normalizeNode({
      oneOf: [NULL, { type: "boolean", const: true }],
    });
    assert.deepEqual(out, { type: ["boolean", "null"], enum: [true, null] });
  });

  it("adds null to an enum whose type list already admits null", () => {
    const out = normalizeNode({
      type: ["string", "null"],
      enum: ["active", "suspended", "revoked"],
    });
    assert.deepEqual(out, {
      type: ["string", "null"],
      enum: ["active", "suspended", "revoked", null],
    });
  });

  it("leaves an enum that already lists null unchanged", () => {
    const schema = { type: ["string", "null"], enum: ["a", null] };
    assert.deepEqual(normalizeNode(schema), schema);
  });

  it("leaves a non-nullable enum unchanged", () => {
    const schema = { type: "string", enum: ["a", "b"] };
    assert.deepEqual(normalizeNode(schema), schema);
  });

  it("keeps a nullable $ref as anyOf with a null branch", () => {
    const out = normalizeNode({
      anyOf: [{ allOf: [{ $ref: "#/components/schemas/X" }] }, NULL],
    });
    assert.deepEqual(out, {
      anyOf: [{ $ref: "#/components/schemas/X" }, NULL],
    });
  });
});

describe("syncOpenApi", () => {
  it("normalizes a nullable enum reachable from an operation", () => {
    const doc = syncOpenApi({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/x": {
          get: {
            operationId: "getX",
            responses: {
              "200": {
                description: "ok",
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/X" },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          X: {
            type: "object",
            properties: {
              status: { anyOf: [{ type: "string", enum: ["on"] }, NULL] },
            },
          },
          Unused: { type: "object" },
        },
      },
    }) as {
      components: {
        schemas: Record<string, { properties?: Record<string, unknown> }>;
      };
    };
    assert.deepEqual(doc.components.schemas.X?.properties?.status, {
      type: ["string", "null"],
      enum: ["on", null],
    });
    assert.equal(doc.components.schemas.Unused, undefined);
  });

  it("leaves out the SDK-omitted operations, their components and a tag only they used", () => {
    const ok = (ref: string) => ({
      "200": {
        description: "ok",
        content: { "application/json": { schema: { $ref: ref } } },
      },
    });
    const doc = syncOpenApi({
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      tags: [{ name: "Service" }, { name: "Emails" }],
      paths: {
        "/health": {
          get: {
            operationId: "getHealth",
            tags: ["Service"],
            responses: ok("#/components/schemas/Health"),
          },
        },
        "/emails": {
          get: {
            operationId: "listEmails",
            tags: ["Emails"],
            responses: ok("#/components/schemas/Email"),
          },
        },
      },
      components: {
        schemas: { Health: { type: "object" }, Email: { type: "object" } },
      },
    }) as {
      tags: Array<{ name: string }>;
      paths: Record<string, unknown>;
      components: { schemas: Record<string, unknown> };
    };
    assert.deepEqual(Object.keys(doc.paths), ["/emails"]);
    assert.deepEqual(Object.keys(doc.components.schemas), ["Email"]);
    assert.deepEqual(
      doc.tags.map((tag) => tag.name),
      ["Emails"],
    );
  });

  it("refuses a document that is not OpenAPI 3.1", () => {
    assert.throws(
      () => syncOpenApi({ openapi: "3.0.3", paths: { "/x": {} } }),
      /OpenAPI 3\.1/,
    );
  });
});
