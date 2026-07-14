import { createHash, randomFillSync } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pullFile, pushFile } from "../../src/payloads/index.js";

const BASE = "https://api.test.example";
const KEY = "prim_test";

interface ServerOptions {
  /** Return 503 for the first N chunk uploads, then serve normally (retry path). */
  flakyPuts?: number;
  /** On download, corrupt the ciphertext of this chunk index (integrity path). */
  corruptChunkIndex?: number;
}

/** In-memory Primitive Payloads server as a fetch mock. */
function makeServer(opts: ServerOptions = {}) {
  const manifests = new Map<string, unknown>();
  const chunks = new Map<string, Uint8Array>();
  let flaky = opts.flakyPuts ?? 0;

  const json = (status: number, data: unknown): Response =>
    new Response(JSON.stringify({ success: status < 400, data }), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetchMock = vi.fn(
    async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      const url = new URL(typeof input === "string" ? input : input.toString());
      const method = (init?.method ?? "GET").toUpperCase();
      const parts = url.pathname
        .replace(/^\/v1\/payloads\/?/, "")
        .split("/")
        .filter(Boolean);

      if (method === "POST" && parts.length === 0) {
        const body = JSON.parse(init?.body as string) as {
          manifest: { merkleRoot: string; chunkCount: number };
        };
        manifests.set(body.manifest.merkleRoot, body.manifest);
        return json(201, {
          merkle_root: body.manifest.merkleRoot,
          state: "pending",
          chunk_count: body.manifest.chunkCount,
        });
      }
      const [root, kind, hash] = parts;
      if (method === "PUT" && kind === "chunks") {
        if (flaky > 0) {
          flaky--;
          return new Response("overloaded", { status: 503 });
        }
        chunks.set(
          `${root}/${hash}`,
          new Uint8Array(
            await new Response(init?.body as BodyInit).arrayBuffer(),
          ),
        );
        return json(200, { merkle_root: root, chunk: hash, stored: true });
      }
      if (method === "POST" && kind === "finalize")
        return json(200, { merkle_root: root, state: "ready" });
      if (method === "GET" && kind === "manifest")
        return json(200, {
          merkle_root: root,
          state: "ready",
          manifest: manifests.get(root),
        });
      if (method === "GET" && kind === "chunks") {
        const bytes = chunks.get(`${root}/${hash}`);
        if (!bytes) return new Response("not found", { status: 404 });
        const manifest = manifests.get(root) as {
          chunks: { index: number; ciphertextHash: string }[];
        };
        const idx = manifest.chunks.find(
          (c) => c.ciphertextHash === hash,
        )?.index;
        const out = new Uint8Array(bytes);
        if (
          opts.corruptChunkIndex !== undefined &&
          idx === opts.corruptChunkIndex
        )
          out[0] ^= 0xff;
        return new Response(out);
      }
      return new Response("bad route", { status: 400 });
    },
  );

  return { fetchMock, chunks };
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "payloads-client-"));
});
afterEach(() => {
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

function writeRandom(name: string, size: number): string {
  const path = join(dir, name);
  const buf = Buffer.allocUnsafe(size);
  if (size > 0) randomFillSync(buf);
  writeFileSync(path, buf);
  return path;
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function roundTrip(
  size: number,
  chunkSize: number,
  server = makeServer(),
): Promise<void> {
  vi.stubGlobal("fetch", server.fetchMock);
  const inPath = writeRandom("in.bin", size);
  const pushed = await pushFile(inPath, {
    baseUrl: BASE,
    apiKey: KEY,
    chunkSize,
  });
  expect(pushed.totalBytes).toBe(size);
  const outPath = join(dir, "out.bin");
  await pullFile(pushed.merkleRoot, outPath, {
    baseUrl: BASE,
    apiKey: KEY,
    cek: pushed.cek,
  });
  expect(sha256(outPath)).toBe(sha256(inPath));
}

describe("payloads streaming client (offline)", () => {
  it("round-trips a multi-chunk object", async () => {
    await roundTrip(5000, 1024); // 5 chunks (4 full + partial)
  });

  it("round-trips a single-chunk object", async () => {
    await roundTrip(700, 1024);
  });

  it("round-trips an object sized exactly on a chunk boundary", async () => {
    await roundTrip(2048, 1024); // exactly 2 chunks, no partial
  });

  it("round-trips a zero-byte object", async () => {
    const server = makeServer();
    vi.stubGlobal("fetch", server.fetchMock);
    const inPath = writeRandom("empty.bin", 0);
    const pushed = await pushFile(inPath, {
      baseUrl: BASE,
      apiKey: KEY,
      chunkSize: 1024,
    });
    expect(pushed.chunkCount).toBe(0);
    const outPath = join(dir, "out.bin");
    await pullFile(pushed.merkleRoot, outPath, {
      baseUrl: BASE,
      apiKey: KEY,
      cek: pushed.cek,
    });
    expect(readFileSync(outPath).length).toBe(0);
  });

  it("retries a transient 503 on upload and still completes", async () => {
    await roundTrip(3000, 1024, makeServer({ flakyPuts: 1 }));
  });

  it("rejects a corrupted chunk on download (integrity check)", async () => {
    const server = makeServer({ corruptChunkIndex: 1 });
    vi.stubGlobal("fetch", server.fetchMock);
    const inPath = writeRandom("in.bin", 5000);
    const pushed = await pushFile(inPath, {
      baseUrl: BASE,
      apiKey: KEY,
      chunkSize: 1024,
    });
    await expect(
      pullFile(pushed.merkleRoot, join(dir, "out.bin"), {
        baseUrl: BASE,
        apiKey: KEY,
        cek: pushed.cek,
      }),
    ).rejects.toThrow(/integrity check/);
  });
});
