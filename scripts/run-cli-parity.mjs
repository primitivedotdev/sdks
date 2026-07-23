#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_CASES = path.join(
  REPO_ROOT,
  "test-fixtures/cli-parity/cases.json",
);
const DEFAULT_TIMEOUT_MS = 20_000;
const TEST_PRIVATE_KEY = [
  "0xac0974bec39a17e3",
  "6ba4a6b4d238ff94",
  "4bacb478cbed5efc",
  "ae784d7bf4f2ff80",
].join("");
const WINDOWS_NODE_UV_HANDLE_CLOSING_EXIT_CODE = 3_221_226_505;
const WINDOWS_NODE_UV_HANDLE_CLOSING_ASSERTION =
  /\r?\n?Assertion failed: !\(handle->flags & UV_HANDLE_CLOSING\), file src\\win\\async\.c, line 94\r?\n(?:\r?\n)*/;
const OCLIF_AUTOCOMPLETE_PLUGIN_WARNING =
  /\(node:\d+\) Error Plugin: primitive: could not find package\.json with \{\n  name: '@oclif\/plugin-autocomplete',\n  root: '.*?cli-node',\n  type: 'core'\n\}\nmodule: @oclif\/core@[^\n]+\nplugin: primitive\nroot: .*?cli-node\nSee more details with DEBUG=\*\n\(Use `node --trace-warnings \.\.\.` to show where the warning was created\)\n/g;

function installBrowserOpenTrap(root) {
  const trapDir = path.join(root, "browser-open-trap");
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
  return trapDir;
}

function readBrowserOpenLog(logPath) {
  if (!logPath || !existsSync(logPath)) return "";
  return readFileSync(logPath, "utf8");
}

function readAuthEventLog(logPath) {
  if (!logPath || !existsSync(logPath)) return "";
  return readFileSync(logPath, "utf8");
}

async function waitForBrowserOpenLog(logPath, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const log = readBrowserOpenLog(logPath);
    if (log !== "") return log;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return readBrowserOpenLog(logPath);
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

function usage() {
  return `Usage:
  node scripts/run-cli-parity.mjs --node-bin "node cli-node/bin/run.js" --rust-bin "cargo run --quiet --manifest-path cli-rust/Cargo.toml --bin primitive --"

Options:
  --cases <path>       Fixture file. Defaults to test-fixtures/cli-parity/cases.json
  --case <name>        Run one case by name. Repeatable.
  --node-bin <command> Node CLI command. Can also use NODE_CLI.
  --rust-bin <command> Rust CLI command. Can also use RUST_CLI.
  --keep-tmp           Keep temporary case directories.
  --verbose            Print child command lines and mock server URLs.
`;
}

function parseArgs(argv) {
  const options = {
    casesPath: DEFAULT_CASES,
    keepTmp: false,
    names: [],
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
    if (arg === "--keep-tmp") {
      options.keepTmp = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${arg}`);
    if (arg === "--cases") {
      options.casesPath = path.resolve(next);
    } else if (arg === "--case") {
      options.names.push(next);
    } else if (arg === "--node-cli" || arg === "--node-bin") {
      options.nodeCli = next;
    } else if (arg === "--rust-cli" || arg === "--rust-bin") {
      options.rustCli = next;
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  if (!options.nodeCli || !options.rustCli) {
    throw new Error("Both --node-cli and --rust-cli are required.");
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

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_.-]+/g, "_");
}

function asJsonValue(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function deepSort(value) {
  if (Array.isArray(value)) return value.map(deepSort);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, deepSort(item)]),
  );
}

function normalizeScalarString(value) {
  return value.replace(/\r\n/g, "\n");
}

const MASKED_PATH_PATTERN =
  /__(?:CASE_TMP|CONFIG_DIR|REPO_ROOT)__(?:[\\/]+[^\s"'`<>]+)+/g;

function normalizeMaskedPathSeparators(value) {
  return value.replace(MASKED_PATH_PATTERN, (match) =>
    match.replace(/[\\/]+/g, "/"),
  );
}

function normalizeComparableStrings(value, normalizers) {
  if (typeof value === "string") {
    return normalizeMaskedPathSeparators(applyMasks(value, normalizers));
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeComparableStrings(item, normalizers));
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      normalizeMaskedPathSeparators(applyMasks(key, normalizers)),
      normalizeComparableStrings(item, normalizers),
    ]),
  );
}

function tryParseJsonString(value) {
  const trimmed = value.trim();
  if (!trimmed) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false };
  }
}

function renderComparableStream(value, normalizers) {
  const masked = applyMasks(normalizeScalarString(value), normalizers);
  const parsed = tryParseJsonString(masked);
  if (parsed.ok) {
    return asJsonValue(
      deepSort(normalizeComparableStrings(parsed.value, normalizers)),
    );
  }
  return normalizeMaskedPathSeparators(masked);
}

function renderComparableFragment(value, normalizers) {
  return normalizeMaskedPathSeparators(
    applyMasks(normalizeScalarString(value), normalizers),
  );
}

