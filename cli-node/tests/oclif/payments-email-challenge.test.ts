import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  attachmentsArchiveUrl,
  deriveEmailChallengeFromInbound,
  fetchInteractionJsonBytes,
  interactionJsonFromArchive,
  readTarEntries,
} from "../../src/oclif/commands/payments-email-challenge.js";

// The challenge-step interaction.json a payer receives on the inbound payment-
// request email. This is the WIRE ENVELOPE shape, byte-for-byte the fixture the
// SDK's parseEmailChallengeFromPart test uses, so the derived challenge matches
// the locked normative vector the signing tests pin.
const INTERACTION_ID = "a1b2c3d4-0000-0000-0000-000000000001@payer.example";
const CHALLENGE_STEP_ID = "f00dface-0000-0000-0000-0000000000aa";
const CHALLENGE_NONCE =
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

function wireEnvelope(): Record<string, unknown> {
  return {
    interaction_version: 1,
    interaction_id: INTERACTION_ID,
    protocol: "x402.payment",
    protocol_version: 1,
    step: "challenge",
    step_id: CHALLENGE_STEP_ID,
    prev_step_id: null,
    expires_at: "2030-01-01T00:00:00.000Z",
    payload: {
      challenge_nonce: CHALLENGE_NONCE,
      payment_requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
    },
  };
}

// --- A minimal ustar tar writer so the reader is exercised against real tar
// bytes (not a hand-rolled parser feeding its own output). ---
function octal(value: number, width: number): string {
  return `${value.toString(8).padStart(width - 1, "0")}\0`;
}

function tarEntry(name: string, content: Uint8Array): Uint8Array {
  const header = new Uint8Array(512);
  const enc = new TextEncoder();
  header.set(enc.encode(name).subarray(0, 100), 0);
  header.set(enc.encode("0000644\0"), 100); // mode
  header.set(enc.encode("0000000\0"), 108); // uid
  header.set(enc.encode("0000000\0"), 116); // gid
  header.set(enc.encode(octal(content.length, 12)), 124); // size
  header.set(enc.encode("00000000000\0"), 136); // mtime
  header.set(enc.encode("ustar\0"), 257); // magic
  header.set(enc.encode("00"), 263); // version
  header[156] = "0".charCodeAt(0); // typeflag = regular file
  // Checksum: sum of all header bytes with the checksum field as spaces.
  for (let i = 148; i < 156; i++) header[i] = 0x20;
  let sum = 0;
  for (const byte of header) sum += byte;
  header.set(enc.encode(`${octal(sum, 7)} `), 148);

  const padded = new Uint8Array(Math.ceil(content.length / 512) * 512);
  padded.set(content, 0);
  const out = new Uint8Array(header.length + padded.length);
  out.set(header, 0);
  out.set(padded, header.length);
  return out;
}

function buildTar(files: Array<{ name: string; content: string }>): Uint8Array {
  const enc = new TextEncoder();
  const parts = files.map((f) => tarEntry(f.name, enc.encode(f.content)));
  const trailer = new Uint8Array(1024); // two zero blocks end the archive
  const total = parts.reduce((acc, p) => acc + p.length, 0) + trailer.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  out.set(trailer, offset);
  return out;
}

describe("attachmentsArchiveUrl", () => {
  it("builds the per-email tarball URL and encodes the id", () => {
    expect(attachmentsArchiveUrl("https://api.example/v1", "abc 123")).toBe(
      "https://api.example/v1/emails/abc%20123/attachments.tar.gz",
    );
    // A trailing slash on the base is normalized away.
    expect(attachmentsArchiveUrl("https://api.example/v1/", "x")).toBe(
      "https://api.example/v1/emails/x/attachments.tar.gz",
    );
  });
});

