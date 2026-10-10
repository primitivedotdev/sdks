import { describe, expect, it } from "vitest";
import {
  formatAlreadySentNotice,
  formatReplayAge,
  writeIdempotentReplayBannerIfReplay,
} from "../../src/oclif/idempotent-replay-banner.js";

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

  it("gives no advice when the API does not say why it replayed", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(
      { id: "x", idempotent_replay: true, status: "queued" },
      sink,
    );
    const banner = sink.writes[0];
    expect(banner).not.toMatch(/fresh copy|vary|idempotency.key|retry/i);
  });
});

const ORIGINAL_ID = "3f1c0a9e-2b7d-4e5a-9c6f-8d2e1a4b5c6d";
const CREATED_AT = "2026-10-06T12:00:07.000Z";
const NOW = Date.parse("2026-10-06T12:00:49.000Z");

function replayed(
  keySource: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: ORIGINAL_ID,
    idempotent_replay: true,
    status: "delivered",
    delivery_status: "delivered",
    client_idempotency_key: "order-1042-confirmation",
    dedup_reason: "content_hash_match",
    idempotency: {
      replayed: true,
      key_source: keySource,
      original_sent_email_id: ORIGINAL_ID,
      original_created_at: CREATED_AT,
      window_seconds: keySource === "auto_content" ? 300 : null,
    },
    ...overrides,
  };
}

describe("replay notice worded from the idempotency object", () => {
  it("says an automatic content key collapsed the send and how to send again", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(replayed("auto_content"), {
      ...sink,
      now: NOW,
    });
    expect(sink.writes).toEqual([
      `Not sent: identical to ${ORIGINAL_ID} sent 42s ago (status delivered). Pass an idempotency key to send again.\n`,
    ]);
  });

  it("names the key for an explicit key and does not suggest a window", () => {
    expect(formatAlreadySentNotice(replayed("explicit"), { now: NOW })).toBe(
      `Not sent: idempotency key order-1042-confirmation was already used for ${ORIGINAL_ID} sent 42s ago (status delivered). A key you pass never expires. Use a different key only for a different message.`,
    );
  });

  it("treats a key the CLI derived from content as the automatic key", () => {
    expect(
      formatAlreadySentNotice(replayed("explicit"), {
        keyOrigin: "cli_derived",
        keyHint: "--idempotency-key with a new key",
        now: NOW,
      }),
    ).toBe(
      `Not sent: identical to ${ORIGINAL_ID} sent 42s ago (status delivered). Pass --idempotency-key with a new key to send again.`,
    );
  });

  it("says a Function already sent for the same trigger and offers no key", () => {
    const notice = formatAlreadySentNotice(replayed("function_trigger"), {
      now: NOW,
    });
    expect(notice).toBe(
      `Not sent: this Function already sent this message as ${ORIGINAL_ID} sent 42s ago (status delivered), for the same email or event that invoked it. A Function that runs again for one trigger sends once.`,
    );
    expect(notice).not.toMatch(/Pass /);
  });

  it("says the parent already has a reply, whatever the key source", () => {
    expect(
      formatAlreadySentNotice(
        replayed("auto_content", {
          dedup_reason: "parent_already_replied",
          idempotency: {
            replayed: true,
            key_source: "auto_content",
            original_sent_email_id: ORIGINAL_ID,
            original_created_at: CREATED_AT,
            window_seconds: null,
          },
        }),
        { now: NOW },
      ),
    ).toBe(
      `Not sent: the email already has a reply, ${ORIGINAL_ID} sent 42s ago (status delivered). Pass an idempotency key to send another reply.`,
    );
  });

  it("uses four different sentences for the four cases", () => {
    const notices = [
      formatAlreadySentNotice(replayed("auto_content"), { now: NOW }),
      formatAlreadySentNotice(replayed("explicit"), { now: NOW }),
      formatAlreadySentNotice(replayed("function_trigger"), { now: NOW }),
      formatAlreadySentNotice(
        replayed("auto_content", { dedup_reason: "parent_already_replied" }),
        { now: NOW },
      ),
    ];
    expect(new Set(notices).size).toBe(4);
  });

  it("drops the advice when the caller says not to advise", () => {
    expect(
      formatAlreadySentNotice(replayed("auto_content"), {
        advise: false,
        now: NOW,
      }),
    ).toBe(
      `Not sent: identical to ${ORIGINAL_ID} sent 42s ago (status delivered).`,
    );
  });

  it("omits the age when the API reports no creation time", () => {
    expect(
      formatAlreadySentNotice(
        replayed("auto_content", {
          idempotency: {
            replayed: true,
            key_source: "auto_content",
            original_sent_email_id: ORIGINAL_ID,
            original_created_at: null,
            window_seconds: 300,
          },
        }),
        { now: NOW },
      ),
    ).toBe(
      `Not sent: identical to ${ORIGINAL_ID} (status delivered). Pass an idempotency key to send again.`,
    );
  });

  it("falls back to the general notice for a key source it does not know", () => {
    expect(formatAlreadySentNotice(replayed("some_new_source"))).toBe(
      `Already sent: this exact message went out earlier (sent id ${ORIGINAL_ID}, status delivered). Nothing new was sent.`,
    );
  });

  it("never tells the caller to change the message", () => {
    for (const source of ["auto_content", "explicit", "function_trigger"]) {
      expect(
        formatAlreadySentNotice(replayed(source), { now: NOW }),
      ).not.toMatch(/fresh copy|vary|change the (subject|body|content)/i);
    }
  });

  it("writes a single line, so a notice cannot break a stderr parser", () => {
    const sink = makeSink();
    writeIdempotentReplayBannerIfReplay(replayed("auto_content"), {
      ...sink,
      now: NOW,
    });
    expect(sink.writes).toHaveLength(1);
    expect(sink.writes[0].endsWith("\n")).toBe(true);
    expect(sink.writes[0].trimEnd()).not.toContain("\n");
  });
});

describe("formatReplayAge", () => {
  const at = (iso: string) => Date.parse(iso);

  it("counts seconds up to two minutes, then minutes, hours and days", () => {
    expect(formatReplayAge(CREATED_AT, at("2026-10-06T12:00:07.000Z"))).toBe(
      "0s ago",
    );
    expect(formatReplayAge(CREATED_AT, at("2026-10-06T12:02:06.000Z"))).toBe(
      "119s ago",
    );
    expect(formatReplayAge(CREATED_AT, at("2026-10-06T12:04:07.000Z"))).toBe(
      "4m ago",
    );
    expect(formatReplayAge(CREATED_AT, at("2026-10-06T15:00:07.000Z"))).toBe(
      "3h ago",
    );
    expect(formatReplayAge(CREATED_AT, at("2026-10-15T12:00:07.000Z"))).toBe(
      "9d ago",
    );
  });

  it("reads a clock behind the API as zero, not a negative age", () => {
    expect(formatReplayAge(CREATED_AT, at("2026-10-06T12:00:01.000Z"))).toBe(
      "0s ago",
    );
  });

  it("returns null for a missing or unparseable time", () => {
    expect(formatReplayAge(null, NOW)).toBeNull();
    expect(formatReplayAge("not a date", NOW)).toBeNull();
  });
});
