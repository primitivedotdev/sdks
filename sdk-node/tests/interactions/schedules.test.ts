import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildScheduleStopBody,
  interactionKind,
  parseInteractionEnvelope,
  parseScheduleStop,
  parseScheduleTick,
  readScheduleStop,
  readScheduleTick,
  SCHEDULE_STOP_KIND,
  SCHEDULE_TICK_KIND,
  scheduleStopCommand,
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
    new URL(
      "../../../test-fixtures/schedule-interactions.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

describe("shared schedule tick parsing", () => {
  for (const f of fixtures.ticks)
    it(f.name, () => {
      const result = parseScheduleTick(f.raw);
      expect(result.status).toBe(f.status);
      if (result.status === "valid") expect(result.tick).toEqual(f.tick);
      if (result.status === "invalid") expect(result.reason).toBe(f.reason);
      const bytes = parseScheduleTick(new TextEncoder().encode(f.raw));
      expect(bytes).toEqual(result);
    });
});

describe("shared schedule stop parsing", () => {
  for (const f of fixtures.stop_envelopes)
    it(f.name, () => {
      const result = parseScheduleStop(f.raw);
      expect(result.status).toBe(f.status);
      if (result.status === "valid") expect(result.stop).toEqual(f.stop);
      if (result.status === "invalid") expect(result.reason).toBe(f.reason);
    });
});

describe("shared schedule stop request bodies", () => {
  for (const f of fixtures.stop_bodies)
    it(f.name, () => {
      if (f.status === "invalid") {
        expect(() => buildScheduleStopBody({ reason: f.reason })).toThrow(
          TypeError,
        );
        return;
      }
      expect(buildScheduleStopBody({ reason: f.reason })).toEqual(f.body);
    });
});

describe("schedule helpers", () => {
  it("names interaction kinds by protocol and version", () => {
    const valid = fixtures.ticks[0];
    if (!valid) throw new Error("missing fixture");
    const parsed = parseInteractionEnvelope(valid.raw);
    if (parsed.status !== "valid") throw new Error("fixture must parse");
    expect(interactionKind(parsed.envelope)).toBe(SCHEDULE_TICK_KIND);
    expect(readScheduleTick(parsed.envelope).status).toBe("valid");
    expect(readScheduleStop(parsed.envelope).status).toBe("other");
    expect(
      interactionKind({ protocol: "schedule.stop", protocol_version: 1 }),
    ).toBe(SCHEDULE_STOP_KIND);
  });

  it("formats the stop command for a tick email", () => {
    expect(scheduleStopCommand("9A8B7C6D-5E4F-4A3B-8C2D-1E0F9A8B7C6D")).toBe(
      "primitive schedule stop --id 9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    );
    expect(() => scheduleStopCommand("--id; rm")).toThrow(TypeError);
  });

  it("rejects a non-string reason", () => {
    expect(() =>
      buildScheduleStopBody({ reason: 42 as unknown as string }),
    ).toThrow(TypeError);
  });
});
