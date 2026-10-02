import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildRepeatStopBody,
  interactionKind,
  parseInteractionEnvelope,
  parseRepeatStop,
  parseRepeatTick,
  REPEAT_STOP_KIND,
  REPEAT_TICK_KIND,
  readRepeatStop,
  readRepeatTick,
  repeatStopCommand,
} from "../../src/interactions/index.js";

const fixtures: {
  ticks: {
    name: string;
    raw: string;
    status: string;
    reason?: string;
    tick?: unknown;
  }[];
  stop_envelopes: {
    name: string;
    raw: string;
    status: string;
    reason?: string;
    stop?: unknown;
  }[];
  stop_bodies: {
    name: string;
    reason: string | null;
    status: string;
    body?: unknown;
  }[];
} = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/repeat-interactions.json", import.meta.url),
    "utf8",
  ),
);

describe("shared repeat tick parsing", () => {
  for (const f of fixtures.ticks)
    it(f.name, () => {
      const result = parseRepeatTick(f.raw);
      expect(result.status).toBe(f.status);
      if (result.status === "valid") expect(result.tick).toEqual(f.tick);
      if (result.status === "invalid") expect(result.reason).toBe(f.reason);
      const bytes = parseRepeatTick(new TextEncoder().encode(f.raw));
      expect(bytes).toEqual(result);
    });
});

describe("shared repeat stop parsing", () => {
  for (const f of fixtures.stop_envelopes)
    it(f.name, () => {
      const result = parseRepeatStop(f.raw);
      expect(result.status).toBe(f.status);
      if (result.status === "valid") expect(result.stop).toEqual(f.stop);
      if (result.status === "invalid") expect(result.reason).toBe(f.reason);
    });
});

describe("shared repeat stop request bodies", () => {
  for (const f of fixtures.stop_bodies)
    it(f.name, () => {
      if (f.status === "invalid") {
        expect(() => buildRepeatStopBody({ reason: f.reason })).toThrow(
          TypeError,
        );
        return;
      }
      expect(buildRepeatStopBody({ reason: f.reason })).toEqual(f.body);
    });
});

describe("repeat helpers", () => {
  it("names interaction kinds by protocol and version", () => {
    const valid = fixtures.ticks[0];
    if (!valid) throw new Error("missing fixture");
    const parsed = parseInteractionEnvelope(valid.raw);
    if (parsed.status !== "valid") throw new Error("fixture must parse");
    expect(interactionKind(parsed.envelope)).toBe(REPEAT_TICK_KIND);
    expect(readRepeatTick(parsed.envelope).status).toBe("valid");
    expect(readRepeatStop(parsed.envelope).status).toBe("other");
    expect(
      interactionKind({ protocol: "repeat.stop", protocol_version: 1 }),
    ).toBe(REPEAT_STOP_KIND);
  });

  it("formats the stop command for a repeated message", () => {
    expect(repeatStopCommand("9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D")).toBe(
      "primitive repeat stop --id 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    );
    expect(() => repeatStopCommand("--id; rm")).toThrow(TypeError);
  });

  it("rejects a non-string reason", () => {
    expect(() =>
      buildRepeatStopBody({ reason: 42 as unknown as string }),
    ).toThrow(TypeError);
  });
});