function applyMasks(value, normalizers) {
  let result = value;
  for (const [from, to] of normalizers.literalMasks) {
    result = result.split(from).join(to);
  }
  for (const mask of normalizers.regexMasks) {
    result = result.replace(mask.regex, mask.replacement);
  }
  return result;
}

function expand(value, context) {
  if (typeof value === "string") {
    return value
      .split("__BASE_URL__")
      .join(context.baseUrl)
      .split("__BASE_ORIGIN__")
      .join(context.baseOrigin)
      .split("__CASE_TMP__")
      .join(context.caseTmp)
      .split("__CONFIG_DIR__")
      .join(context.configDir)
      .split("__REPO_ROOT__")
      .join(REPO_ROOT)
      .split("__TEST_PRIVATE_KEY__")
      .join(context.testPrivateKey);
  }
  if (Array.isArray(value)) return value.map((item) => expand(item, context));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, expand(item, context)]),
  );
}

function queryObject(searchParams) {
  const result = {};
  for (const [key, value] of searchParams) {
    if (Object.hasOwn(result, key)) {
      const current = result[key];
      result[key] = Array.isArray(current)
        ? [...current, value]
        : [current, value];
    } else {
      result[key] = value;
    }
  }
  return deepSort(result);
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const raw = buffer.toString("utf8");
  if (buffer.length === 0) return { base64: "", raw: "", json: undefined };
  try {
    return { base64: buffer.toString("base64"), raw, json: JSON.parse(raw) };
  } catch {
    return { base64: buffer.toString("base64"), raw, json: undefined };
  }
}

function responseBody(response) {
  if (response.bodyBase64 !== undefined)
    return Buffer.from(response.bodyBase64, "base64");
  if (response.bodyJson !== undefined) return JSON.stringify(response.bodyJson);
  if (response.body !== undefined) return String(response.body);
  return JSON.stringify(response.json ?? { data: null });
}

async function startMockServer(caseName, exchanges, context) {
  const requests = [];
  const server = http.createServer(async (request, response) => {
    const index = requests.length;
    const exchange = expand(exchanges[index], context);
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const body = await readBody(request);
    requests.push({
      body: body.json === undefined ? body.raw : body.json,
      bodyBase64: body.base64,
      headers: Object.fromEntries(
        Object.entries(request.headers).map(([key, value]) => [
          key.toLowerCase(),
          Array.isArray(value) ? value.join(", ") : (value ?? ""),
        ]),
      ),
      method: request.method,
      path: url.pathname,
      query: queryObject(url.searchParams),
    });

    if (!exchange) {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            code: "unexpected_request",
            message: `No mock exchange ${index} for ${caseName}`,
          },
        }),
      );
      return;
    }

    const mockResponse = exchange.response ?? {};
    response.writeHead(mockResponse.status ?? 200, {
      "content-type": "application/json",
      ...(mockResponse.headers ?? {}),
    });
    response.end(responseBody(mockResponse));
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  context.baseOrigin = origin;
  context.baseUrl = `${origin}/v1`;
  return {
    baseOrigin: origin,
    baseUrl: `${origin}/v1`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    requests,
  };
}

function timeoutSignal(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, timeout };
}

function decodeStreamBuffer(buffer) {
  const text = buffer.toString("utf8");
  return {
    base64: buffer.toString("base64"),
    text,
    validUtf8: Buffer.compare(Buffer.from(text, "utf8"), buffer) === 0,
  };
}

