/**
 * Primitive Payloads — streaming client for large, content-addressed,
 * end-to-end-encrypted objects (attachments up to ~1 TB).
 *
 * Objects are split into fixed 64 MiB chunks; each chunk is encrypted with a
 * per-chunk AES-256-GCM key (HKDF-derived from the object CEK), content-addressed
 * by its ciphertext SHA-256, and committed under a Merkle root. This module
 * streams: it processes one chunk at a time and never holds the whole object in
 * memory, so a multi-GB file uploads/downloads in bounded memory.
 *
 * The chunk/manifest construction is byte-compatible with the server's object
 * model (packages/payloads-core in the API monorepo).
 */
import { createWriteStream } from "node:fs";
import { type FileHandle, open, rm, stat } from "node:fs/promises";

// ── Object-model constants (must match the server's payloads-core) ──
const CHUNK_SIZE = 64 * 1024 * 1024;
const MANIFEST_VERSION = 1;
const CHUNK_KDF_INFO = "payloads-chunk";
const OBJECT_ID_BYTES = 16;
const CEK_BYTES = 32;

const subtle = globalThis.crypto.subtle;
const textEncoder = new TextEncoder();

// ── Crypto / hashing primitives (byte-identical to payloads-core) ──
function randomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("invalid hex: odd length");
  if (hex.length > 0 && !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("invalid hex: non-hex character");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++)
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

async function contentHash(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest("SHA-256", bytes as BufferSource));
}

async function contentHashHex(bytes: Uint8Array): Promise<string> {
  return toHex(await contentHash(bytes));
}

/** Binary Merkle root over ordered hex leaf hashes (odd node promoted). */
async function merkleRoot(leafHashesHex: string[]): Promise<string> {
  if (leafHashesHex.length === 0) return contentHashHex(new Uint8Array(0));
  let level = leafHashesHex.map(fromHex);
  while (level.length > 1) {
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : level[i];
      const combined = new Uint8Array(left.length + right.length);
      combined.set(left, 0);
      combined.set(right, left.length);
      next.push(await contentHash(combined));
    }
    level = next;
  }
  return toHex(level[0]);
}

async function deriveChunkKey(
  cek: Uint8Array,
  index: number,
): Promise<CryptoKey> {
  const baseKey = await subtle.importKey(
    "raw",
    cek as BufferSource,
    "HKDF",
    false,
    ["deriveKey"],
  );
  const info = textEncoder.encode(`${CHUNK_KDF_INFO}:${index}`);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32) as BufferSource,
      info: info as BufferSource,
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function chunkNonce(index: number): Uint8Array {
  const nonce = new Uint8Array(12);
  new DataView(nonce.buffer).setUint32(8, index >>> 0, false);
  return nonce;
}

function chunkAad(objectId: Uint8Array, index: number): Uint8Array {
  const aad = new Uint8Array(objectId.length + 4);
  aad.set(objectId, 0);
  new DataView(aad.buffer).setUint32(objectId.length, index >>> 0, false);
  return aad;
}

async function encryptChunk(
  cek: Uint8Array,
  objectId: Uint8Array,
  index: number,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const key = await deriveChunkKey(cek, index);
  const ct = await subtle.encrypt(
    {
      name: "AES-GCM",
      iv: chunkNonce(index) as BufferSource,
      additionalData: chunkAad(objectId, index) as BufferSource,
    },
    key,
    plaintext as BufferSource,
  );
  return new Uint8Array(ct);
}

