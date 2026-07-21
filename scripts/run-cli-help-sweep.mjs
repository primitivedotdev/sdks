#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  CANONICAL_OPERATION_ALIASES,
  COMMANDS,
} from "../cli-node/dist/oclif/index.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_TIMEOUT_MS = 30_000;
const RETRY_TIMEOUT_MS = 60_000;
const DEFAULT_CONCURRENCY = 8;
const HELP_FLAG_TOKEN_SECTION_HEADINGS = new Set([
  "USAGE",
  "FLAGS",
  "GLOBAL FLAGS",
  "OPTIONS",
  "GLOBAL OPTIONS",
]);
const HELP_SECTION_HEADINGS = new Set([
  ...HELP_FLAG_TOKEN_SECTION_HEADINGS,
  "ALIASES",
  "API",
  "ARGUMENTS",
  "COMMANDS",
  "DESCRIPTION",
  "EXAMPLES",
  "TOPICS",
]);
// Intentional Rust/Node help differences only. Do not add backlog gaps here:
// --compare-flags is useful precisely because it can fail while surfacing them.
const RUST_MISSING_NODE_FLAG_TOKEN_ALLOWLIST = [];
const RUST_EXTRA_NODE_FLAG_TOKEN_ALLOWLIST = [];
const EXPECTED_NODE_REJECTED_OPTIONAL_HELP_LABELS = new Set([
  "--help create",
  "--help script",
  "autocomplete -h",
  "chat -h",
  "config -h",
  "create",
  "create --help",
  "create -h",
  "help create",
  "help script",
  "login -h",
  "login otp -h",
  "login:otp -h",
  "otp -h",
  "script",
  "script --help",
  "script -h",
  "search -h",
  "signin -h",
  "signin otp -h",
  "signin:otp -h",
  "signup -h",
]);
const OPERATION_MANIFEST = JSON.parse(
  readFileSync(
    path.join(REPO_ROOT, "cli-rust/src/operation-manifest.json"),
    "utf8",
  ),
);
let helpEnvRoot = null;
let browserOpenTrapDir = null;
let browserOpenLogCounter = 0;
const OPERATIONS_BY_COMMAND_ID = new Map(
  OPERATION_MANIFEST.map((operation) => [
    `${operation.tagCommand}:${operation.command}`,
    operation,
  ]),
);
const OVERRIDDEN_OPERATION_IDS = new Set([
  "domains:download-domain-zone-file",
  "functions:test-function",
  "inbox:get-inbox-status",
  "search:semantic-search",
  "payments:register-payout-address",
  "payments:pay-challenge",
]);
const NODE_PLUGIN_COMMAND_ALIAS_OVERRIDES = new Map([
  ["autocomplete:create", ["create:autocomplete"]],
  ["autocomplete:script", ["script:autocomplete"]],
]);

function usage() {
  return `Usage:
  node scripts/run-cli-help-sweep.mjs --node-bin "node cli-node/bin/run.js" --rust-bin cli-rust/target/debug/primitive

Options:
  --node-bin <command>   Node CLI command. Can also use NODE_CLI.
  --rust-bin <command>   Rust CLI command. Can also use RUST_CLI.
  --concurrency <n>      Number of help commands to run in parallel. Defaults to 8.
  --compare-flags        Fail when Rust help omits a Node-visible flag token. Enabled by default.
  --no-compare-flags     Skip exact flag-token coverage checks.
  --compare-copy         Fail unless help stdout is byte-for-byte identical. Enabled by default.
  --no-compare-copy      Skip byte-for-byte stdout copy checks.
  --verbose              Print every accepted command spelling.
`;
}