async function runProcess(command, args, env, cwd, stdin, timeoutMs, verbose) {
  const words = shellWords(command);
  const executable =
    words.length === 1 && words[0].endsWith(".js")
      ? process.execPath
      : words[0];
  const childArgs =
    words.length === 1 && words[0].endsWith(".js")
      ? [words[0], ...args]
      : [...words.slice(1), ...args];
  if (verbose) {
    console.error(`$ ${[executable, ...childArgs].join(" ")}`);
  }

  const { signal, timeout } = timeoutSignal(timeoutMs);
  const child = spawn(executable, childArgs, {
    cwd,
    env,
    signal,
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks = [];
  const stderrChunks = [];
  let stdinError = null;
  child.stdout.on("data", (chunk) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderrChunks.push(chunk);
  });
  child.stdin.on("error", (error) => {
    if (error.code !== "EPIPE" && error.code !== "ECONNRESET") {
      stdinError = error;
    }
  });

  if (stdin !== undefined) child.stdin.end(stdin);
  else child.stdin.end();

  const result = await new Promise((resolve) => {
    child.on("error", (error) => resolve({ error }));
    child.on("close", (code, signalName) => resolve({ code, signalName }));
  });
  clearTimeout(timeout);
  const browserOpenLog = readBrowserOpenLog(
    env.PRIMITIVE_BROWSER_OPEN_TRAP_LOG,
  );
  const authEventLog = readAuthEventLog(env.PRIMITIVE_AUTH_EVENT_LOG);
  const stdout = decodeStreamBuffer(Buffer.concat(stdoutChunks));
  const stderrBuffer = Buffer.concat(stderrChunks);

  if (result.error) {
    if (result.error.name === "AbortError") {
      const stderr = decodeStreamBuffer(
        Buffer.concat([
          stderrBuffer,
          Buffer.from(`\nTimed out after ${timeoutMs}ms\n`, "utf8"),
        ]),
      );
      return {
        authEventLog,
        browserOpenLog,
        exitCode: 124,
        stderr: stderr.text,
        stderrBase64: stderr.base64,
        stderrValidUtf8: stderr.validUtf8,
        stdout: stdout.text,
        stdoutBase64: stdout.base64,
        stdoutValidUtf8: stdout.validUtf8,
      };
    }
    const stderr = decodeStreamBuffer(
      Buffer.concat([
        stderrBuffer,
        Buffer.from(`${result.error.message}\n`, "utf8"),
      ]),
    );
    return {
      authEventLog,
      browserOpenLog,
      exitCode: 127,
      stderr: stderr.text,
      stderrBase64: stderr.base64,
      stderrValidUtf8: stderr.validUtf8,
      stdout: stdout.text,
      stdoutBase64: stdout.base64,
      stdoutValidUtf8: stdout.validUtf8,
    };
  }
  const stderr = decodeStreamBuffer(
    stdinError
      ? Buffer.concat([
          stderrBuffer,
          Buffer.from(`${stdinError.message}\n`, "utf8"),
        ])
      : stderrBuffer,
  );
  return {
    authEventLog,
    browserOpenLog,
    exitCode: result.signalName ? 128 : (result.code ?? 0),
    stderr: stderr.text,
    stderrBase64: stderr.base64,
    stderrValidUtf8: stderr.validUtf8,
    stdout: stdout.text,
    stdoutBase64: stdout.base64,
    stdoutValidUtf8: stdout.validUtf8,
  };
}

function baseEnv(context, caseEnv) {
  const env = { ...process.env };
  const primitiveEnvNames = new Set([
    ...Object.keys(env).filter((name) => name.startsWith("PRIMITIVE_")),
    "PRIMITIVE_API_BASE_URL",
    "PRIMITIVE_API_HEADERS",
    "PRIMITIVE_API_KEY",
    "PRIMITIVE_CONFIG_DIR",
    "PRIMITIVE_HIDE_SIGNUP_HINT",
    "PRIMITIVE_KEY",
    "PRIMITIVE_SIGNUP_CODE",
    "PRIMITIVE_X402_PRIVATE_KEY",
  ]);
  for (const name of [
    ...primitiveEnvNames,
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "http_proxy",
    "https_proxy",
    "ALL_PROXY",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
    "NODE_USE_ENV_PROXY",
  ]) {
    delete env[name];
  }
  env.HOME = path.join(context.runnerTmp, "home");
  env.XDG_CONFIG_HOME = context.runnerTmp;
  env.PRIMITIVE_CONFIG_DIR = context.configDir;
  env.PRIMITIVE_API_BASE_URL = context.baseUrl;
  env.PRIMITIVE_HIDE_SIGNUP_HINT = "1";
  env.PRIMITIVE_SKIP_NEW_VERSION_CHECK = "1";
  mkdirSync(env.HOME, { recursive: true });
  mkdirSync(context.configDir, { recursive: true, mode: 0o700 });
  chmodSync(context.configDir, 0o700);
  const merged = { ...env, ...expand(caseEnv ?? {}, context) };
  const trapDir = installBrowserOpenTrap(context.runnerTmp);
  return prependPathEntry(
    {
      ...merged,
      PRIMITIVE_BROWSER_OPEN_TRAP_LOG: path.join(
        context.runnerTmp,
        "browser-open.log",
      ),
      PRIMITIVE_BROWSER_OPEN_DIRECT_TRAP: "1",
      PRIMITIVE_AUTH_EVENT_LOG: path.join(context.runnerTmp, "auth-events.log"),
    },
    trapDir,
  );
}

function writeFixtureFiles(files, context) {
  for (const [relativePath, value] of Object.entries(files ?? {})) {
    const target = path.resolve(context.caseTmp, expand(relativePath, context));
    if (!target.startsWith(context.caseTmp)) {
      throw new Error(
        `Refusing to write fixture outside case tmp: ${relativePath}`,
      );
    }
    mkdirSync(path.dirname(target), { recursive: true });
    const contents = fileContentsFromSpec(value, context);
    writeFileSync(target, contents);
  }
}

function isBase64FileSpec(value) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.base64 === "string" &&
    Object.keys(value).length === 1
  );
}

function fileContentsFromSpec(value, context) {
  if (isBase64FileSpec(value)) {
    return Buffer.from(expand(value.base64, context), "base64");
  }
  return typeof value === "string"
    ? expand(value, context)
    : asJsonValue(expand(value, context));
}