describe("readTarEntries", () => {
  it("reads regular-file entries (name + bytes) and stops at the trailer", () => {
    const tar = buildTar([
      { name: "a.txt", content: "hello" },
      { name: "interaction.json", content: '{"k":1}' },
    ]);
    const entries = [...readTarEntries(tar)];
    expect(entries.map((e) => e.name)).toEqual(["a.txt", "interaction.json"]);
    expect(new TextDecoder().decode(entries[1].bytes)).toBe('{"k":1}');
  });
});

describe("interactionJsonFromArchive", () => {
  it("extracts interaction.json from a gzipped tar, matching by basename", () => {
    const tar = buildTar([
      { name: "attachments/note.txt", content: "ignore me" },
      { name: "attachments/interaction.json", content: '{"hello":"world"}' },
    ]);
    const bytes = interactionJsonFromArchive(gzipSync(tar));
    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes as Uint8Array)).toBe(
      '{"hello":"world"}',
    );
  });

  it("returns null when there is no interaction.json member", () => {
    const tar = buildTar([{ name: "note.txt", content: "x" }]);
    expect(interactionJsonFromArchive(gzipSync(tar))).toBeNull();
  });
});

describe("fetchInteractionJsonBytes", () => {
  it("fetches the tarball with a bearer token and returns the part bytes", async () => {
    const tar = buildTar([
      { name: "interaction.json", content: JSON.stringify(wireEnvelope()) },
    ]);
    const gz = gzipSync(tar);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    })) as unknown as typeof fetch;

    const bytes = await fetchInteractionJsonBytes({
      baseUrl: "https://api.example/v1",
      emailId: "inbound-1",
      apiKey: "secret",
      fetchImpl,
    });
    expect(bytes).not.toBeNull();
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0];
    expect(call[0]).toBe(
      "https://api.example/v1/emails/inbound-1/attachments.tar.gz",
    );
    expect(
      (call[1] as { headers: Record<string, string> }).headers.authorization,
    ).toBe("Bearer secret");
  });

  it("throws a descriptive error on a non-OK response", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => "not found",
    })) as unknown as typeof fetch;
    await expect(
      fetchInteractionJsonBytes({
        baseUrl: "https://api.example/v1",
        emailId: "missing",
        fetchImpl,
      }),
    ).rejects.toThrow(/HTTP 404/);
  });
});

describe("deriveEmailChallengeFromInbound", () => {
  it("reshapes the inbound wire envelope into the signable challenge object", async () => {
    const tar = buildTar([
      { name: "interaction.json", content: JSON.stringify(wireEnvelope()) },
    ]);
    const gz = gzipSync(tar);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    })) as unknown as typeof fetch;

    const challenge = await deriveEmailChallengeFromInbound({
      baseUrl: "https://api.example/v1",
      emailId: "inbound-1",
      fetchImpl,
    });

    // The reshape maps every settlement-critical field exactly. This is the
    // mapping the signer depends on; a wrong map yields a bad signature.
    expect(challenge.interaction_id).toBe(INTERACTION_ID);
    expect(challenge.challenge.nonce_binding).toEqual({
      interaction_id: INTERACTION_ID,
      challenge_step_id: CHALLENGE_STEP_ID,
      challenge_nonce: CHALLENGE_NONCE,
    });
    expect(challenge.challenge.expires_at).toBe("2030-01-01T00:00:00.000Z");
    expect(challenge.challenge.payment_requirements.maxAmountRequired).toBe(
      "10000",
    );
    expect(challenge.challenge.payment_requirements.payTo).toBe(
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("errors clearly when the inbound email has no interaction.json", async () => {
    const tar = buildTar([{ name: "note.txt", content: "x" }]);
    const gz = gzipSync(tar);
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () =>
        gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength),
    })) as unknown as typeof fetch;
    await expect(
      deriveEmailChallengeFromInbound({
        baseUrl: "https://api.example/v1",
        emailId: "inbound-1",
        fetchImpl,
      }),
    ).rejects.toThrow(/no interaction\.json attachment/);
  });
});
