#!/usr/bin/env node

/**
 * Assert that the packed package.json of a workspace project does not
 * carry any reference to the workspace-internal `@primitivedotdev/
 * api-core` package or to the other public Primitive package.
 *
 * Background. cli-node and sdk-node both bundle api-core's source
 * inline at build time. The published tarballs therefore have no
 * runtime need to resolve `@primitivedotdev/api-core`, and listing
 * it (or the other public package) under `dependencies` /
 * `peerDependencies` / `optionalDependencies` of a published tarball
 * is either dead weight (api-core is `"private": true` and never
 * exists on the registry, so install would fail) or a hidden
 * coupling that the bundler refactor was specifically meant to break.
 *
 * Usage:
 *   node scripts/assert-tarball-isolation.mjs <package-dir> [forbiddenName...]
 *
 *   <package-dir>      Directory containing the package.json to pack.
 *   forbiddenName...   Optional extra forbidden specifier names. Always
 *                      includes "@primitivedotdev/api-core". Pass
 *                      "@primitivedotdev/sdk" for cli-node's check, or
 *                      "primitive" (and its legacy scoped mirror
 *                      "@primitivedotdev/cli") for sdk-node's check,
 *                      to pin the no-cross-dep invariant too.
 *
 * Exits 0 on success, 1 with a diagnostic on the first offense.
 */

import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const FORBIDDEN_BASELINE = ["@primitivedotdev/api-core"];

const [, , pkgDirArg, ...extra] = process.argv;
if (!pkgDirArg) {
  console.error("usage: assert-tarball-isolation.mjs <package-dir> [forbiddenName...]");
  process.exit(2);
}

const pkgDir = resolve(pkgDirArg);
const forbidden = new Set([...FORBIDDEN_BASELINE, ...extra]);

// npm pack --dry-run --json is the canonical way to inspect what
// would land in the tarball without actually writing one. It honors
// the `files` allowlist and runs the prepack scripts, so the
// returned manifest is the same one consumers would see.
let raw;
try {
  raw = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: pkgDir,
    encoding: "utf8",
    // Suppress prepack stdout chatter; we only want the JSON tail.
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch (err) {
  console.error(`npm pack failed in ${pkgDir}: ${err.message}`);
  process.exit(1);
}

// npm pack --json may emit non-JSON banner lines (prepack output,
// tsdown's ANSI-coloured progress) before the JSON payload, or
// nothing at all when the package has no prepack script. The
// payload is always an array spanning lines that start with `[`
// and end with `]`. Find the start by scanning for a line whose
// first non-whitespace character is `[` and treating from there
// as JSON. Avoids tsdown's ANSI escape sequences (which start
// `\x1b[34m...`) that a naive first-`[` scan would match.
const lines = raw.split(/\r?\n/);
let startLine = -1;
for (let i = 0; i < lines.length; i += 1) {
  if (lines[i].trimStart().startsWith("[") && !lines[i].includes("\x1b")) {
    startLine = i;
    break;
  }
}
if (startLine === -1) {
  console.error(`could not locate JSON array in npm pack output:\n${raw}`);
  process.exit(1);
}
const packed = JSON.parse(lines.slice(startLine).join("\n"));
const entry = packed[0];
if (!entry) {
  console.error("npm pack returned no entries");
  process.exit(1);
}

// Find the packed package.json inside the listed files. The file
// payload itself is not in the JSON; we read it back from disk
// (the tarball would carry the exact same content because npm
// only rewrites workspace specifiers via `pnpm publish`, not the
// vanilla `npm pack` we are gating here).
const pkg = JSON.parse(
  execFileSync("node", [
    "-e",
    `const fs=require("fs");const p=JSON.parse(fs.readFileSync("${pkgDir}/package.json","utf8"));process.stdout.write(JSON.stringify(p));`,
  ], { encoding: "utf8" }),
);

const offenses = [];
for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
  const map = pkg[field];
  if (!map || typeof map !== "object") continue;
  for (const name of Object.keys(map)) {
    if (forbidden.has(name)) {
      offenses.push({ field, name, value: map[name] });
    }
  }
}

if (offenses.length > 0) {
  console.error(`\nTarball isolation check FAILED for ${entry.name}@${entry.version}:`);
  for (const o of offenses) {
    console.error(`  - ${o.field}.${o.name} = ${JSON.stringify(o.value)}`);
  }
  console.error(
    "\nThese specifiers must not appear in the published tarball's deps; the bundler\n" +
    "inlines their source. Remove the entry from dependencies (move to devDependencies\n" +
    "if the build step still needs it) and rebuild.\n",
  );
  process.exit(1);
}

console.log(
  `tarball isolation check OK for ${entry.name}@${entry.version}: no forbidden specifier in deps (${[...forbidden].join(", ")}).`,
);
