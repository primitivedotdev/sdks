#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const SOURCE_PATH = "packages/api-core/src/openapi/operations.generated.ts";
const RUST_PATH = "cli-rust/src/operation-manifest.json";
const PREFIX = "export const operationManifest: PrimitiveOperationManifest[] = ";
const PREFIX_BYTES = Buffer.from(PREFIX);
const SUFFIX_BYTES = Buffer.from(";\n");
const TRAILING_NEWLINE = Buffer.from("\n");

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function readOperationManifestLiteral() {
  const source = readFileSync(path.join(REPO_ROOT, SOURCE_PATH));
  const start = source.indexOf(PREFIX_BYTES);
  if (start === -1) {
    throw new Error(`operationManifest export not found in ${SOURCE_PATH}`);
  }

  const literalStart = start + PREFIX_BYTES.length;
  const literalEnd = source.indexOf(SUFFIX_BYTES, literalStart);
  if (literalEnd === -1) {
    throw new Error(`operationManifest export terminator not found in ${SOURCE_PATH}`);
  }

  return Buffer.concat([source.subarray(literalStart, literalEnd), TRAILING_NEWLINE]);
}

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

const sourceManifest = readOperationManifestLiteral();
const rustManifest = readFileSync(path.join(REPO_ROOT, RUST_PATH));

if (!sourceManifest.equals(rustManifest)) {
  const offset = firstDifference(sourceManifest, rustManifest);
  console.error("Rust operation manifest is not a byte-for-byte copy of the TypeScript manifest.");
  console.error(
    JSON.stringify(
      {
        sourcePath: SOURCE_PATH,
        rustPath: RUST_PATH,
        firstDifferentByte: offset,
        sourceBytes: sourceManifest.byteLength,
        rustBytes: rustManifest.byteLength,
        sourceSha256: sha256(sourceManifest),
        rustSha256: sha256(rustManifest),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

console.log(
  `Rust operation manifest bytewise copy OK: ${rustManifest.byteLength} bytes, sha256 ${sha256(
    rustManifest,
  )}`,
);
