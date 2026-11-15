// Run with: pnpm --filter @primitivedotdev/api-core test:scripts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dropNarrowingOneOf } from "./codegen-rules.ts";

const IMPORTED_PROPERTIES = {
  from: { type: "string", enum: ["google_workspace", "unknown"] },
  method: { type: "string", enum: ["primitive_direct", "api_upload"] },
  at: { type: "string", format: "date-time" },
};

function branch(from: string, method: string) {
  return {
    type: "object",
    required: ["from", "method", "at"],
    properties: {
      from: { type: "string", enum: [from] },
      method: { type: "string", enum: [method] },
      at: { type: "string", format: "date-time" },
    },
  };
}

function imported(extra: Record<string, unknown> = {}) {
  return {
    type: ["object", "null"],
    required: ["from", "method", "at"],
    properties: IMPORTED_PROPERTIES,
    oneOf: [
      { type: "null" },
      branch("google_workspace", "primitive_direct"),
      branch("unknown", "api_upload"),
    ],
    ...extra,
  };
}

describe("dropNarrowingOneOf", () => {
  it("drops a value-pairing oneOf beside the properties it narrows", () => {
    const { oneOf: _oneOf, ...expected } = imported();
    assert.deepEqual(dropNarrowingOneOf(imported()), expected);
  });

  it("drops it beside a nullable object written as OpenAPI 3.0", () => {
    const node = { ...imported(), type: "object", nullable: true };
    const { oneOf: _oneOf, ...expected } = node;
    assert.deepEqual(dropNarrowingOneOf(node), expected);
  });

  it("keeps a oneOf with a discriminator", () => {
    const node = imported({ discriminator: { propertyName: "from" } });
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });

  it("keeps a oneOf whose branch adds a property not declared beside it", () => {
    const node = imported();
    node.oneOf[2] = {
      ...branch("unknown", "api_upload"),
      properties: { ...branch("unknown", "api_upload").properties, file: { type: "string" } },
    };
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });

  it("keeps a oneOf whose branch carries more than type, properties and required", () => {
    const node = imported();
    node.oneOf[1] = { ...branch("google_workspace", "primitive_direct"), description: "x" };
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });

  it("keeps a null branch beside an object that does not admit null", () => {
    const node = { ...imported(), type: "object" };
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });

  it("leaves a node without properties beside its oneOf alone", () => {
    const node = { oneOf: [{ type: "null" }, branch("unknown", "api_upload")] };
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });
  it("keeps a null branch that carries more than its type", () => {
    const node = imported();
    node.oneOf[0] = { type: "null", description: "x" } as never;
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });

  it("keeps a oneOf with a non-object branch or an object branch without properties", () => {
    for (const other of [{ type: "string" }, { type: "object" }]) {
      const node = imported();
      node.oneOf[2] = other as never;
      assert.deepEqual(dropNarrowingOneOf(node), node);
    }
  });

  it("leaves an empty oneOf alone", () => {
    const node = { ...imported(), oneOf: [] };
    assert.deepEqual(dropNarrowingOneOf(node), node);
  });
});