function parseArgs(argv) {
  const options = {
    compareCopy: true,
    compareFlags: true,
    concurrency: DEFAULT_CONCURRENCY,
    nodeCli: process.env.NODE_CLI,
    rustCli: process.env.RUST_CLI,
    verbose: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--compare-flags") {
      options.compareFlags = true;
      continue;
    }
    if (arg === "--no-compare-flags") {
      options.compareFlags = false;
      continue;
    }
    if (arg === "--compare-copy") {
      options.compareCopy = true;
      continue;
    }
    if (arg === "--no-compare-copy") {
      options.compareCopy = false;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${arg}`);
    if (arg === "--node-cli" || arg === "--node-bin") {
      options.nodeCli = next;
    } else if (arg === "--rust-cli" || arg === "--rust-bin") {
      options.rustCli = next;
    } else if (arg === "--concurrency") {
      options.concurrency = Number.parseInt(next, 10);
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  if (!options.nodeCli || !options.rustCli) {
    throw new Error("Both --node-cli and --rust-cli are required.");
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
    throw new Error("--concurrency must be a positive integer.");
  }
  return options;
}

function shellWords(input) {
  const words = [];
  let current = "";
  let quote = null;
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        words.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (escaped) current += "\\";
  if (quote) throw new Error(`Unclosed ${quote} quote in command: ${input}`);
  if (current) words.push(current);
  if (words.length === 0) throw new Error("CLI command cannot be empty.");
  return words;
}

function loadTopics() {
  const packageJson = JSON.parse(
    readFileSync(path.join(REPO_ROOT, "cli-node/package.json"), "utf8"),
  );
  return Object.keys(packageJson.oclif?.topics ?? {});
}

function nodePluginCommands() {
  const manifest = JSON.parse(
    readFileSync(
      path.join(
        REPO_ROOT,
        "cli-node/node_modules/@oclif/plugin-autocomplete/oclif.manifest.json",
      ),
      "utf8",
    ),
  );
  return Object.values(manifest.commands ?? {}).map((command) => ({
    aliases: [
      ...(command.aliases ?? []),
      ...(NODE_PLUGIN_COMMAND_ALIAS_OVERRIDES.get(command.id) ?? []),
    ],
    args: command.args ?? {},
    flags: command.flags ?? {},
    generated: false,
    hidden: Boolean(command.hidden),
    id: command.id,
  }));
}

let commandRecordCache = null;

function commandRecords() {
  if (commandRecordCache) return commandRecordCache;
  commandRecordCache = [
    ...Object.entries(COMMANDS).map(([id, command]) => ({
      aliases: command.aliases ?? [],
      args: command.args ?? {},
      flags: command.flags ?? {},
      generated: command.name === "OperationCommand",
      hidden: Boolean(command.hidden),
      id,
    })),
    ...nodePluginCommands(),
  ];
  return commandRecordCache;
}

function commandRecordForId(commandId) {
  return commandRecords().find(
    (command) =>
      command.id === commandId || command.aliases.includes(commandId),
  );
}

function isGeneratedCommand(commandId) {
  return commandRecordForId(commandId)?.generated ?? false;
}

function addCandidate(
  candidates,
  args,
  required,
  commandId = null,
  { copyParity = "exact", snapshot = true } = {},
) {
  const key = args.join("\u0000");
  const existing = candidates.get(key);
  if (existing) {
    if (required) existing.required = true;
    if (snapshot) existing.snapshot = true;
    if (copyParity === "exact") existing.copyParity = "exact";
    if (commandId && !existing.commandId) {
      existing.commandId = commandId;
      existing.generated = isGeneratedCommand(commandId);
    }
    return;
  }

  candidates.set(key, {
    args,
    commandId,
    generated: commandId ? isGeneratedCommand(commandId) : false,
    copyParity,
    required,
    snapshot,
  });
}

function commandSpellings(commandId) {
  const spellings = [[commandId]];
  if (commandId.includes(":")) {
    spellings.push(commandId.split(":"));
  }
  return spellings;
}

function addHelpCandidates(candidates, commandId, required) {
  for (const spelling of commandSpellings(commandId)) {
    const canonicalSpelling =
      spelling.length === 1 && spelling[0] === commandId;
    const requiredSpelling = required && canonicalSpelling;
    addCandidate(
      candidates,
      [...spelling, "--help"],
      requiredSpelling,
      commandId,
    );
    addCandidate(
      candidates,
      ["help", ...spelling],
      requiredSpelling,
      commandId,
    );
    addCandidate(candidates, ["--help", ...spelling], false, commandId);
  }
}

function addTopicCandidates(candidates, topicId, commandIds) {
  if (!commandIds.has(topicId)) {
    addCandidate(candidates, [topicId], false);
  }
  addCandidate(candidates, [topicId, "--help"], false);
  addCandidate(candidates, [topicId, "-h"], false);
  addCandidate(candidates, ["help", topicId], false);
  addCandidate(candidates, ["--help", topicId], false);
  if (topicId.includes(":")) {
    const splitTopic = topicId.split(":");
    if (!commandIds.has(topicId)) {
      addCandidate(candidates, splitTopic, false);
    }
    addCandidate(candidates, [...splitTopic, "--help"], false);
    addCandidate(candidates, [...splitTopic, "-h"], false);
    addCandidate(candidates, ["help", ...splitTopic], false);
    addCandidate(candidates, ["--help", ...splitTopic], false);
  }
}

function commandIdsWithAliases() {
  const commandIds = new Set();
  for (const command of commandRecords()) {
    commandIds.add(command.id);
    for (const alias of command.aliases ?? []) {
      commandIds.add(alias);
    }
  }
  return commandIds;
}

function takesValue(flag) {
  return flag?.type !== "boolean" && flag?.allowNo !== true;
}

function visibleValueFlagEntries(record) {
  return Object.entries(record.flags ?? {}).filter(
    ([, flag]) => !flag.hidden && takesValue(flag),
  );
}

function sampleValue(name, spec = {}) {
  const normalized = flagName(name);
  const options = Array.isArray(spec.options) ? spec.options : [];
  if (options.includes("bash")) return "bash";
  if (options.length > 0) return String(options[0]);
  if (normalized === "api-key") return "prim_test";
  if (normalized === "command") return "send";
  if (normalized === "shell") return "bash";
  if (normalized === "pattern") return "b@example.com";
  if (["email", "from", "recipient", "to"].includes(normalized)) {
    return "user@example.com";
  }
  if (normalized.includes("email")) return "user@example.com";
  if (normalized === "id" || normalized.endsWith("-id")) return "fn_123";
  if (
    ["limit", "number", "page-size", "priority", "timeout", "wait"].includes(
      normalized,
    ) ||
    normalized.endsWith("-seconds") ||
    normalized.endsWith("-ms")
  ) {
    return "1";
  }
  if (
    ["date-from", "date-to", "expires-at", "since"].includes(normalized) ||
    normalized.endsWith("-at")
  ) {
    return "2026-01-01T00:00:00Z";
  }
  if (["file", "path", "output", "root"].includes(normalized)) {
    return "help-sweep.tmp";
  }
  if (
    ["body", "message", "query", "q", "search", "subject", "value"].includes(
      normalized,
    )
  ) {
    return "hello";
  }
  if (normalized === "code" || normalized.endsWith("code")) return "123456";
  if (normalized === "key") return "help-key";
  if (normalized === "name") return "help-name";
  return "value";
}

function positionalEntries(record) {
  const entries = Object.entries(record.args ?? {});
  const required = entries.filter(([, arg]) => arg.required);
  if (required.length > 0) return required;
  return entries.slice(0, 1);
}

function addValueFlagHelpCandidates(candidates, commandId, record) {
  for (const [flag, spec] of visibleValueFlagEntries(record)) {
    for (const spelling of commandSpellings(commandId)) {
      for (const token of visibleFlagTokens(flag, spec)) {
        addCandidate(
          candidates,
          [...spelling, token, sampleValue(flag, spec), "--help"],
          false,
          commandId,
        );
      }
    }
  }
}

function visibleBooleanFlagEntries(record) {
  return Object.entries(record.flags ?? {}).filter(
    ([, flag]) => !flag.hidden && !takesValue(flag),
  );
}

function visibleFlagTokens(name, spec = {}) {
  const tokens = new Set([`--${flagName(name)}`]);
  if (typeof spec.char === "string" && spec.char.length > 0) {
    tokens.add(`-${spec.char}`);
  }
  for (const alias of spec.aliases ?? []) {
    tokens.add(`--${flagName(alias)}`);
  }
  return [...tokens];
}

function addBooleanFlagHelpCandidates(candidates, commandId, record) {
  for (const [flag, spec] of visibleBooleanFlagEntries(record)) {
    for (const spelling of commandSpellings(commandId)) {
      for (const token of visibleFlagTokens(flag, spec)) {
        addCandidate(
          candidates,
          [...spelling, token, "--help"],
          false,
          commandId,
        );
      }
      if (spec.allowNo === true) {
        addCandidate(
          candidates,
          [...spelling, `--no-${flagName(flag)}`, "--help"],
          false,
          commandId,
        );
      }
    }
  }
}

function addPositionalHelpCandidates(candidates, commandId, record) {
  const positionals = positionalEntries(record);
  if (positionals.length === 0) return;
  const values = positionals.map(([name, spec]) => sampleValue(name, spec));
  for (const spelling of commandSpellings(commandId)) {
    addCandidate(
      candidates,
      [...spelling, ...values, "--help"],
      false,
      commandId,
    );
  }
}

function addCommandSyntaxCandidates(candidates, commandId) {
  const record = commandRecordForId(commandId);
  if (!record) return;
  addValueFlagHelpCandidates(candidates, commandId, record);
  addBooleanFlagHelpCandidates(candidates, commandId, record);
  addPositionalHelpCandidates(candidates, commandId, record);
}

function inferredTopicIds(commandIds) {
  const topics = new Set(loadTopics());
  for (const commandId of commandIds) {
    const parts = commandId.split(":");
    for (let length = 1; length < parts.length; length += 1) {
      topics.add(parts.slice(0, length).join(":"));
    }
  }
  return topics;
}

function buildCandidates() {
  const candidates = new Map();
  const commandIds = commandIdsWithAliases();

  addCandidate(candidates, [], true, null, { snapshot: false });
  addCandidate(candidates, ["--help"], true);
  addCandidate(candidates, ["help"], true);
  addCandidate(candidates, ["help", "--help"], true);

  for (const commandId of [...commandIds].sort()) {
    addHelpCandidates(candidates, commandId, true);
    addCommandSyntaxCandidates(candidates, commandId);
  }

  addCandidate(
    candidates,
    ["autocomplete", "bash", "--help"],
    true,
    "autocomplete",
  );

  for (const topicId of [...inferredTopicIds(commandIds)].sort()) {
    addTopicCandidates(candidates, topicId, commandIds);
  }

  return [...candidates.values()];
}

function helpEnvRootPath() {
  if (!helpEnvRoot) {
    helpEnvRoot = mkdtempSync(path.join(tmpdir(), "primitive-cli-help-sweep-"));
  }
  return helpEnvRoot;
}

function browserOpenTrapDirPath() {
  if (browserOpenTrapDir) return browserOpenTrapDir;
  const trapDir = path.join(helpEnvRootPath(), "browser-open-trap");
  mkdirSync(trapDir, { recursive: true });
  const trapScript = [
    "#!/bin/sh",
    "{",
    "  printf '%s' \"$0\"",
    '  for arg in "$@"; do',
    "    printf ' %s' \"$arg\"",
    "  done",
    "  printf '\\n'",
    '} >> "$' + '{PRIMITIVE_BROWSER_OPEN_TRAP_LOG:-/dev/null}"',
    "exit 0",
    "",
  ].join("\n");
  for (const command of ["open", "xdg-open"]) {
    const target = path.join(trapDir, command);
    writeFileSync(target, trapScript);
    chmodSync(target, 0o755);
  }
  browserOpenTrapDir = trapDir;
  return trapDir;
}

function readBrowserOpenLog(logPath) {
  if (!existsSync(logPath)) return "";
  return readFileSync(logPath, "utf8");
}

function prependPathEntry(env, entry) {
  const pathKeys = Object.keys(env).filter(
    (key) => key.toLowerCase() === "path",
  );
  const pathKey = pathKeys[0] ?? "PATH";
  const currentPath = pathKeys.map((key) => env[key]).find(Boolean) ?? "";
  const next = { ...env };
  for (const key of pathKeys) {
    if (key !== pathKey) delete next[key];
  }
  next[pathKey] = `${entry}${path.delimiter}${currentPath}`;
  return next;
}

function helpEnv() {
  const emptyConfigRoot = helpEnvRootPath();
  const browserOpenLog = path.join(
    emptyConfigRoot,
    `browser-open-${process.pid}-${browserOpenLogCounter}.log`,
  );
  browserOpenLogCounter += 1;
  return prependPathEntry(
    {
      ...process.env,
      HOME: path.join(emptyConfigRoot, "home"),
      PRIMITIVE_API_KEY: "",
      PRIMITIVE_BROWSER_OPEN_DIRECT_TRAP: "1",
      PRIMITIVE_BROWSER_OPEN_TRAP_LOG: browserOpenLog,
      PRIMITIVE_CONFIG_DIR: path.join(emptyConfigRoot, "primitive"),
      PRIMITIVE_HIDE_SIGNUP_HINT: "1",
      PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
      XDG_CONFIG_HOME: path.join(emptyConfigRoot, "xdg"),
    },
    browserOpenTrapDirPath(),
  );
}

function cleanupHelpEnvRoot() {
  if (!helpEnvRoot) return;
  rmSync(helpEnvRoot, { force: true, recursive: true });
  helpEnvRoot = null;
  browserOpenTrapDir = null;
}

process.once("exit", cleanupHelpEnvRoot);

function runProcess(cli, args, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const [command, ...baseArgs] = cli;
  return new Promise((resolve) => {
    const env = helpEnv();
    const child = spawn(command, [...baseArgs, ...args], {
      cwd: REPO_ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      resolve({
        browserOpenLog: readBrowserOpenLog(env.PRIMITIVE_BROWSER_OPEN_TRAP_LOG),
        exitCode: 127,
        stderr: `${stderr}${error.message}\n`,
        stdout,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        browserOpenLog: readBrowserOpenLog(env.PRIMITIVE_BROWSER_OPEN_TRAP_LOG),
        exitCode: signal ? 128 : (code ?? 0),
        signal,
        stderr,
        timedOut,
        timeoutMs,
        stdout,
      });
    });
  });
}

function formatResult(result) {
  const stdout = result.stdout.trim();
  const stderr = result.stderr.trim();
  const browserOpenLog = result.browserOpenLog?.trim();
  return [
    `exit: ${result.exitCode}${result.signal ? `, signal: ${result.signal}` : ""}`,
    result.timedOut ? `timed out after ${result.timeoutMs}ms` : "",
    browserOpenLog ? `browser open attempts:\n${browserOpenLog}` : "",
    stdout ? `stdout:\n${stdout}` : "stdout: <empty>",
    stderr ? `stderr:\n${stderr}` : "stderr: <empty>",
  ]
    .filter(Boolean)
    .join("\n");
}

async function runHelpProcess(cli, args) {
  const first = await runProcess(cli, args);
  if (!first.timedOut) return first;
  return runProcess(cli, args, RETRY_TIMEOUT_MS);
}

function helpSectionHeading(line) {
  const normalized = line.trim().replace(/:$/, "").toUpperCase();
  return HELP_SECTION_HEADINGS.has(normalized) ? normalized : null;
}

function addFlagTokensFromText(tokens, text) {
  for (const match of text.matchAll(
    /--(?:\[no-\])?[A-Za-z0-9][A-Za-z0-9-]*/g,
  )) {
    const token = match[0];
    if (token.startsWith("--[no-]")) {
      const positive = token.slice("--[no-]".length);
      tokens.add(`--${positive}`);
      tokens.add(`--no-${positive}`);
    } else {
      tokens.add(token);
    }
  }
  for (const match of text.matchAll(
    /(^|[\s,[({])(-[A-Za-z])(?=$|[\s,\])}=<])/g,
  )) {
    tokens.add(match[2]);
  }
}

function flagDeclarationSegment(line) {
  const trimmed = line.trimStart();
  if (!trimmed.startsWith("-")) return "";
  const descriptionIndex = trimmed.search(/\s{2,}/);
  const segment =
    descriptionIndex === -1 ? trimmed : trimmed.slice(0, descriptionIndex);
  const normalized = segment.replace(/\s+required$/, "");
  const flagPart =
    /(?:-[A-Za-z]|--(?:\[no-\])?[A-Za-z0-9][A-Za-z0-9-]*)(?:[ =](?:<[^>]+>|\[[^\]]+\]|[A-Za-z0-9_.:|/-]+))?/;
  const declaration = new RegExp(
    `^${flagPart.source}(?:,\\s*${flagPart.source})*$`,
  );
  return declaration.test(normalized) ? normalized : "";
}

function helpFlagTokens(output) {
  const tokens = new Set();
  let section = null;
  let foundFlagSection = false;

  for (const line of output.split(/\r?\n/)) {
    const heading = helpSectionHeading(line);
    if (heading) {
      section = heading;
      continue;
    }
    if (!HELP_FLAG_TOKEN_SECTION_HEADINGS.has(section)) continue;
    foundFlagSection = true;

    if (section === "USAGE") {
      addFlagTokensFromText(tokens, line);
      continue;
    }

    const segment = flagDeclarationSegment(line);
    if (!segment) continue;
    addFlagTokensFromText(tokens, segment);
  }

  if (!foundFlagSection) {
    for (const line of output.split(/\r?\n/)) {
      const segment = flagDeclarationSegment(line);
      if (!segment) continue;
      addFlagTokensFromText(tokens, segment);
    }
  }

  return tokens;
}

function sortedFlagTokens(tokens) {
  return [...tokens].sort((left, right) => left.localeCompare(right));
}

function matchesFlagTokenAllowlistEntry(candidate, entry) {
  if (entry.commandId && entry.commandId !== candidate.commandId) return false;
  if (
    entry.args &&
    entry.args.join("\u0000") !== candidate.args.join("\u0000")
  ) {
    return false;
  }
  return Boolean(entry.commandId || entry.args);
}

function allowedMissingRustFlagTokens(candidate) {
  const allowed = new Set();
  for (const entry of RUST_MISSING_NODE_FLAG_TOKEN_ALLOWLIST) {
    if (!matchesFlagTokenAllowlistEntry(candidate, entry)) continue;
    for (const flag of entry.flags) {
      allowed.add(flag);
    }
  }
  return allowed;
}

function allowedExtraRustFlagTokens(candidate) {
  const allowed = new Set();
  for (const entry of RUST_EXTRA_NODE_FLAG_TOKEN_ALLOWLIST) {
    if (!matchesFlagTokenAllowlistEntry(candidate, entry)) continue;
    for (const flag of entry.flags) {
      allowed.add(flag);
    }
  }
  return allowed;
}

function flagName(name) {
  return name.replaceAll("_", "-").toLowerCase();
}

function bodyScalarType(schema) {
  const rawType = schema?.type;
  if (["string", "integer", "number", "boolean"].includes(rawType)) {
    return rawType;
  }
  if (Array.isArray(rawType)) {
    const nonNull = rawType.filter((item) => item !== "null");
    if (
      nonNull.length === 1 &&
      ["string", "integer", "number", "boolean"].includes(nonNull[0])
    ) {
      return nonNull[0];
    }
  }
  return null;
}

function requestBodyProperties(operation) {
  const properties = operation.requestSchema?.properties;
  if (
    !properties ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return [];
  }

  const occupied = new Set([
    "api-key",
    "api-base-url",
    "time",
    ...(operation.binaryResponse ? [] : ["json"]),
    "raw-body",
    "body-file",
    "envelope",
    "output",
  ]);
  for (const parameter of [
    ...(operation.pathParams ?? []),
    ...(operation.queryParams ?? []),
    ...(operation.headerParams ?? []),
  ]) {
    occupied.add(flagName(parameter.name));
  }

  const result = [];
  for (const [property, schema] of Object.entries(properties)) {
    const name = flagName(property);
    if (occupied.has(name) || !bodyScalarType(schema)) continue;
    occupied.add(name);
    result.push(property);
  }
  return result;
}

function generatedOperationId(candidate) {
  if (!candidate.generated || !candidate.commandId) return null;
  const operationId =
    CANONICAL_OPERATION_ALIASES[candidate.commandId] ?? candidate.commandId;
  if (OVERRIDDEN_OPERATION_IDS.has(operationId)) return null;
  if (!OPERATIONS_BY_COMMAND_ID.has(operationId)) return null;
  return operationId;
}

function expectedGeneratedManifestFlags(candidate) {
  const operationId = generatedOperationId(candidate);
  if (!operationId) return [];
  const operation = OPERATIONS_BY_COMMAND_ID.get(operationId);

  const flags = ["--api-key", "--time"];
  if (operation.binaryResponse) {
    flags.push("--output");
  } else {
    flags.push("--json", "--envelope");
  }
  for (const parameter of [
    ...(operation.pathParams ?? []),
    ...(operation.queryParams ?? []),
    ...(operation.headerParams ?? []),
  ]) {
    flags.push(`--${flagName(parameter.name)}`);
  }
  if (operation.hasJsonBody) {
    flags.push("--raw-body", "--body-file");
    for (const property of requestBodyProperties(operation)) {
      flags.push(`--${flagName(property)}`);
    }
  }
  return [...new Set(flags)].sort();
}

function expectedVisibleFlags(candidate) {
  const flags = [];
  if (candidate.commandId === "config:list") {
    flags.push("--json", "--show-secrets");
  }
  if (candidate.commandId === "config:reset") {
    flags.push("--environment");
  }
  return flags;
}

function assertHelpFlagParity(candidate, nodeResult, rustResult) {
  const label = candidate.args.join(" ");
  const nodeFlags = helpFlagTokens(nodeResult.stdout);
  const rustFlags = helpFlagTokens(rustResult.stdout);

  for (const flag of expectedVisibleFlags(candidate)) {
    if (nodeFlags.has(flag) && !rustFlags.has(flag)) {
      throw new Error(
        `Rust CLI help is missing Node-visible flag ${flag} for ${label}\n${formatResult(rustResult)}`,
      );
    }
  }

  const generatedFlags = expectedGeneratedManifestFlags(candidate);
  const missingNodeFlags = generatedFlags.filter(
    (flag) => !nodeFlags.has(flag),
  );
  const missingRustFlags = generatedFlags.filter(
    (flag) => !rustFlags.has(flag),
  );
  if (missingNodeFlags.length > 0 || missingRustFlags.length > 0) {
    const messages = [];
    if (missingNodeFlags.length > 0) {
      messages.push(
        `Node CLI generated help is missing manifest-required flag(s) ${missingNodeFlags.join(", ")} for ${label}`,
      );
    }
    if (missingRustFlags.length > 0) {
      messages.push(
        `Rust CLI generated help is missing manifest-required flag(s) ${missingRustFlags.join(", ")} for ${label}`,
      );
    }
    throw new Error(
      `${messages.join("\n")}\n\nNode ${formatResult(nodeResult)}\n\nRust ${formatResult(rustResult)}`,
    );
  }

  if (!generatedOperationId(candidate)) return;
  const exposedHidden = [];
  if (nodeFlags.has("--api-base-url")) exposedHidden.push("Node");
  if (rustFlags.has("--api-base-url")) exposedHidden.push("Rust");
  if (exposedHidden.length > 0) {
    throw new Error(
      `${exposedHidden.join(" and ")} CLI generated help exposes hidden flag --api-base-url for ${label}`,
    );
  }
}

function assertNodeVisibleFlagCoverage(candidate, nodeResult, rustResult) {
  const nodeFlags = helpFlagTokens(nodeResult.stdout);
  const rustFlags = helpFlagTokens(rustResult.stdout);
  const allowedMissing = allowedMissingRustFlagTokens(candidate);
  const missing = sortedFlagTokens(
    new Set(
      [...nodeFlags].filter(
        (flag) => !rustFlags.has(flag) && !allowedMissing.has(flag),
      ),
    ),
  );

  if (missing.length === 0) return;

  const label = candidate.args.join(" ");
  const allowed = sortedFlagTokens(
    new Set([...nodeFlags].filter((flag) => allowedMissing.has(flag))),
  );
  const allowedText =
    allowed.length > 0
      ? `Allowlisted missing Rust flag token(s): ${allowed.join(", ")}`
      : "";
  throw new Error(
    [
      `Rust CLI help is missing Node-visible flag token(s) for ${label}: ${missing.join(", ")}`,
      `Node flag tokens: ${sortedFlagTokens(nodeFlags).join(", ") || "<none>"}`,
      `Rust flag tokens: ${sortedFlagTokens(rustFlags).join(", ") || "<none>"}`,
      allowedText,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function assertNoExtraRustVisibleFlags(candidate, nodeResult, rustResult) {
  const nodeFlags = helpFlagTokens(nodeResult.stdout);
  const rustFlags = helpFlagTokens(rustResult.stdout);
  const allowedExtra = allowedExtraRustFlagTokens(candidate);
  const extra = sortedFlagTokens(
    new Set(
      [...rustFlags].filter(
        (flag) => !nodeFlags.has(flag) && !allowedExtra.has(flag),
      ),
    ),
  );

  if (extra.length === 0) return;

  const label = candidate.args.join(" ");
  const allowed = sortedFlagTokens(
    new Set([...rustFlags].filter((flag) => allowedExtra.has(flag))),
  );
  const allowedText =
    allowed.length > 0
      ? `Allowlisted extra Rust flag token(s): ${allowed.join(", ")}`
      : "";
  throw new Error(
    [
      `Rust CLI help exposes extra flag token(s) for ${label}: ${extra.join(", ")}`,
      `Node flag tokens: ${sortedFlagTokens(nodeFlags).join(", ") || "<none>"}`,
      `Rust flag tokens: ${sortedFlagTokens(rustFlags).join(", ") || "<none>"}`,
      allowedText,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

function normalizedHelpCopy(output) {
  return output.replace(/\s+/g, " ").trim();
}

function assertGeneratedHelpCopyParity(candidate, nodeResult, rustResult) {
  if (!generatedOperationId(candidate)) return;

  const nodeCopy = normalizedHelpCopy(nodeResult.stdout);
  const rustCopy = normalizedHelpCopy(rustResult.stdout);
  if (nodeCopy === rustCopy) return;

  const label = candidate.args.join(" ");
  throw new Error(
    [
      `Rust generated help copy diverges from Node for ${label}`,
      `Node normalized help: ${nodeCopy}`,
      `Rust normalized help: ${rustCopy}`,
    ].join("\n"),
  );
}

function firstDifference(left, right) {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : length;
}

function excerptAround(value, offset) {
  if (offset < 0) return "";
  const start = Math.max(0, offset - 80);
  const end = Math.min(value.length, offset + 80);
  return JSON.stringify(value.slice(start, end));
}

function rootHelpRuntimeNormalizedCopy(candidate, output) {
  if (!isRootHelpCandidate(candidate)) return output;
  return output.replace(
    /^ {2}primitive(?:-rust)?\/[0-9][^\s\n]*(?: [^\n]+)?\n/m,
    "  primitive/<runtime-version>\n",
  );
}

function isRootHelpCandidate(candidate) {
  const key = candidate.args.join("\u0000");
  return (
    key === "" ||
    key === "--help" ||
    key === "help" ||
    key === "help\u0000--help"
  );
}

function assertExactHelpCopyParity(candidate, nodeResult, rustResult) {
  assertRootHelpVersionLine(candidate, nodeResult.stdout, "Node");
  assertRootHelpVersionLine(candidate, rustResult.stdout, "Rust");
  const nodeStdout = rootHelpRuntimeNormalizedCopy(
    candidate,
    nodeResult.stdout,
  );
  const rustStdout = rootHelpRuntimeNormalizedCopy(
    candidate,
    rustResult.stdout,
  );
  if (nodeStdout === rustStdout) return;

  const label = candidate.args.join(" ") || "<root>";
  const offset = firstDifference(nodeStdout, rustStdout);
  throw new Error(
    [
      `Rust help stdout diverges byte-for-byte from Node for ${label}`,
      `firstDifferentByte: ${offset}`,
      `Node excerpt: ${excerptAround(nodeStdout, offset)}`,
      `Rust excerpt: ${excerptAround(rustStdout, offset)}`,
    ].join("\n"),
  );
}

function assertSemanticHelpCopyParity(candidate, nodeResult, rustResult) {
  assertRootHelpVersionLine(candidate, nodeResult.stdout, "Node");
  assertRootHelpVersionLine(candidate, rustResult.stdout, "Rust");
  const nodeCopy = normalizedHelpCopy(
    rootHelpRuntimeNormalizedCopy(candidate, nodeResult.stdout),
  );
  const rustCopy = normalizedHelpCopy(
    rootHelpRuntimeNormalizedCopy(candidate, rustResult.stdout),
  );
  if (nodeCopy === rustCopy) return;

  const label = candidate.args.join(" ") || "<root>";
  throw new Error(
    [
      `Rust help stdout diverges semantically from Node for ${label}`,
      `Node normalized help: ${nodeCopy}`,
      `Rust normalized help: ${rustCopy}`,
    ].join("\n"),
  );
}

function assertRootHelpVersionLine(candidate, stdout, runnerName) {
  if (!isRootHelpCandidate(candidate)) return;
  const match = stdout.match(/^VERSION\n {2}([^\n]+)\n/m);
  const label = candidate.args.join(" ") || "<root>";
  if (!match) {
    throw new Error(`${runnerName} root help is missing VERSION line for ${label}`);
  }
  const versionLine = match[1];
  const valid =
    runnerName === "Node"
      ? /^primitive\/[0-9][^\s\n]* [^\s\n]+ node-v[0-9][^\s\n]*$/.test(versionLine)
      : /^primitive(?:-rust)?\/[0-9][^\s\n]*$/.test(versionLine);
  if (!valid) {
    throw new Error(
      `${runnerName} root help VERSION line has unexpected shape for ${label}: ${JSON.stringify(versionLine)}`,
    );
  }
}

function assertNoHelpStderr(candidate, runnerName, result) {
  if (result.stderr === "") return;
  const label = candidate.args.join(" ") || "<root>";
  throw new Error(
    `${runnerName} CLI wrote stderr for accepted help command ${label}\n${formatResult(result)}`,
  );
}

function assertExpectedSkippedOptionalHelp(results) {
  const actual = new Set(
    results
      .filter((result) => !result.checked)
      .map((result) => result.label)
      .sort(),
  );
  const missing = [...EXPECTED_NODE_REJECTED_OPTIONAL_HELP_LABELS].filter(
    (label) => !actual.has(label),
  );
  const extra = [...actual].filter(
    (label) => !EXPECTED_NODE_REJECTED_OPTIONAL_HELP_LABELS.has(label),
  );
  if (missing.length === 0 && extra.length === 0) return;
  throw new Error(
    [
      "Node-rejected optional help spelling set changed.",
      missing.length ? `Missing expected skip(s): ${missing.join(", ")}` : "",
      extra.length ? `Unexpected skip(s): ${extra.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

async function runPool(items, concurrency, worker) {
  let index = 0;
  const results = [];
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        results[currentIndex] = await worker(items[currentIndex]);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const nodeCli = shellWords(options.nodeCli);
  const rustCli = shellWords(options.rustCli);
  const candidates = buildCandidates();

  const results = await runPool(
    candidates,
    options.concurrency,
    async (candidate) => {
      const label = candidate.args.join(" ") || "<root>";
      const nodeResult = await runHelpProcess(nodeCli, candidate.args);
      if (nodeResult.browserOpenLog) {
        throw new Error(
          `Node CLI attempted to open a browser during help sweep: ${label}\n${formatResult(nodeResult)}`,
        );
      }
      if (nodeResult.exitCode !== 0) {
        if (candidate.required) {
          throw new Error(
            `Node CLI rejected exported command help: ${label}\n${formatResult(nodeResult)}`,
          );
        }
        const rustResult = await runHelpProcess(rustCli, candidate.args);
        if (rustResult.browserOpenLog) {
          throw new Error(
            `Rust CLI attempted to open a browser while checking Node-rejected help command: ${label}\n${formatResult(rustResult)}`,
          );
        }
        if (rustResult.exitCode === 0) {
          throw new Error(
            `Rust CLI accepted Node-rejected optional help command: ${label}\n\nNode ${formatResult(nodeResult)}\n\nRust ${formatResult(rustResult)}`,
          );
        }
        return { checked: false, label };
      }
      assertNoHelpStderr(candidate, "Node", nodeResult);

      const rustResult = await runHelpProcess(rustCli, candidate.args);
      if (rustResult.browserOpenLog) {
        throw new Error(
          `Rust CLI attempted to open a browser during help sweep: ${label}\n${formatResult(rustResult)}`,
        );
      }
      if (rustResult.exitCode !== 0) {
        throw new Error(
          `Rust CLI rejected Node-accepted help command: ${label}\n${formatResult(rustResult)}`,
        );
      }
      if (!rustResult.stdout.trim()) {
        throw new Error(`Rust CLI printed empty help for ${label}`);
      }
      assertNoHelpStderr(candidate, "Rust", rustResult);
      assertHelpFlagParity(candidate, nodeResult, rustResult);
      if (options.compareFlags) {
        assertNodeVisibleFlagCoverage(candidate, nodeResult, rustResult);
        assertNoExtraRustVisibleFlags(candidate, nodeResult, rustResult);
      }
      assertGeneratedHelpCopyParity(candidate, nodeResult, rustResult);
      if (options.compareCopy) {
        if (candidate.copyParity === "semantic") {
          assertSemanticHelpCopyParity(candidate, nodeResult, rustResult);
        } else {
          assertExactHelpCopyParity(candidate, nodeResult, rustResult);
        }
      }
      if (options.verbose) process.stdout.write(`+ ${label}\n`);
      return { checked: true, label };
    },
  );

  const checked = results.filter((result) => result.checked).length;
  const skipped = results.length - checked;
  assertExpectedSkippedOptionalHelp(results);
  process.stdout.write(
    `CLI help sweep OK: ${checked} Node-accepted command spelling(s) checked, ${skipped} Node-rejected optional spelling(s) skipped.\n`,
  );
}

export { buildCandidates, formatResult, runHelpProcess, runPool, shellWords };

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
