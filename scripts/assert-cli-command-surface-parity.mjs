#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_OPERATION_ALIASES, COMMANDS } from "../cli-node/dist/oclif/index.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const RUST_ONLY_ALLOWED_COMMANDS = new Set(["payloads"]);

function readRepoFile(relativePath) {
  return readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

function rustOperationIds() {
  const manifest = JSON.parse(readRepoFile("cli-rust/src/operation-manifest.json"));
  return manifest.map((operation) => `${operation.tagCommand}:${operation.command}`);
}

function rustAliases() {
  const source = readRepoFile("cli-rust/src/manifest.rs");
  const aliases = new Map();
  for (const match of source.matchAll(/\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,?\s*\)/g)) {
    aliases.set(match[1], match[2]);
  }
  return aliases;
}

function rustFriendlyIds() {
  const source = readRepoFile("cli-rust/src/help_commands.rs");
  return [...source.matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function nodeCommandIds() {
  const ids = new Set(Object.keys(COMMANDS));
  for (const command of Object.values(COMMANDS)) {
    for (const alias of command.aliases ?? []) {
      ids.add(alias);
    }
  }
  return ids;
}

function nodePluginCommandIds() {
  const ids = new Set();
  const manifestPath = "cli-node/node_modules/@oclif/plugin-autocomplete/oclif.manifest.json";
  const manifest = JSON.parse(readRepoFile(manifestPath));
  for (const command of Object.values(manifest.commands ?? {})) {
    ids.add(command.id);
    for (const permutation of command.permutations ?? []) {
      ids.add(permutation);
    }
  }
  return ids;
}

function main() {
  const nodeCommands = new Set([...nodeCommandIds(), ...nodePluginCommandIds()]);
  const aliases = rustAliases();
  const rustCommands = new Set([
    ...rustOperationIds(),
    ...aliases.keys(),
    ...rustFriendlyIds(),
  ]);

  const missingInRust = sorted([...nodeCommands].filter((id) => !rustCommands.has(id)));
  const extraInRust = sorted(
    [...rustCommands].filter((id) => !nodeCommands.has(id) && !RUST_ONLY_ALLOWED_COMMANDS.has(id)),
  );

  assert.deepEqual(missingInRust, [], "Rust CLI is missing Node command ids");
  assert.deepEqual(extraInRust, [], "Rust CLI exposes command ids not present in Node");

  const wrongTargets = [];
  for (const [alias, target] of Object.entries(CANONICAL_OPERATION_ALIASES)) {
    if (aliases.get(alias) !== target) {
      wrongTargets.push({ alias, nodeTarget: target, rustTarget: aliases.get(alias) ?? null });
    }
  }
  assert.deepEqual(wrongTargets, [], "Rust canonical alias targets diverge from Node");

  console.log(
    `Command surface parity OK: ${nodeCommands.size} Node command id(s), ${rustCommands.size} Rust command id(s), ${Object.keys(CANONICAL_OPERATION_ALIASES).length} canonical alias target(s).`,
  );
}

main();
