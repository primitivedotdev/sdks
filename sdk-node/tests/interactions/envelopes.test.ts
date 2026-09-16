import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import {
  parseInteractionEnvelope,
  validateInteractionEnvelope,
} from "../../src/interactions/index.js";

interface Fixture {
  name: string;
  source?: string;
  hex?: string;
  padding?: number;
  status: string;
}
const fixtures: Fixture[] = JSON.parse(
  readFileSync(
    new URL(
      "../../../test-fixtures/interaction-envelopes.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const source = fixtures[0]?.source ?? "";
describe("shared interaction envelopes", () => {
  for (const fixture of fixtures)
    it(fixture.name, () => {
      const text = (fixture.source ?? "") + " ".repeat(fixture.padding ?? 0);
      const bytes = fixture.hex
        ? Uint8Array.from(Buffer.from(fixture.hex, "hex"))
        : new TextEncoder().encode(text);
      const result = parseInteractionEnvelope(bytes);
      expect(result.status).toBe(fixture.status);
      if (!fixture.hex)
        expect(parseInteractionEnvelope(text).status).toBe(fixture.status);
      if (result.status !== "invalid") {
        expect(result.source?.bytes).toEqual(bytes);
        expect(result.source?.bytes).not.toBe(bytes);
        expect(result.source?.text).toBe(text);
      }
    });
});
it("rejects literal unpaired surrogates without replacement", () => {
  expect(
    parseInteractionEnvelope(source.replace("Hello", "\ud800")).status,
  ).toBe("invalid");
  expect(
    parseInteractionEnvelope(source.replace("Hello", "\udfff")).status,
  ).toBe("invalid");
});
it("keeps prototype keys as data", () => {
  const result = parseInteractionEnvelope(
    source.replace('{"message":"Hello"}', '{"__proto__":{"polluted":true}}'),
  );
  expect(result.status).toBe("valid");
  if (result.status === "valid")
    expect(Object.hasOwn(result.envelope.payload as object, "__proto__")).toBe(
      true,
    );
  expect(Object.hasOwn({}, "polluted")).toBe(false);
});
it("validates decoded objects without invoking getters or toJSON", () => {
  const decoded: Record<string, unknown> = JSON.parse(source);
  expect(validateInteractionEnvelope(decoded).status).toBe("valid");
  expect(validateInteractionEnvelope(decoded)).not.toHaveProperty("source");
  const trap = () => {
    throw new Error("must not run");
  };
  Object.defineProperty(decoded, "payload", { get: trap, enumerable: true });
  expect(validateInteractionEnvelope(decoded).status).toBe("invalid");
  expect(validateInteractionEnvelope({ toJSON: trap }).status).toBe("invalid");
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  expect(validateInteractionEnvelope(cyclic).status).toBe("invalid");
  expect(
    validateInteractionEnvelope(new Proxy({}, { ownKeys: trap })).status,
  ).toBe("invalid");
  for (const payload of [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    9007199254740992,
    new Array(2),
    "a".repeat(65_537),
    { ["k".repeat(65_537)]: null },
    new Date(),
    "\ud800",
  ]) {
    expect(
      validateInteractionEnvelope({ ...JSON.parse(source), payload }).status,
    ).toBe("invalid");
  }
});
it("executes a browser bundle without Node or crypto globals", async () => {
  const result = await build({
    entryPoints: [
      fileURLToPath(
        new URL("../../src/interactions/index.ts", import.meta.url),
      ),
    ],
    bundle: true,
    platform: "browser",
    format: "iife",
    globalName: "interactions",
    write: false,
  });
  const context = {
    TextDecoder,
    TextEncoder,
    Uint8Array,
    result: "",
    input: source,
  };
  runInNewContext(
    `${result.outputFiles[0]?.text}\nresult = interactions.parseInteractionEnvelope(input).status`,
    context,
  );
  expect(context.result).toBe("valid");
});

interface DecodedFixture {
  name: string;
  array_length: number;
  status: string;
}
const decodedFixtures: DecodedFixture[] = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/interaction-decoded.json", import.meta.url),
    "utf8",
  ),
);
for (const fixture of decodedFixtures)
  it(`decoded ${fixture.name}`, () => {
    const value = {
      ...JSON.parse(source),
      payload: new Array(fixture.array_length).fill(0),
    };
    expect(validateInteractionEnvelope(value).status).toBe(fixture.status);
  });

it("requires own envelope fields even when the host prototype has matching names", () => {
  const decoded: Record<string, unknown> = JSON.parse(source);
  delete decoded.prev_step_id;
  Object.defineProperty(Object.prototype, "prev_step_id", {
    value: null,
    configurable: true,
  });
  try {
    expect(parseInteractionEnvelope(JSON.stringify(decoded)).status).toBe(
      "invalid",
    );
  } finally {
    Reflect.deleteProperty(Object.prototype, "prev_step_id");
  }
});
