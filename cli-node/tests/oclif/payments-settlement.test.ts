import { gzipSync } from "node:zlib";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchEmails: vi.fn() }));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return { ...actual, searchEmails: mocks.searchEmails };
});

import {
  extractSettleTx,
  isSettlementReceiptFor,
  parseInteractionEnvelope,
  pollForSettlementInteraction,
} from "../../src/oclif/commands/payments-settlement.js";

const INTERACTION_ID = "a1b2c3d4-0000-0000-0000-000000000001@payer.example";

// A one-file ustar tar, gzipped, carrying the given interaction.json content.
function gzippedArchive(content: string): Uint8Array {
  const enc = new TextEncoder();
  const body = enc.encode(content);
  const header = new Uint8Array(512);
  const octal = (v: number, w: number) =>
    `${v.toString(8).padStart(w - 1, "0")}\0`;
  header.set(enc.encode("interaction.json").subarray(0, 100), 0);
  header.set(enc.encode("0000644\0"), 100);
  header.set(enc.encode("0000000\0"), 108);
  header.set(enc.encode("0000000\0"), 116);
  header.set(enc.encode(octal(body.length, 12)), 124);
  header.set(enc.encode("00000000000\0"), 136);
  header.set(enc.encode("ustar\0"), 257);
  header.set(enc.encode("00"), 263);
  header[156] = "0".charCodeAt(0);
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  let sum = 0;
  for (const b of header) sum += b;
  header.set(enc.encode(`${octal(sum, 7)} `), 148);
  const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
  padded.set(body, 0);
  const tar = new Uint8Array(header.length + padded.length + 1024);
  tar.set(header, 0);
  tar.set(padded, header.length);
  return gzipSync(tar);
}

describe("extractSettleTx", () => {
  it("reads a top-level settle_tx", () => {
    expect(extractSettleTx({ settle_tx: "0xabc" })).toBe("0xabc");
  });

  it("reads a settle_tx nested one level into payload", () => {
    expect(extractSettleTx({ payload: { settle_tx: "0xdef" } })).toBe("0xdef");
  });

  it("returns null when no settle_tx is present", () => {
    expect(extractSettleTx({ payload: { other: 1 } })).toBeNull();
    expect(extractSettleTx({})).toBeNull();
  });
});

describe("parseInteractionEnvelope", () => {
  it("parses a JSON object", () => {
    const bytes = new TextEncoder().encode('{"a":1}');
    expect(parseInteractionEnvelope(bytes)).toEqual({ a: 1 });
  });

  it("returns null for non-JSON or non-object bytes", () => {
    expect(
      parseInteractionEnvelope(new TextEncoder().encode("not json")),
    ).toBeNull();
    expect(
      parseInteractionEnvelope(new TextEncoder().encode("[1,2]")),
    ).toBeNull();
  });
});

describe("isSettlementReceiptFor", () => {
  it("matches a later step with the same interaction_id", () => {
    expect(
      isSettlementReceiptFor(
        { interaction_id: INTERACTION_ID, step: "settled" },
        INTERACTION_ID,
      ),
    ).toBe(true);
    // A receipt with no step field still matches on interaction_id alone.
    expect(
      isSettlementReceiptFor(
        { interaction_id: INTERACTION_ID },
        INTERACTION_ID,
      ),
    ).toBe(true);
  });

  it("rejects a different interaction_id", () => {
    expect(
      isSettlementReceiptFor(
        { interaction_id: "other@x", step: "settled" },
        INTERACTION_ID,
      ),
    ).toBe(false);
  });

  it("rejects the challenge and payment steps the payer already saw/sent", () => {
    expect(
      isSettlementReceiptFor(
        { interaction_id: INTERACTION_ID, step: "challenge" },
        INTERACTION_ID,
      ),
    ).toBe(false);
    expect(
      isSettlementReceiptFor(
        { interaction_id: INTERACTION_ID, step: "payment" },
        INTERACTION_ID,
      ),
    ).toBe(false);
  });
});

