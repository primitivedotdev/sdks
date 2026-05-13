import { describe, expect, it } from "vitest";
import { writeIdempotentReplayBannerIfReplay } from "../../src/oclif/idempotent-replay-banner.js";

// Capture stderr writes without touching process.stderr so tests
// don't bleed output and can assert on the captured payload.
function makeSink(): { writes: string[]; write: (chunk: string) => void } {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk) => {
      writes.push(chunk);
    },
  };
}

describe("writeIdempotentReplayBannerIfReplay", () => {
  it("emits a multi-line banner when idempotent_replay is true", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      {
        id: "b8925b20-271f-4338-bf77-6a3b28088bf4",
        idempotent_replay: true,
        status: "delivered",
        delivery_status: "delivered",
      },
      sink,
    );
    expect(sink.writes).toHaveLength(1);
    const banner = sink.writes[0];
    expect(banner).toMatch(/idempotent replay/i);
    expect(banner).toMatch(/no new MX traffic/i);
    expect(banner).toContain("b8925b20-271f-4338-bf77-6a3b28088bf4");
    expect(banner).toMatch(/status=delivered/);
    // Last line ends with a newline so the next stderr write doesn't
    // glue onto our banner.
    expect(banner.endsWith("\n")).toBe(true);
  });

  it("no-ops when idempotent_replay is false", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      { id: "abc", idempotent_replay: false, status: "delivered" },
      sink,
    );
    expect(sink.writes).toEqual([]);
  });

  it("no-ops when idempotent_replay is missing entirely", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      { id: "abc", status: "delivered" },
      sink,
    );
    expect(sink.writes).toEqual([]);
  });

  it("no-ops for non-object payloads", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(null, sink);
    writeIdempotentReplayBannerIfReplay(undefined, sink);
    writeIdempotentReplayBannerIfReplay("a string", sink);
    writeIdempotentReplayBannerIfReplay(42, sink);
    writeIdempotentReplayBannerIfReplay([], sink);
    expect(sink.writes).toEqual([]);
  });

  it("collapses redundant delivery_status when it duplicates status", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      {
        id: "x",
        idempotent_replay: true,
        status: "delivered",
        delivery_status: "delivered",
      },
      sink,
    );
    const banner = sink.writes[0];
    expect(banner).toMatch(/status=delivered/);
    // delivery_status should NOT also be listed separately when it
    // equals status (avoids "status=delivered, delivery_status=delivered").
    expect(banner).not.toMatch(/delivery_status=delivered.*delivery_status/);
    const occurrences = (banner.match(/delivered/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  it("shows delivery_status separately when it diverges from status", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      {
        id: "x",
        idempotent_replay: true,
        status: "delivered",
        delivery_status: "deferred",
      },
      sink,
    );
    const banner = sink.writes[0];
    expect(banner).toMatch(/status=delivered/);
    expect(banner).toMatch(/delivery_status=deferred/);
  });

  it("works without id (still emits the explanatory text)", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay({ idempotent_replay: true }, sink);
    const banner = sink.writes[0];
    expect(banner).toMatch(/idempotent replay/i);
    expect(banner).toMatch(/no new MX traffic/i);
    expect(banner).not.toMatch(/cached row id:/);
  });

  it("instructs how to bypass (vary content or supply explicit key)", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay({ idempotent_replay: true }, sink);
    const banner = sink.writes[0];
    expect(banner).toMatch(/fresh copy/i);
    expect(banner).toMatch(/Idempotency-Key/);
  });
});
