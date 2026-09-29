import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type PreparedPresence,
  type PresenceAliveInput,
  type PresenceEnvelope,
  type PresenceProbeInput,
  parsePresenceEnvelope,
  preparePresenceAliveEmail,
  preparePresenceProbeEmail,
} from "../../src/interactions/index.js";

interface Fixture {
  name: string;
  kind: "probe" | "alive";
  input: PresenceAliveInput;
  now: number;
  uuids: string[];
  nonce: string;
  status: string;
  prepared?: PreparedPresence;
}
const fixtures: {
  preparation: Fixture[];
  parse: { name: string; raw: string; status: string }[];
} = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/presence-emails.json", import.meta.url),
    "utf8",
  ),
);
function prepare(f: Fixture) {
  let calls = 0;
  const dependencies = { uuid: () => f.uuids[calls++] ?? "", now: () => f.now };
  const result =
    f.kind === "probe"
      ? preparePresenceProbeEmail(f.input, {
          ...dependencies,
          nonce: () => f.nonce,
        })
      : preparePresenceAliveEmail(f.input, dependencies);
  if (result.status === "waiting_on_parent") expect(calls).toBe(0);
  return result;
}
describe("shared presence preparation", () => {
  for (const f of fixtures.preparation)
    it(f.name, () => {
      if (f.status === "invalid") {
        expect(() => prepare(f)).toThrow();
        return;
      }
      const result = prepare(f);
      expect(result.status).toBe(f.status);
      if (result.status === "prepared") {
        expect(result.prepared).toEqual(f.prepared);
        expect(Object.isFrozen(result.prepared)).toBe(true);
        const body = JSON.parse(result.prepared.requestJson);
        const part = Buffer.from(body.attachments[0].content_base64, "base64");
        expect(parsePresenceEnvelope(part).status).toBe("valid");
        expect(part.length).toBeLessThanOrEqual(4096);
        expect(body.attachments).toHaveLength(1);
        expect(body).not.toHaveProperty("headers");
        expect(body).not.toHaveProperty("body_html");
        expect(body).not.toHaveProperty("cc");
      }
    });
});
describe("shared strict presence parsing", () => {
  for (const f of fixtures.parse)
    it(f.name, () => {
      const result = parsePresenceEnvelope(new TextEncoder().encode(f.raw));
      expect(result.status).toBe(f.status);
      if (result.status === "valid") expect(result.source.text).toBe(f.raw);
    });
});
it("retains exact defensive bytes and isolates reply preparation from caller mutation", () => {
  const f = fixtures.preparation.find((item) => item.name === "alive");
  if (!f) throw new Error("fixture");
  const input = structuredClone(f.input),
    before = structuredClone(input);
  const result = prepare({ ...f, input });
  expect(input).toEqual(before);
  if (result.status !== "prepared") throw new Error("fixture");
  const saved = result.prepared.requestJson;
  input.probe.payload.nonce = "b".repeat(32);
  input.references = [...input.references, "<other@example.test>"];
  expect(result.prepared.requestJson).toBe(saved);
  const bytes = new TextEncoder().encode(JSON.stringify(before.probe));
  const parsed = parsePresenceEnvelope(bytes);
  bytes.fill(0);
  if (parsed.status !== "valid") throw new Error("fixture");
  expect(parsed.source.bytes?.[0]).toBe(123);
});
it("rejects accessor probes without executing getters", () => {
  const f = fixtures.preparation.find((item) => item.name === "alive");
  if (!f) throw new Error("fixture");
  let called = false;
  const probe = { ...f.input.probe };
  Object.defineProperty(probe, "payload", {
    get() {
      called = true;
      throw new Error("getter");
    },
  });
  expect(() => prepare({ ...f, input: { ...f.input, probe } })).toThrow();
  expect(called).toBe(false);
});
it("rejects invalid UTF-8, unsafe clocks and rendered header overflow", () => {
  expect(parsePresenceEnvelope(new Uint8Array([255])).status).toBe("invalid");
  const f = fixtures.preparation.find((item) => item.name === "alive");
  if (!f) throw new Error("fixture");
  const reference = `<${"a".repeat(980)}@x.test>`;
  expect(() =>
    prepare({
      ...f,
      input: {
        ...f.input,
        references: Array.from({ length: 1001 }, () => reference),
      },
    }),
  ).toThrow();
  const p: PresenceProbeInput = {
    accountScope: "scope",
    from: "owner@example.test",
    to: "agent@example.test",
  };
  expect(() =>
    preparePresenceProbeEmail(p, {
      now: () => Number.NaN,
      nonce: () => "a".repeat(32),
      uuid: () => "",
    }),
  ).toThrow();
  const invalid = {
    ...f.input.probe,
    payload: { ...f.input.probe.payload, nonce: "a".repeat(5000) },
  } as PresenceEnvelope;
  expect(() =>
    prepare({ ...f, input: { ...f.input, probe: invalid } }),
  ).toThrow();
});