async function decryptChunk(
  cek: Uint8Array,
  objectId: Uint8Array,
  index: number,
  ciphertext: Uint8Array,
): Promise<Uint8Array> {
  const key = await deriveChunkKey(cek, index);
  const pt = await subtle.decrypt(
    {
      name: "AES-GCM",
      iv: chunkNonce(index) as BufferSource,
      additionalData: chunkAad(objectId, index) as BufferSource,
    },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(pt);
}

// ── Manifest / HTTP types ──
export interface ChunkDescriptor {
  index: number;
  ciphertextHash: string;
  plaintextSize: number;
  ciphertextSize: number;
}

export interface PayloadManifest {
  version: number;
  objectId: string;
  chunkSize: number;
  totalPlaintextSize: number;
  chunkCount: number;
  chunks: ChunkDescriptor[];
  merkleRoot: string;
}

export interface PayloadClientOptions {
  /** API base URL, e.g. https://api.primitive.dev (no trailing /v1). */
  baseUrl: string;
  /** Bearer API key. */
  apiKey: string;
}

export type ProgressPhase = "encrypt" | "upload" | "download";
export type ProgressFn = (
  phase: ProgressPhase,
  done: number,
  total: number,
) => void;

export interface PushOptions extends PayloadClientOptions {
  chunkSize?: number;
  concurrency?: number;
  onProgress?: ProgressFn;
}

export interface PushResult {
  merkleRoot: string;
  /** Hex-encoded content-encryption key; required to download+decrypt. */
  cek: string;
  chunkCount: number;
  totalBytes: number;
}

export interface PullOptions extends PayloadClientOptions {
  /** Hex-encoded CEK from push. */
  cek: string;
  concurrency?: number;
  onProgress?: ProgressFn;
}

// ── HTTP helpers ──
function authHeaders(apiKey: string): Record<string, string> {
  return { authorization: `Bearer ${apiKey}` };
}

function apiRoot(baseUrl: string): string {
  // Trim trailing slashes without a regex — a `/\/+$/` on a caller-supplied URL
  // is a polynomial-ReDoS vector (many repeated '/').
  let end = baseUrl.length;
  while (end > 0 && baseUrl.charCodeAt(end - 1) === 47 /* "/" */) end--;
  return `${baseUrl.slice(0, end)}/v1/payloads`;
}

const DEFAULT_MAX_RETRIES = 6;
// Transient statuses worth retrying: rate limiting and gateway/overload errors.
// A multi-GB transfer is dozens–thousands of requests, so an occasional 503/429
// from the edge is expected and must not fail the whole object.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch with exponential backoff on transient failures. Request bodies here are
 * in-memory buffers/strings (never streams), so a retry can safely resend them.
 */
async function retryingFetch(
  url: string,
  init: RequestInit,
  label: string,
  maxRetries = DEFAULT_MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    let networkError: unknown;
    try {
      res = await fetch(url, init);
    } catch (err) {
      networkError = err;
    }
    if (res && !RETRYABLE_STATUS.has(res.status)) return res;
    if (attempt >= maxRetries) {
      if (res) return res; // let the caller surface the final non-ok status
      throw new Error(
        `${label}: network error after ${attempt} retries: ${(networkError as Error)?.message ?? networkError}`,
      );
    }
    if (res) await res.text().catch(() => {}); // drain so the socket can be reused
    const backoffMs =
      Math.min(1000 * 2 ** attempt, 15_000) + Math.floor(Math.random() * 250);
    await sleep(backoffMs);
  }
}

async function initiate(
  opts: PayloadClientOptions,
  manifest: PayloadManifest,
): Promise<void> {
  const res = await retryingFetch(
    apiRoot(opts.baseUrl),
    {
      method: "POST",
      headers: {
        ...authHeaders(opts.apiKey),
        "content-type": "application/json",
      },
      body: JSON.stringify({ manifest }),
    },
    "initiate",
  );
  if (!res.ok)
    throw new Error(`initiate failed: HTTP ${res.status} ${await res.text()}`);
  await res.text();
}

async function putChunk(
  opts: PayloadClientOptions,
  root: string,
  d: ChunkDescriptor,
  bytes: Uint8Array,
): Promise<void> {
  const res = await retryingFetch(
    `${apiRoot(opts.baseUrl)}/${root}/chunks/${d.ciphertextHash}`,
    {
      method: "PUT",
      headers: {
        ...authHeaders(opts.apiKey),
        "content-type": "application/octet-stream",
      },
      body: bytes as BodyInit,
    },
    `chunk ${d.index} upload`,
  );
  if (!res.ok)
    throw new Error(
      `chunk ${d.index} upload failed: HTTP ${res.status} ${await res.text()}`,
    );
  await res.text();
}

async function finalize(
  opts: PayloadClientOptions,
  root: string,
): Promise<void> {
  const res = await retryingFetch(
    `${apiRoot(opts.baseUrl)}/${root}/finalize`,
    { method: "POST", headers: authHeaders(opts.apiKey) },
    "finalize",
  );
  if (!res.ok)
    throw new Error(`finalize failed: HTTP ${res.status} ${await res.text()}`);
  await res.text();
}

export async function fetchManifest(
  opts: PayloadClientOptions,
  root: string,
): Promise<PayloadManifest> {
  const res = await retryingFetch(
    `${apiRoot(opts.baseUrl)}/${root}/manifest`,
    { headers: authHeaders(opts.apiKey) },
    "get manifest",
  );
  if (!res.ok)
    throw new Error(
      `get manifest failed: HTTP ${res.status} ${await res.text()}`,
    );
  const body = (await res.json()) as { data: { manifest: PayloadManifest } };
  return body.data.manifest;
}

