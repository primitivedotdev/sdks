import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  encodeManifest,
  type PayloadManifest,
} from "../../src/payloads/index.js";

// Conformance guard for the Primitive Payloads object model.
//
// The SDK carries its own copy of the chunk/crypto/Merkle construction so the
// public package needs no low-level dependency. This test pins that copy to the
// SERVER reference implementation via a golden vector generated from the mono-repo
// (@primitivedotdev/payloads-core). If anyone changes the client's HKDF/AES-GCM,
// content hashing, or Merkle layout — or the server's — the produced manifest
// stops matching the vector and this fails, catching drift that would otherwise
// silently break cross-decrypt and content-address dedup between client and server.
//
// Regenerate the vector from the mono-repo when the object model changes on purpose.

interface ConformanceVector {
  input: { sizeBytes: number; recipe: string };
  cekHex: string;
  objectIdHex: string;
  chunkSize: number;
  expectedManifest: PayloadManifest;
}

const vectorFiles = [
  "conformance-vector.json",
  "zero-byte-conformance-vector.json",
] as const;

function loadVector(filename: (typeof vectorFiles)[number]): ConformanceVector {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../test-fixtures/payloads/${filename}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as ConformanceVector;
}

/** Deterministic input matching the fixture recipe: byteAt(i) = (i * 31 + 7) & 0xff. */
function buildInput(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + 7) & 0xff;
  return bytes;
}

describe("payloads object-model conformance (vs server reference)", () => {
  it.each(
    vectorFiles,
  )("reproduces the server-generated manifest byte-for-byte: %s", async (filename) => {
    const vector = loadVector(filename);
    const input = buildInput(vector.input.sizeBytes);
    const manifest = await encodeManifest(input, {
      cekHex: vector.cekHex,
      objectIdHex: vector.objectIdHex,
      chunkSize: vector.chunkSize,
    });
    expect(manifest).toEqual(vector.expectedManifest);
  });

  it.each(
    vectorFiles,
  )("matches per-chunk content addresses and the Merkle root: %s", async (filename) => {
    const vector = loadVector(filename);
    const input = buildInput(vector.input.sizeBytes);
    const manifest = await encodeManifest(input, {
      cekHex: vector.cekHex,
      objectIdHex: vector.objectIdHex,
      chunkSize: vector.chunkSize,
    });
    expect(manifest.chunks.map((c) => c.ciphertextHash)).toEqual(
      vector.expectedManifest.chunks.map((c) => c.ciphertextHash),
    );
    expect(manifest.merkleRoot).toBe(vector.expectedManifest.merkleRoot);
  });

  it("rejects non-positive and non-integer chunk sizes", async () => {
    const input = buildInput(16);
    for (const chunkSize of [
      0,
      -1,
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      await expect(encodeManifest(input, { chunkSize })).rejects.toThrow(
        /chunkSize/,
      );
    }
  });

  it("rejects CEK and object id hex values with the wrong length", async () => {
    const vector = loadVector("conformance-vector.json");
    const input = buildInput(vector.input.sizeBytes);
    await expect(
      encodeManifest(input, {
        cekHex: vector.cekHex.slice(2),
        objectIdHex: vector.objectIdHex,
        chunkSize: vector.chunkSize,
      }),
    ).rejects.toThrow(/cekHex/);
    await expect(
      encodeManifest(input, {
        cekHex: vector.cekHex,
        objectIdHex: `${vector.objectIdHex}00`,
        chunkSize: vector.chunkSize,
      }),
    ).rejects.toThrow(/objectIdHex/);
  });
});