function writeConfigFiles(files, context) {
  for (const [relativePath, value] of Object.entries(files ?? {})) {
    const target = path.resolve(context.configDir, relativePath);
    if (!target.startsWith(context.configDir)) {
      throw new Error(
        `Refusing to write config outside config dir: ${relativePath}`,
      );
    }
    mkdirSync(path.dirname(target), { recursive: true });
    const contents =
      typeof value === "string"
        ? expand(value, context)
        : asJsonValue(expand(value, context));
    writeFileSync(target, contents);
  }
}

function normalizersFor(context, caseNormalizers) {
  const literalMasks = [
    [context.baseUrl, "__BASE_URL__"],
    [context.baseOrigin, "__BASE_ORIGIN__"],
    [context.caseTmp, "__CASE_TMP__"],
    [context.configDir, "__CONFIG_DIR__"],
    [REPO_ROOT, "__REPO_ROOT__"],
    [context.testPrivateKey, "__TEST_PRIVATE_KEY__"],
  ];
  const regexMasks = [];
  for (const mask of caseNormalizers?.masks ?? []) {
    if (typeof mask === "string") {
      regexMasks.push({
        regex: new RegExp(mask, "g"),
        replacement: "<masked>",
      });
    } else {
      regexMasks.push({
        regex: new RegExp(mask.pattern, mask.flags ?? "g"),
        replacement: mask.replacement ?? "<masked>",
      });
    }
  }
  return { literalMasks, regexMasks };
}

function expectedTextFrom(spec, context) {
  if (spec === undefined) return undefined;
  if (typeof spec === "string") return expand(spec, context);
  if (spec.file) {
    return expand(
      readFileSync(path.resolve(REPO_ROOT, spec.file), "utf8"),
      context,
    );
  }
  if (spec.json !== undefined)
    return asJsonValue(deepSort(expand(spec.json, context)));
  if (
    spec.jsonMatches !== undefined ||
    spec.contains !== undefined ||
    spec.notContains !== undefined ||
    spec.matches !== undefined
  ) {
    return undefined;
  }
  throw new Error(`Unsupported stream expectation: ${JSON.stringify(spec)}`);
}

function assertStreamExpectation(label, actual, spec, context, normalizers) {
  if (spec === undefined) return;
  const comparableActual = renderComparableStream(actual, normalizers);
  if (spec.jsonMatches !== undefined) {
    let parsed;
    try {
      parsed = JSON.parse(actual);
    } catch (error) {
      throw new Error(
        `${label} was not valid JSON: ${error instanceof Error ? error.message : String(error)}\nActual:\n${actual}`,
      );
    }
    assertJsonMatches(
      deepSort(parsed),
      deepSort(expand(spec.jsonMatches, context)),
      label,
    );
  }
  if (spec.contains) {
    for (const item of spec.contains) {
      const expected = expand(item, context);
      const comparableExpected = renderComparableFragment(
        expected,
        normalizers,
      );
      assert(
        actual.includes(expected) ||
          comparableActual.includes(comparableExpected),
        `${label} did not contain ${JSON.stringify(item)}.\nActual:\n${actual}`,
      );
    }
  }
  if (spec.notContains) {
    for (const item of spec.notContains) {
      const expected = expand(item, context);
      const comparableExpected = renderComparableFragment(
        expected,
        normalizers,
      );
      assert(
        !actual.includes(expected) &&
          !comparableActual.includes(comparableExpected),
        `${label} unexpectedly contained ${JSON.stringify(item)}.\nActual:\n${actual}`,
      );
    }
  }
  if (spec.matches) {
    for (const item of spec.matches) {
      const pattern = typeof item === "string" ? item : item.pattern;
      const flags = typeof item === "string" ? "" : (item.flags ?? "");
      const expandedPattern = expand(pattern, context);
      const comparablePattern = renderComparableFragment(pattern, normalizers);
      const comparableActual = renderComparableStream(actual, normalizers);
      assert(
        new RegExp(expandedPattern, flags).test(actual) ||
          new RegExp(comparablePattern, flags).test(comparableActual),
        `${label} did not match /${pattern}/${flags}.\nActual:\n${actual}`,
      );
    }
  }

  const expected = expectedTextFrom(spec, context);
  if (expected !== undefined) {
    assert.equal(
      renderComparableStream(actual, normalizers),
      renderComparableStream(expected, normalizers),
      `${label} mismatch`,
    );
  }
}

function pickHeaders(headers, expectedHeaders) {
  const result = {};
  for (const name of Object.keys(expectedHeaders ?? {})) {
    result[name.toLowerCase()] = headers[name.toLowerCase()];
  }
  return result;
}

const JSON_MATCHER_KEYS = new Set([
  "$flags",
  "$matches",
  "$notEqual",
  "$notMatches",
  "$numberMax",
  "$numberMin",
]);

function isJsonMatcher(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.some(
      (key) =>
        key === "$matches" ||
        key === "$notEqual" ||
        key === "$notMatches" ||
        key === "$numberMin" ||
        key === "$numberMax",
    ) && keys.every((key) => JSON_MATCHER_KEYS.has(key))
  );
}