describe("pollForSettlementInteraction", () => {
  const apiClient = {
    client: { host: "api" },
  } as unknown as PrimitiveApiClient;

  beforeEach(() => {
    // Reset the searchEmails mock between cases so a prior test's queued
    // mockResolvedValueOnce / mockResolvedValue cannot leak into the next poll.
    mocks.searchEmails.mockReset();
  });

  it("finds the settlement email matching the interaction_id and returns the settle_tx", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [{ id: "settle-1", received_at: "2030-01-01T00:00:01.000Z" }],
        meta: { cursor: null },
      },
    });
    const receipt = gzippedArchive(
      JSON.stringify({
        interaction_id: INTERACTION_ID,
        step: "settled",
        settle_tx: "0xfeedface",
      }),
    );
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        receipt.buffer.slice(
          receipt.byteOffset,
          receipt.byteOffset + receipt.byteLength,
        ),
    })) as unknown as typeof fetch;

    const result = await pollForSettlementInteraction({
      apiClient,
      baseUrl: "https://api.example/v1",
      interactionId: INTERACTION_ID,
      payeeFrom: "payee@payee.example",
      since: "2030-01-01T00:00:00.000Z",
      timeoutSeconds: 10,
      intervalSeconds: 1,
      fetchImpl,
    });

    expect(result).not.toBeNull();
    expect(result?.emailId).toBe("settle-1");
    expect(result?.settleTx).toBe("0xfeedface");
  });

  it("ignores an email whose interaction.json is for a different interaction", async () => {
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [{ id: "other-1", received_at: "2030-01-01T00:00:01.000Z" }],
        meta: { cursor: null },
      },
    });
    const otherReceipt = gzippedArchive(
      JSON.stringify({ interaction_id: "different@x", step: "settled" }),
    );
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        otherReceipt.buffer.slice(
          otherReceipt.byteOffset,
          otherReceipt.byteOffset + otherReceipt.byteLength,
        ),
    })) as unknown as typeof fetch;

    const result = await pollForSettlementInteraction({
      apiClient,
      baseUrl: "https://api.example/v1",
      interactionId: INTERACTION_ID,
      payeeFrom: "payee@payee.example",
      since: "2030-01-01T00:00:00.000Z",
      timeoutSeconds: 1,
      intervalSeconds: 1,
      fetchImpl,
    });
    expect(result).toBeNull();
  });

  it("retries an email whose attachment fetch fails transiently (no permanent skip)", async () => {
    // The settlement email is searchable on every poll, but its attachment
    // archive 404s the first time (not yet ready) and succeeds the second. The
    // poll must NOT mark it checked on the failed attempt, or it would never
    // re-fetch it and would time out despite the receipt arriving in time.
    mocks.searchEmails.mockResolvedValue({
      data: {
        data: [{ id: "settle-1", received_at: "2030-01-01T00:00:01.000Z" }],
        meta: { cursor: null },
      },
    });
    const receipt = gzippedArchive(
      JSON.stringify({
        interaction_id: INTERACTION_ID,
        step: "settled",
        settle_tx: "0xfeedface",
      }),
    );
    let attempt = 0;
    const fetchImpl = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) {
        // First attempt: archive not ready yet.
        return { ok: false, status: 404, text: async () => "not ready" };
      }
      return {
        ok: true,
        arrayBuffer: async () =>
          receipt.buffer.slice(
            receipt.byteOffset,
            receipt.byteOffset + receipt.byteLength,
          ),
      };
    }) as unknown as typeof fetch;

    const result = await pollForSettlementInteraction({
      apiClient,
      baseUrl: "https://api.example/v1",
      interactionId: INTERACTION_ID,
      payeeFrom: "payee@payee.example",
      since: "2030-01-01T00:00:00.000Z",
      timeoutSeconds: 5,
      intervalSeconds: 1,
      fetchImpl,
    });
    expect(attempt).toBeGreaterThanOrEqual(2);
    expect(result?.emailId).toBe("settle-1");
    expect(result?.settleTx).toBe("0xfeedface");
  });

  it("follows the cursor to find a receipt that lands on a later search page", async () => {
    // Page 1 (oldest-first) is full of non-receipt emails and returns a cursor;
    // the receipt is on page 2. A first-page-only poll would never see it.
    mocks.searchEmails
      .mockResolvedValueOnce({
        data: {
          data: [{ id: "noise-1", received_at: "2030-01-01T00:00:01.000Z" }],
          meta: { cursor: "CURSOR_PAGE_2" },
        },
      })
      .mockResolvedValueOnce({
        data: {
          data: [{ id: "settle-1", received_at: "2030-01-01T00:00:02.000Z" }],
          meta: { cursor: null },
        },
      });
    const noise = gzippedArchive(
      JSON.stringify({ interaction_id: "different@x", step: "settled" }),
    );
    const receipt = gzippedArchive(
      JSON.stringify({
        interaction_id: INTERACTION_ID,
        step: "settled",
        settle_tx: "0xfeedface",
      }),
    );
    const toAb = (u: Uint8Array) =>
      u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    const fetchImpl = vi.fn(async (url: string) => ({
      ok: true,
      arrayBuffer: async () =>
        url.includes("settle-1") ? toAb(receipt) : toAb(noise),
    })) as unknown as typeof fetch;

    const result = await pollForSettlementInteraction({
      apiClient,
      baseUrl: "https://api.example/v1",
      interactionId: INTERACTION_ID,
      payeeFrom: "payee@payee.example",
      since: "2030-01-01T00:00:00.000Z",
      timeoutSeconds: 5,
      intervalSeconds: 1,
      fetchImpl,
    });
    // Both pages were requested and the page-2 receipt was found.
    expect(mocks.searchEmails).toHaveBeenCalledTimes(2);
    expect(result?.emailId).toBe("settle-1");
    expect(result?.settleTx).toBe("0xfeedface");
  });
});
