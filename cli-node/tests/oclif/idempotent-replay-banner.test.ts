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
  it("says the message already went out and nothing new was sent", () => {
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
    expect(sink.writes).toEqual([
      "Already sent: this exact message went out earlier (sent id b8925b20-271f-4338-bf77-6a3b28088bf4, status delivered). Nothing new was sent.\n",
    ]);
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

  it("names the status once when delivery_status duplicates it", () => {
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
    expect(banner).toContain("(sent id x, status delivered)");
    expect((banner.match(/delivered/g) ?? []).length).toBe(1);
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
    expect(sink.writes[0]).toContain(
      "(sent id x, status delivered, delivery status deferred)",
    );
  });

  it("works without id or status", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay({ idempotent_replay: true }, sink);
    expect(sink.writes).toEqual([
      "Already sent: this exact message went out earlier. Nothing new was sent.\n",
    ]);
  });

  it("never advises sending a fresh copy", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      { id: "x", idempotent_replay: true, status: "queued" },
      sink,
    );
    const banner = sink.writes[0];
    expect(banner).not.toMatch(/fresh copy|vary|Idempotency-Key|retry/i);
  });
});