function regexFromJsonMatcher(matcher, key, label) {
  assert.equal(
    typeof matcher[key],
    "string",
    `${label} ${key} must be a string`,
  );
  if (matcher.$flags !== undefined) {
    assert.equal(
      typeof matcher.$flags,
      "string",
      `${label} $flags must be a string`,
    );
  }
  return new RegExp(matcher[key], matcher.$flags ?? "");
}

function assertJsonMatches(actual, expected, label) {
  if (isJsonMatcher(expected)) {
    if (expected.$matches !== undefined) {
      const regex = regexFromJsonMatcher(expected, "$matches", label);
      assert.equal(
        typeof actual,
        "string",
        `${label} expected a string matching /${regex.source}/${regex.flags}`,
      );
      regex.lastIndex = 0;
      assert(
        regex.test(actual),
        `${label} did not match /${regex.source}/${regex.flags}. Actual: ${JSON.stringify(actual)}`,
      );
    }
    if (expected.$notMatches !== undefined) {
      const regex = regexFromJsonMatcher(expected, "$notMatches", label);
      assert.equal(
        typeof actual,
        "string",
        `${label} expected a string not matching /${regex.source}/${regex.flags}`,
      );
      regex.lastIndex = 0;
      assert(
        !regex.test(actual),
        `${label} unexpectedly matched /${regex.source}/${regex.flags}. Actual: ${JSON.stringify(actual)}`,
      );
    }
    if (expected.$notEqual !== undefined) {
      assert.notDeepEqual(
        actual,
        expected.$notEqual,
        `${label} unexpectedly equaled ${JSON.stringify(expected.$notEqual)}`,
      );
    }
    if (expected.$numberMin !== undefined) {
      assert.equal(
        typeof expected.$numberMin,
        "number",
        `${label} $numberMin must be a number`,
      );
      assert.equal(typeof actual, "number", `${label} expected a number`);
      assert(
        actual >= expected.$numberMin,
        `${label} expected number >= ${expected.$numberMin}. Actual: ${JSON.stringify(actual)}`,
      );
    }
    if (expected.$numberMax !== undefined) {
      assert.equal(
        typeof expected.$numberMax,
        "number",
        `${label} $numberMax must be a number`,
      );
      assert.equal(typeof actual, "number", `${label} expected a number`);
      assert(
        actual <= expected.$numberMax,
        `${label} expected number <= ${expected.$numberMax}. Actual: ${JSON.stringify(actual)}`,
      );
    }
    return;
  }

  if (Array.isArray(expected)) {
    assert(Array.isArray(actual), `${label} expected an array`);
    assert.equal(
      actual.length,
      expected.length,
      `${label} array length mismatch`,
    );
    for (let index = 0; index < expected.length; index += 1) {
      assertJsonMatches(actual[index], expected[index], `${label}[${index}]`);
    }
    return;
  }

  if (expected && typeof expected === "object") {
    assert(
      actual && typeof actual === "object" && !Array.isArray(actual),
      `${label} expected an object`,
    );
    assert.deepEqual(
      Object.keys(actual).sort(),
      Object.keys(expected).sort(),
      `${label} object keys mismatch`,
    );
    for (const [key, value] of Object.entries(expected)) {
      assertJsonMatches(actual[key], value, `${label}.${key}`);
    }
    return;
  }

  assert.deepEqual(actual, expected, `${label} mismatch`);
}

function comparableJson(actual, expected) {
  if (isJsonMatcher(expected)) return "<matched>";
  if (Array.isArray(expected)) {
    return expected.map((item, index) => comparableJson(actual[index], item));
  }
  if (expected && typeof expected === "object") {
    return Object.fromEntries(
      Object.entries(expected).map(([key, value]) => [
        key,
        comparableJson(actual[key], value),
      ]),
    );
  }
  return actual;
}

function assertRequestMatches(actual, expected, context) {
  const expanded = expand(expected, context);
  if (expanded.method !== undefined)
    assert.equal(actual.method, expanded.method);
  if (expanded.path !== undefined)
    assertJsonMatches(actual.path, expanded.path, "path");
  if (expanded.query !== undefined || expanded.queryAny !== true) {
    assertJsonMatches(
      deepSort(actual.query),
      deepSort(expanded.query ?? {}),
      "query",
    );
  }
  if (expanded.body !== undefined)
    assertJsonMatches(actual.body, expanded.body, "body");
  if (expanded.bodyBase64 !== undefined) {
    assertJsonMatches(actual.bodyBase64, expanded.bodyBase64, "bodyBase64");
  }
  if (
    expanded.body === undefined &&
    expanded.bodyBase64 === undefined &&
    expanded.bodyAny !== true
  ) {
    assert.equal(actual.body, "", "body should be empty");
  }
  if (expanded.headers !== undefined) {
    assert.deepEqual(
      pickHeaders(actual.headers, expanded.headers),
      lowerHeaderObject(expanded.headers),
    );
  }
  for (const name of expanded.headersAbsent ?? []) {
    assert.equal(
      actual.headers[String(name).toLowerCase()],
      undefined,
      `Expected header ${name} to be absent`,
    );
  }
}