async function getChunkBytes(
  opts: PayloadClientOptions,
  root: string,
  d: ChunkDescriptor,
): Promise<Uint8Array> {
  const res = await retryingFetch(
    `${apiRoot(opts.baseUrl)}/${root}/chunks/${d.ciphertextHash}`,
    { headers: authHeaders(opts.apiKey) },
    `get chunk ${d.index}`,
  );
  if (!res.ok)
    throw new Error(`get chunk ${d.index} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export interface EncodeManifestOptions {
  chunkSize?: number;
  /** Hex CEK for deterministic/convergent encoding (default: random). */
  cekHex?: string;
  /** Hex object id for deterministic encoding (default: random). */
  objectIdHex?: string;
}

/**
 * Encode in-memory bytes into a payload manifest (no upload). Exposed for
 * precomputing an object's content address and for conformance-testing the
 * chunk/crypto/Merkle construction against the server object model. With a fixed
 * cek/objectId the output is fully deterministic.
 */
export async function encodeManifest(
  bytes: Uint8Array,
  opts: EncodeManifestOptions = {},
): Promise<PayloadManifest> {
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const cek = opts.cekHex ? fromHex(opts.cekHex) : randomBytes(CEK_BYTES);
  const objectId = opts.objectIdHex
    ? fromHex(opts.objectIdHex)
    : randomBytes(OBJECT_ID_BYTES);
  const chunkCount =
    bytes.length === 0 ? 0 : Math.ceil(bytes.length / chunkSize);
  const descriptors: ChunkDescriptor[] = [];
  for (let index = 0; index < chunkCount; index++) {
    const start = index * chunkSize;
    const plaintext = bytes.subarray(
      start,
      Math.min(start + chunkSize, bytes.length),
    );
    const ciphertext = await encryptChunk(cek, objectId, index, plaintext);
    descriptors.push({
      index,
      ciphertextHash: await contentHashHex(ciphertext),
      plaintextSize: plaintext.length,
      ciphertextSize: ciphertext.length,
    });
  }
  return {
    version: MANIFEST_VERSION,
    objectId: toHex(objectId),
    chunkSize,
    totalPlaintextSize: bytes.length,
    chunkCount,
    chunks: descriptors,
    merkleRoot: await merkleRoot(descriptors.map((d) => d.ciphertextHash)),
  };
}

// ── Streaming file I/O ──
async function readWindow(
  fh: FileHandle,
  position: number,
  length: number,
): Promise<Uint8Array> {
  const buf = Buffer.allocUnsafe(length);
  let read = 0;
  while (read < length) {
    const { bytesRead } = await fh.read(
      buf,
      read,
      length - read,
      position + read,
    );
    if (bytesRead === 0) break;
    read += bytesRead;
  }
  return read === length ? buf : buf.subarray(0, read);
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, i: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()),
  );
}

/**
 * Stream a file up as a Primitive Payload. Two passes over the file (encrypt to
 * build the manifest, then encrypt again to upload) keep memory bounded to a few
 * chunks — the whole object is never resident. Returns the content address
 * (merkleRoot) and the hex CEK needed to download it.
 */
export async function pushFile(
  filePath: string,
  opts: PushOptions,
): Promise<PushResult> {
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const concurrency = opts.concurrency ?? 3;
  const { size } = await stat(filePath);
  const cek = randomBytes(CEK_BYTES);
  const objectId = randomBytes(OBJECT_ID_BYTES);
  const chunkCount = size === 0 ? 0 : Math.ceil(size / chunkSize);

  const fh = await open(filePath, "r");
  try {
    // Pass 1: content-address every chunk to build the manifest.
    const descriptors: ChunkDescriptor[] = [];
    for (let index = 0; index < chunkCount; index++) {
      const position = index * chunkSize;
      const length = Math.min(chunkSize, size - position);
      const plaintext = await readWindow(fh, position, length);
      const ciphertext = await encryptChunk(cek, objectId, index, plaintext);
      descriptors.push({
        index,
        ciphertextHash: await contentHashHex(ciphertext),
        plaintextSize: length,
        ciphertextSize: ciphertext.length,
      });
      opts.onProgress?.("encrypt", index + 1, chunkCount);
    }

    const root = await merkleRoot(descriptors.map((d) => d.ciphertextHash));
    const manifest: PayloadManifest = {
      version: MANIFEST_VERSION,
      objectId: toHex(objectId),
      chunkSize,
      totalPlaintextSize: size,
      chunkCount,
      chunks: descriptors,
      merkleRoot: root,
    };

    await initiate(opts, manifest);

    // Pass 2: re-encrypt (deterministic) and upload, bounded concurrency.
    let uploaded = 0;
    await mapLimit(descriptors, concurrency, async (d) => {
      const position = d.index * chunkSize;
      const plaintext = await readWindow(fh, position, d.plaintextSize);
      const ciphertext = await encryptChunk(cek, objectId, d.index, plaintext);
      await putChunk(opts, root, d, ciphertext);
      opts.onProgress?.("upload", ++uploaded, chunkCount);
    });

    await finalize(opts, root);
    return { merkleRoot: root, cek: toHex(cek), chunkCount, totalBytes: size };
  } finally {
    await fh.close();
  }
}

/**
 * Push an in-memory buffer as a Primitive Payload. Same chunked, content-
 * addressed, per-chunk-AEAD encoding as {@link pushFile}, over a Uint8Array
 * (chunks are views, so no copy). Use {@link pushFile} for large objects that
 * shouldn't be resident in memory. Returns the content address (merkleRoot) and
 * the hex CEK.
 */
export async function pushBytes(
  bytes: Uint8Array,
  opts: PushOptions,
): Promise<PushResult> {
  const chunkSize = opts.chunkSize ?? CHUNK_SIZE;
  const concurrency = opts.concurrency ?? 3;
  const size = bytes.length;
  const cek = randomBytes(CEK_BYTES);
  const objectId = randomBytes(OBJECT_ID_BYTES);
  const chunkCount = size === 0 ? 0 : Math.ceil(size / chunkSize);
  const chunkOf = (index: number): Uint8Array =>
    bytes.subarray(index * chunkSize, Math.min(size, (index + 1) * chunkSize));

  // Pass 1: content-address every chunk to build the manifest.
  const descriptors: ChunkDescriptor[] = [];
  for (let index = 0; index < chunkCount; index++) {
    const plaintext = chunkOf(index);
    const ciphertext = await encryptChunk(cek, objectId, index, plaintext);
    descriptors.push({
      index,
      ciphertextHash: await contentHashHex(ciphertext),
      plaintextSize: plaintext.length,
      ciphertextSize: ciphertext.length,
    });
    opts.onProgress?.("encrypt", index + 1, chunkCount);
  }

  const root = await merkleRoot(descriptors.map((d) => d.ciphertextHash));
  const manifest: PayloadManifest = {
    version: MANIFEST_VERSION,
    objectId: toHex(objectId),
    chunkSize,
    totalPlaintextSize: size,
    chunkCount,
    chunks: descriptors,
    merkleRoot: root,
  };
  await initiate(opts, manifest);

  // Pass 2: re-encrypt (deterministic) and upload, bounded concurrency.
  let uploaded = 0;
  await mapLimit(descriptors, concurrency, async (d) => {
    const ciphertext = await encryptChunk(
      cek,
      objectId,
      d.index,
      chunkOf(d.index),
    );
    await putChunk(opts, root, d, ciphertext);
    opts.onProgress?.("upload", ++uploaded, chunkCount);
  });

  await finalize(opts, root);
  return { merkleRoot: root, cek: toHex(cek), chunkCount, totalBytes: size };
}

/**
 * Stream a Primitive Payload down to a file, verifying and decrypting one chunk
 * at a time (bounded memory). Every chunk is content-address-checked before
 * decryption, so a corrupt or substituted chunk throws.
 */
export async function pullFile(
  root: string,
  outPath: string,
  opts: PullOptions,
): Promise<PayloadManifest> {
  const manifest = await fetchManifest(opts, root);
  // Content-address check: the manifest must actually describe the object at
  // `root`. Recompute the Merkle root from the chunk hashes so a server can't
  // substitute a manifest for a different object.
  const computedRoot = await merkleRoot(
    manifest.chunks.map((c) => c.ciphertextHash),
  );
  if (computedRoot !== root) {
    throw new Error(
      `manifest does not match the requested content address (got ${computedRoot})`,
    );
  }
  const cek = fromHex(opts.cek);
  const objectId = fromHex(manifest.objectId);
  const out = createWriteStream(outPath);
  // Surface async write failures (disk full, EIO) as a rejection: without an
  // 'error' listener the stream would throw an uncaught error and crash the
  // process, bypassing the cleanup below.
  let onWriteError: (err: Error) => void = () => {};
  const writeErrored = new Promise<never>((_, reject) => {
    onWriteError = reject;
  });
  writeErrored.catch(() => {}); // never an unhandled rejection on the happy path
  out.on("error", (err: Error) => onWriteError(err));

  try {
    let done = 0;
    for (const d of manifest.chunks) {
      const ciphertext = await getChunkBytes(opts, root, d);
      if ((await contentHashHex(ciphertext)) !== d.ciphertextHash) {
        throw new Error(`chunk ${d.index} failed integrity check`);
      }
      const plaintext = await decryptChunk(cek, objectId, d.index, ciphertext);
      if (!out.write(plaintext)) {
        await Promise.race([
          new Promise<void>((resolve) => out.once("drain", resolve)),
          writeErrored,
        ]);
      }
      opts.onProgress?.("download", ++done, manifest.chunkCount);
    }
    await Promise.race([
      new Promise<void>((resolve) => out.end(resolve)),
      writeErrored,
    ]);
  } catch (err) {
    // Don't leave a partial/corrupt plaintext file behind on a failed download.
    out.destroy();
    await rm(outPath, { force: true });
    throw err;
  }
  return manifest;
}