function lowerHeaderObject(headers) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function assertRequests(actual, expected, context, label = "HTTP") {
  const expectedRequests = expected ?? [];
  assert.equal(
    actual.length,
    expectedRequests.length,
    `${label}: expected ${expectedRequests.length} HTTP request(s), got ${actual.length}:\n${JSON.stringify(actual, null, 2)}`,
  );
  for (let index = 0; index < expectedRequests.length; index += 1) {
    try {
      assertRequestMatches(actual[index], expectedRequests[index], context);
    } catch (error) {
      error.message = `${label}: HTTP request ${index} mismatch: ${error.message}\nActual:\n${JSON.stringify(actual[index], null, 2)}`;
      throw error;
    }
  }
}

function comparableRequest(actual, expected, context) {
  const expanded = expand(expected ?? {}, context);
  const result = {};
  if (expanded.method !== undefined) result.method = actual.method;
  if (expanded.path !== undefined)
    result.path = comparableJson(actual.path, expanded.path);
  if (expanded.query !== undefined || expanded.queryAny !== true) {
    result.query = deepSort(comparableJson(actual.query, expanded.query ?? {}));
  }
  if (expanded.body !== undefined)
    result.body = deepSort(comparableJson(actual.body, expanded.body));
  if (expanded.bodyBase64 !== undefined) {
    result.bodyBase64 = comparableJson(actual.bodyBase64, expanded.bodyBase64);
  }
  if (
    expanded.body === undefined &&
    expanded.bodyBase64 === undefined &&
    expanded.bodyAny !== true
  ) {
    result.body = actual.body;
  }
  if (expanded.headers !== undefined) {
    result.headers = pickHeaders(actual.headers, expanded.headers);
  }
  for (const name of expanded.headersAbsent ?? []) {
    result[`header:${String(name).toLowerCase()}`] =
      actual.headers[String(name).toLowerCase()] ?? null;
  }
  return deepSort(result);
}

function comparableRequests(actual, expected, context) {
  if (expected === undefined) return actual.map((request) => deepSort(request));
  return actual.map((request, index) =>
    comparableRequest(request, expected[index], context),
  );
}

function resolveOutputFile(pathSpec, context) {
  const target = path.resolve(context.caseTmp, expand(pathSpec, context));
  if (!target.startsWith(context.caseTmp)) {
    throw new Error(`Refusing to read output outside case tmp: ${pathSpec}`);
  }
  return target;
}

function assertOutputFiles(files, context, normalizers) {
  for (const [pathSpec, spec] of Object.entries(files ?? {})) {
    const target = resolveOutputFile(pathSpec, context);
    if (isBase64FileSpec(spec)) {
      const actual = readFileSync(target).toString("base64");
      assertJsonMatches(
        actual,
        expand(spec.base64, context),
        `output file ${pathSpec} base64`,
      );
    } else {
      const actual = readFileSync(target, "utf8");
      assertStreamExpectation(
        `output file ${pathSpec}`,
        actual,
        spec,
        context,
        normalizers,
      );
    }
  }
}

function assertOutputFilesAbsent(files, context) {
  for (const pathSpec of files ?? []) {
    const target = resolveOutputFile(pathSpec, context);
    assert(!existsSync(target), `output file ${pathSpec} should be absent`);
  }
}

function assertConfigFiles(files, context) {
  for (const [relativePath, expected] of Object.entries(files ?? {})) {
    const target = path.resolve(context.configDir, relativePath);
    if (!target.startsWith(context.configDir)) {
      throw new Error(
        `Refusing to read config outside config dir: ${relativePath}`,
      );
    }
    const raw = readFileSync(target, "utf8");
    if (typeof expected === "string") {
      assert.equal(
        raw,
        expand(expected, context),
        `config file ${relativePath} mismatch`,
      );
    } else {
      assertJsonMatches(
        deepSort(JSON.parse(raw)),
        deepSort(expand(expected, context)),
        `config file ${relativePath}`,
      );
    }
  }
}

function assertConfigFilesAbsent(files, context) {
  for (const relativePath of files ?? []) {
    const target = path.resolve(context.configDir, relativePath);
    if (!target.startsWith(context.configDir)) {
      throw new Error(
        `Refusing to inspect config outside config dir: ${relativePath}`,
      );
    }
    assert(!existsSync(target), `config file ${relativePath} should be absent`);
  }
}

function fileMode(stat) {
  if (process.platform === "win32") return undefined;
  return (stat.mode & 0o777).toString(8).padStart(3, "0");
}

function sideEffectPath(root, target, normalizers) {
  return normalizeMaskedPathSeparators(
    applyMasks(path.relative(root, target).split(path.sep).join("/"), {
      literalMasks: [
        [root, "__SIDE_EFFECT_ROOT__"],
        ...normalizers.literalMasks,
      ],
      regexMasks: normalizers.regexMasks,
    }),
  );
}

function sideEffectInventory(root, normalizers) {
  const entries = [];

  function visit(directory) {
    for (const dirent of readdirSync(directory, { withFileTypes: true }).sort(
      (left, right) => left.name.localeCompare(right.name),
    )) {
      const target = path.join(directory, dirent.name);
      const stat = lstatSync(target);
      const entry = {
        path: sideEffectPath(root, target, normalizers),
      };
      const mode = fileMode(stat);
      if (mode !== undefined) entry.mode = mode;

      if (dirent.isDirectory()) {
        entries.push({ ...entry, type: "dir" });
        visit(target);
      } else if (dirent.isSymbolicLink()) {
        entries.push({
          ...entry,
          target: renderComparableFragment(readlinkSync(target), normalizers),
          type: "symlink",
        });
      } else {
        entries.push({
          ...entry,
          type: "file",
        });
      }
    }
  }

  visit(root);
  return entries;
}

function comparableProcessOutput(result, normalizers) {
  const comparable = {
    authEventLog: renderComparableStream(result.authEventLog, normalizers),
    browserOpenLog: renderComparableStream(result.browserOpenLog, normalizers),
    exitCode: result.exitCode,
    stderr: renderComparableStream(result.stderr, normalizers),
    stdout: renderComparableStream(result.stdout, normalizers),
  };
  if (!result.stdoutValidUtf8) comparable.stdoutBase64 = result.stdoutBase64;
  if (!result.stderrValidUtf8) comparable.stderrBase64 = result.stderrBase64;
  return comparable;
}

function normalizeWindowsNodeRuntimeAbort(
  commandName,
  result,
  expectedExitCode,
) {
  if (process.platform !== "win32") return;
  if (commandName !== "node") return;
  if (expectedExitCode === undefined) return;
  if (expectedExitCode === 0) return;
  if (result.exitCode !== WINDOWS_NODE_UV_HANDLE_CLOSING_EXIT_CODE) return;
  if (!WINDOWS_NODE_UV_HANDLE_CLOSING_ASSERTION.test(result.stderr)) return;

  result.exitCode = expectedExitCode;
  result.stderr = result.stderr.replace(
    WINDOWS_NODE_UV_HANDLE_CLOSING_ASSERTION,
    "",
  );
}

function normalizeNodeInstallWarnings(commandName, result) {
  if (commandName !== "node") return;
  result.stderr = result.stderr.replace(OCLIF_AUTOCOMPLETE_PLUGIN_WARNING, "");
}

async function runSide({ binary, caseItem, commandName, options, tmpRoot }) {
  const caseTmp = path.join(tmpRoot, sanitizeName(caseItem.name), commandName);
  const runnerTmp = path.join(caseTmp, "run");
  const configDir = path.join(runnerTmp, "primitive");
  mkdirSync(runnerTmp, { recursive: true });

  const context = {
    baseOrigin: "__BASE_ORIGIN__",
    baseUrl: "__BASE_URL__",
    caseTmp,
    configDir,
    runnerTmp,
    testPrivateKey: TEST_PRIVATE_KEY,
  };
  const server = await startMockServer(
    caseItem.name,
    caseItem.server?.exchanges ?? [],
    context,
  );
  if (options.verbose) {
    console.error(`${caseItem.name}: ${commandName} ${server.baseUrl}`);
  }

  writeFixtureFiles(caseItem.files, context);
  writeConfigFiles(caseItem.configFiles, context);

  try {
    const env = baseEnv(context, caseItem.env);
    const normalizers = normalizersFor(context, caseItem.normalize);
    const expected = {
      ...(caseItem.expect ?? {}),
      ...(caseItem.expectByRunner?.[commandName] ?? {}),
    };
    const expectedExitCode =
      expected.exitCodeAny === true || expected.exitCode === "any"
        ? undefined
        : (expected.exitCode ?? 0);
    const result = await runProcess(
      binary,
      expand(caseItem.args ?? [], context),
      env,
      REPO_ROOT,
      expand(caseItem.stdin, context),
      caseItem.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      options.verbose,
    );
    normalizeWindowsNodeRuntimeAbort(
      commandName,
      result,
      expectedExitCode,
    );
    normalizeNodeInstallWarnings(commandName, result);
    if (expected.browserOpenLog !== undefined && result.browserOpenLog === "") {
      result.browserOpenLog = await waitForBrowserOpenLog(
        env.PRIMITIVE_BROWSER_OPEN_TRAP_LOG,
        1_000,
      );
    }
    const expectedRequests = expected.requests ?? caseItem.expect?.requests;
    if (expected.browserOpenLog !== undefined) {
      assertStreamExpectation(
        `${commandName} browser open log`,
        result.browserOpenLog,
        expected.browserOpenLog,
        context,
        normalizers,
      );
    } else {
      assert.equal(
        result.browserOpenLog,
        "",
        `${commandName} attempted to open a browser:\n${result.browserOpenLog}`,
      );
    }
    if (expected.authEventLog !== undefined) {
      assertStreamExpectation(
        `${commandName} auth event log`,
        result.authEventLog,
        expected.authEventLog,
        context,
        normalizers,
      );
    } else {
      assert.equal(
        result.authEventLog,
        "",
        `${commandName} wrote auth event log unexpectedly:\n${result.authEventLog}`,
      );
    }
    if (expectedExitCode !== undefined) {
      assert.equal(
        result.exitCode,
        expectedExitCode,
        `${commandName} exit code mismatch\nstderr:\n${result.stderr}`,
      );
    }
    assertStreamExpectation(
      `${commandName} stdout`,
      result.stdout,
      expected.stdout,
      context,
      normalizers,
    );
    assertStreamExpectation(
      `${commandName} stderr`,
      result.stderr,
      expected.stderr,
      context,
      normalizers,
    );
    assertRequests(server.requests, expectedRequests, context, commandName);
    assertOutputFiles(expected.files, context, normalizers);
    assertOutputFilesAbsent(expected.filesAbsent, context);
    assertConfigFiles(expected.configFiles, context);
    assertConfigFilesAbsent(expected.configFilesAbsent, context);

    return {
      comparable: comparableProcessOutput(result, normalizers),
      context,
      raw: result,
      requests: comparableRequests(server.requests, expectedRequests, context),
      sideEffects: sideEffectInventory(caseTmp, normalizers),
    };
  } finally {
    await server.close();
  }
}

function isNoArgRootCase(caseItem) {
  return Array.isArray(caseItem.args) && caseItem.args.length === 0;
}

function rootHelpRuntimeNormalizedStdout(output) {
  return output.replace(
    /^ {2}primitive(?:-rust)?\/[0-9][^\s\n]*(?: [^\n]+)?\n/m,
    "  primitive/<version>\n",
  );
}

function assertRootHelpStdoutParity(caseItem, nodeStdout, rustStdout) {
  if (!isNoArgRootCase(caseItem)) return;
  assertRootHelpVersionLine(nodeStdout, "Node");
  assertRootHelpVersionLine(rustStdout, "Rust");
  assert.equal(
    rootHelpRuntimeNormalizedStdout(rustStdout),
    rootHelpRuntimeNormalizedStdout(nodeStdout),
    "Node/Rust root help stdout parity mismatch",
  );
}

function assertRootHelpVersionLine(stdout, runnerName) {
  const match = stdout.match(/^VERSION\n {2}([^\n]+)\n/m);
  if (!match) {
    throw new Error(`${runnerName} root help is missing VERSION line`);
  }
  const versionLine = match[1];
  const valid =
    runnerName === "Node"
      ? /^primitive\/[0-9][^\s\n]* [^\s\n]+ node-v[0-9][^\s\n]*$/.test(versionLine)
      : /^primitive(?:-rust)?\/[0-9][^\s\n]*$/.test(versionLine);
  if (!valid) {
    throw new Error(
      `${runnerName} root help VERSION line has unexpected shape: ${JSON.stringify(versionLine)}`,
    );
  }
}

async function runCase(caseItem, options, tmpRoot) {
  if (caseItem.skip) {
    console.log(`- ${caseItem.name} skipped: ${caseItem.skip}`);
    return;
  }

  const node = await runSide({
    binary: options.nodeCli,
    caseItem,
    commandName: "node",
    options,
    tmpRoot,
  });
  const rust = await runSide({
    binary: options.rustCli,
    caseItem,
    commandName: "rust",
    options,
    tmpRoot,
  });

  assertRootHelpStdoutParity(caseItem, node.raw.stdout, rust.raw.stdout);

  if (caseItem.compare !== false) {
    assert.deepEqual(
      rust.comparable,
      node.comparable,
      "Node/Rust process output parity mismatch",
    );
    assert.deepEqual(
      rust.requests,
      node.requests,
      "Node/Rust HTTP request parity mismatch",
    );
    assert.deepEqual(
      rust.sideEffects,
      node.sideEffects,
      "Node/Rust filesystem side-effect parity mismatch",
    );
  }
  console.log(`+ ${caseItem.name}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixture = readJson(options.casesPath);
  const cases = Array.isArray(fixture) ? fixture : fixture.cases;
  if (!Array.isArray(cases))
    throw new Error("Fixture must be an array or { cases: [...] }.");

  const selected = options.names.length
    ? cases.filter((caseItem) => options.names.includes(caseItem.name))
    : cases;
  if (options.names.length && selected.length !== options.names.length) {
    const found = new Set(selected.map((caseItem) => caseItem.name));
    const missing = options.names.filter((name) => !found.has(name));
    throw new Error(`Unknown case(s): ${missing.join(", ")}`);
  }

  const tmpRoot = mkdtempSync(path.join(tmpdir(), "primitive-cli-parity-"));
  try {
    for (const caseItem of selected) {
      await runCase(caseItem, options, tmpRoot);
    }
    console.log(`\n${selected.length} case(s) handled.`);
  } finally {
    if (options.keepTmp) console.error(`Kept tmp: ${tmpRoot}`);
    else
      rmSync(tmpRoot, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 100,
      });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
