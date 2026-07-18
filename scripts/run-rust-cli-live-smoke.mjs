#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_TIMEOUT_MS = 30_000;
const EXIT_HARNESS_FAILURE = 1;
const EXIT_MISSING_API_KEY = 2;

function usage() {
  return `Usage:
  PRIMITIVE_API_KEY=prim_... node scripts/run-rust-cli-live-smoke.mjs

Options:
  --rust-bin <path>      Rust CLI binary. Defaults to cli-rust/target/debug/primitive
  --api-base-url <url>   API base URL. Defaults to PRIMITIVE_API_BASE_URL or https://api.primitive.dev/v1
  --allow-non-primitive-api-base-url
                         Permit sending PRIMITIVE_API_KEY to a non-api.primitive.dev host
  --include-mutating     Also run opt-in live write checks with cleanup where supported
  --include-email-e2e    Also send a real email through the CLI product path.
                         Requires PRIMITIVE_RUST_LIVE_SEND_FROM and
                         PRIMITIVE_RUST_LIVE_SEND_TO.
  --include-secret-argv  Also run the --api-key flag case. This briefly exposes
                         the live key in the child process argv.
  --no-key-only          Run only local no-key checks and exit 0.
  --keep-tmp            Keep the isolated temp HOME/config directory.
                        With a live key, this may retain credentials.json.

By default, failure output from live commands is suppressed because it may contain
account, domain, or email metadata. Set PRIMITIVE_LIVE_SMOKE_SHOW_OUTPUT=1 to
print redacted stdout/stderr while debugging locally.

Set PRIMITIVE_RUST_LIVE_INCLUDE_MUTATING=1 as an alternative to
--include-mutating when using this from Make or CI.

Set PRIMITIVE_RUST_LIVE_INCLUDE_EMAIL_E2E=1 as an alternative to
--include-email-e2e. This uses the real \`primitive send\` product path and
should be run only with disposable test addresses.

Set PRIMITIVE_RUST_LIVE_INCLUDE_SECRET_ARGV=1 as an alternative to
--include-secret-argv. This should only be used on a trusted local machine.

Set PRIMITIVE_RUST_LIVE_NO_KEY_ONLY=1 as an alternative to --no-key-only for
local-only smoke runs.
`;
}

function parseArgs(argv) {
  const options = {
    allowNonPrimitiveApiBaseUrl: false,
    apiBaseUrl: process.env.PRIMITIVE_API_BASE_URL ?? "https://api.primitive.dev/v1",
    includeEmailE2e: process.env.PRIMITIVE_RUST_LIVE_INCLUDE_EMAIL_E2E === "1",
    includeMutating: process.env.PRIMITIVE_RUST_LIVE_INCLUDE_MUTATING === "1",
    includeSecretArgv: process.env.PRIMITIVE_RUST_LIVE_INCLUDE_SECRET_ARGV === "1",
    keepTmp: false,
    noKeyOnly: process.env.PRIMITIVE_RUST_LIVE_NO_KEY_ONLY === "1",
    rustBin: process.env.RUST_CLI_BIN ?? path.join(REPO_ROOT, "cli-rust/target/debug/primitive"),
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
    if (arg === "--no-key-only") {
      options.noKeyOnly = true;
      continue;
    }
    if (arg === "--allow-non-primitive-api-base-url") {
      options.allowNonPrimitiveApiBaseUrl = true;
      continue;
    }
    if (arg === "--include-mutating") {
      options.includeMutating = true;
      continue;
    }
    if (arg === "--include-email-e2e") {
      options.includeEmailE2e = true;
      continue;
    }
    if (arg === "--include-secret-argv") {
      options.includeSecretArgv = true;
      continue;
    }

    const next = argv[index + 1];
    if (!next) throw new Error(`Missing value for ${arg}`);
    if (arg === "--rust-bin") {
      options.rustBin = path.resolve(next);
    } else if (arg === "--api-base-url") {
      options.apiBaseUrl = next;
    } else {
      throw new Error(`Unknown option ${arg}`);
    }
    index += 1;
  }

  return options;
}

function assertSafeApiBaseUrl(apiBaseUrl, allowNonPrimitiveApiBaseUrl) {
  let url;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new Error(`Invalid API base URL: ${apiBaseUrl}`);
  }

  if (allowNonPrimitiveApiBaseUrl) return;
  if (url.protocol === "https:" && url.hostname === "api.primitive.dev") return;

  throw new Error(
    `Refusing to send PRIMITIVE_API_KEY to ${url.origin}. ` +
      "Use --allow-non-primitive-api-base-url only for a trusted Primitive API test host.",
  );
}

function isolatedEnv(tmpRoot, apiBaseUrl, apiKey) {
  const env = { ...process.env };
  for (const name of Object.keys(env).filter((item) => item.startsWith("PRIMITIVE_"))) {
    delete env[name];
  }
  env.HOME = path.join(tmpRoot, "home");
  env.XDG_CONFIG_HOME = path.join(tmpRoot, "xdg");
  env.PRIMITIVE_CONFIG_DIR = path.join(tmpRoot, "primitive");
  if (apiKey) {
    env.PRIMITIVE_API_KEY = apiKey;
  }
  env.PRIMITIVE_API_BASE_URL = apiBaseUrl;
  env.PRIMITIVE_HIDE_SIGNUP_HINT = "1";
  mkdirSync(env.HOME, { recursive: true });
  mkdirSync(env.XDG_CONFIG_HOME, { recursive: true });
  mkdirSync(env.PRIMITIVE_CONFIG_DIR, { recursive: true });
  return env;
}

function redactLiveOutput(value) {
  return value
    .replace(/prim_[A-Za-z0-9._-]+/g, "prim_<redacted>")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer <redacted>");
}

function formatCapturedOutput(result) {
  if (process.env.PRIMITIVE_LIVE_SMOKE_SHOW_OUTPUT !== "1") {
    return "stdout/stderr hidden; set PRIMITIVE_LIVE_SMOKE_SHOW_OUTPUT=1 to print redacted output locally";
  }
  return `stdout:\n${redactLiveOutput(result.stdout)}\nstderr:\n${redactLiveOutput(result.stderr)}`;
}

function runProcess(binary, args, env) {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
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
    }, DEFAULT_TIMEOUT_MS);

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
        error,
        exitCode: 127,
        signal: null,
        stderr: `${stderr}${error.message}\n`,
        stdout,
        timedOut,
      });
    });
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      resolve({
        exitCode: timedOut ? 124 : signal ? 128 : (code ?? 0),
        signal,
        stderr,
        stdout,
        timedOut,
      });
    });
  });
}

function parseJsonOutput(name, stdout) {
  try {
    return JSON.parse(stdout);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name} did not print JSON: ${detail}`);
  }
}

function caseArgs(item, state) {
  return typeof item.args === "function" ? item.args(state) : item.args;
}

async function runCase(binary, env, item, state) {
  process.stdout.write(`+ ${item.name}\n`);
  const args = caseArgs(item, state);
  if (args === null) {
    process.stdout.write(`  skipped\n`);
    return false;
  }
  const caseEnv =
    typeof item.env === "function"
      ? item.env(env, state)
      : item.env
        ? { ...env, ...item.env }
        : env;
  const result = await runProcess(binary, args, caseEnv);
  if (result.timedOut) {
    throw new Error(
      `${item.name} timed out after ${DEFAULT_TIMEOUT_MS}ms\n${formatCapturedOutput(result)}`,
    );
  }
  if (item.expectedFailure) {
    if (result.exitCode === 0) {
      throw new Error(`${item.name} unexpectedly succeeded\n${formatCapturedOutput(result)}`);
    }
    item.validate?.(null, result, state);
    return true;
  }
  if (result.exitCode !== 0) {
    throw new Error(
      `${item.name} failed with exit code ${result.exitCode}\n${formatCapturedOutput(result)}`,
    );
  }
  const parsed = item.json === false ? null : parseJsonOutput(item.name, result.stdout);
  item.validate?.(parsed, result, state);
  return true;
}

function assertEnvelope(value, name) {
  assert(value && typeof value === "object", `${name} should print an envelope object`);
  assert.equal(value.success, true, `${name} envelope should report success`);
  assert("data" in value, `${name} envelope should include data`);
}

function templateItems(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object" && Array.isArray(value.items)) return value.items;
  return null;
}

function findOperation(operations, operationId) {
  const operation = operations.find((item) => item?.operationId === operationId);
  assert(operation, `missing ${operationId}`);
  return operation;
}

function requireEmailEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when --include-email-e2e is set`);
  }
  if (!value.includes("@")) {
    throw new Error(`${name} must be an email address`);
  }
  return value;
}

function withoutEnvKey(baseEnv) {
  const env = { ...baseEnv };
  delete env.PRIMITIVE_API_KEY;
  return env;
}

function savedCredentialsEnv(baseEnv, state) {
  const env = withoutEnvKey(baseEnv);
  delete env.PRIMITIVE_API_BASE_URL;
  writeFileSync(
    path.join(env.PRIMITIVE_CONFIG_DIR, "credentials.json"),
    `${JSON.stringify(
      {
        access_token: state.liveApiKey,
        api_base_url_1: state.apiBaseUrl,
        auth_method: "oauth",
        token_type: "Bearer",
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  return env;
}

const NO_KEY_CASES = [
  {
    args: ["--version"],
    json: false,
    name: "no-key version",
    validate: (_value, result) => {
      assert.match(result.stdout, /^primitive\/\d+\.\d+\.\d+/);
    },
  },
  {
    args: [],
    json: false,
    name: "no-key root help",
    validate: (_value, result) => {
      assert.match(result.stdout, /Primitive Rust CLI/);
      assert.match(result.stdout, /list-operations/);
    },
  },
  {
    args: ["completion", "bash"],
    json: false,
    name: "no-key bash completion",
    validate: (_value, result) => {
      assert.match(result.stdout, /complete -F _primitive_completion primitive/);
      assert.match(result.stdout, /payloads:push/);
    },
  },
  {
    args: ["completion", "zsh"],
    json: false,
    name: "no-key zsh completion",
    validate: (_value, result) => {
      assert.match(result.stdout, /#compdef primitive/);
      assert.match(result.stdout, /sending:send-email/);
    },
  },
  {
    args: ["completion", "fish"],
    json: false,
    name: "no-key fish completion",
    validate: (_value, result) => {
      assert.match(result.stdout, /complete -c primitive/);
      assert.match(result.stdout, /send-email/);
    },
  },
  {
    args: ["autocomplete", "bash"],
    json: false,
    name: "no-key autocomplete instructions",
    validate: (_value, result) => {
      assert.match(result.stdout, /primitive autocomplete script bash/);
    },
  },
  {
    args: ["list-operations"],
    name: "no-key local manifest lists operations",
    validate: (value) => {
      assert(Array.isArray(value), "list-operations should print an array");
      assert(value.length >= 100, "list-operations should include the generated API surface");
      const operationIds = value.map((operation) => operation.operationId);
      assert.equal(
        new Set(operationIds).size,
        operationIds.length,
        "list-operations should not duplicate operation ids",
      );
      const getAccount = findOperation(value, "getAccount");
      assert.equal(getAccount.method, "GET");
      assert.equal(getAccount.path, "/account");
      const sendEmail = findOperation(value, "sendEmail");
      assert.equal(sendEmail.method, "POST");
      assert.equal(sendEmail.path, "/send-mail");
      assert.equal(sendEmail.command, "send-email");
      assert.equal(sendEmail.tagCommand, "sending");
      findOperation(value, "listFunctions");
      findOperation(value, "searchEmails");
    },
  },
  {
    args: ["describe", "sending:send-email"],
    name: "no-key local describe resolves send",
    validate: (value) => {
      assert.equal(value.operationId, "sendEmail");
      assert.equal(value.method, "POST");
      assert.equal(value.path, "/send-mail");
      assert.equal(value.bodyRequired, true);
      assert(value.requestSchema && typeof value.requestSchema === "object");
    },
  },
  {
    args: ["describe", "sendEmail"],
    name: "no-key local describe resolves operation id",
    validate: (value) => {
      assert.equal(value.operationId, "sendEmail");
      assert.equal(value.path, "/send-mail");
      assert.equal(value.command, "send-email");
      assert.equal(value.tagCommand, "sending");
    },
  },
  {
    args: ["describe", "emails:search-emails"],
    name: "no-key local describe exposes query params",
    validate: (value) => {
      assert.equal(value.operationId, "searchEmails");
      assert.equal(value.method, "GET");
      assert.equal(value.path, "/emails/search");
      assert(
        value.queryParams?.some((param) => param.name === "limit"),
        "emails:search-emails should expose the limit query param",
      );
    },
  },
  {
    args: ["config", "list", "--json"],
    name: "no-key config list empty",
    validate: (value) => {
      assert.deepEqual(value, { current_environment: null, environments: {}, version: 1 });
    },
  },
  {
    args: [
      "config",
      "set",
      "--environment",
      "live-smoke",
      "--api-base-url",
      "https://api.primitive.dev/v1",
    ],
    json: false,
    name: "no-key config set local environment",
    validate: (_value, result) => {
      assert.match(result.stderr, /Primitive CLI environment live-smoke is active\./);
    },
  },
  {
    args: ["config", "list", "--json"],
    name: "no-key config list active environment",
    validate: (value) => {
      assert.equal(value.current_environment, "live-smoke");
      assert.equal(
        value.environments?.["live-smoke"]?.api_base_url,
        "https://api.primitive.dev/v1",
      );
      assert.deepEqual(value.environments?.["live-smoke"]?.headers, {});
    },
  },
  {
    args: ["config", "reset", "--environment", "live-smoke"],
    json: false,
    name: "no-key config reset local environment",
    validate: (_value, result) => {
      assert.match(result.stderr, /Primitive CLI environment live-smoke removed\./);
    },
  },
  {
    args: ["config", "list", "--json"],
    name: "no-key config list after reset",
    validate: (value) => {
      assert.deepEqual(value, { current_environment: null, environments: {}, version: 1 });
    },
  },
  {
    args: ["account:get-account", "--help"],
    json: false,
    name: "no-key generated account help before auth",
    validate: (_value, result) => {
      assert.match(result.stdout, /GET \/account/);
      assert.match(result.stdout, /--envelope/);
    },
  },
  {
    args: ["sending:send-email", "--help"],
    json: false,
    name: "no-key generated send help before auth",
    validate: (_value, result) => {
      assert.match(result.stdout, /primitive sending send-email/);
      assert.match(result.stdout, /POST \/send-mail/);
      assert.match(result.stdout, /--body-text/);
      assert.match(result.stdout, /--idempotency-key/);
    },
  },
  {
    args: ["sending", "send", "--help"],
    json: false,
    name: "no-key send help before auth",
    validate: (_value, result) => {
      assert.match(result.stdout, /primitive sending send/);
      assert.match(result.stdout, /--subject/);
    },
  },
  {
    args: ["emails", "latest", "--help"],
    json: false,
    name: "no-key emails latest help before auth",
    validate: (_value, result) => {
      assert.match(result.stdout, /primitive emails latest/);
    },
  },
  {
    args: ["functions", "deploy", "--help"],
    json: false,
    name: "no-key functions deploy help before auth",
    validate: (_value, result) => {
      assert.match(result.stdout, /primitive functions deploy/);
    },
  },
];

function buildEmailE2eCases() {
  const from = requireEmailEnv("PRIMITIVE_RUST_LIVE_SEND_FROM");
  const to = requireEmailEnv("PRIMITIVE_RUST_LIVE_SEND_TO");
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const subject = `Rust live smoke ${nonce}`;
  const body = `Primitive Rust CLI live send smoke ${nonce}`;

  return [
    {
      args: [
        "send",
        "--from",
        from,
        "--to",
        to,
        "--subject",
        subject,
        "--body",
        body,
        "--wait",
      ],
      name: "email e2e send waits for delivery result",
      validate: (value) => {
        assert(value && typeof value === "object", "send should print a JSON object");
        assert.equal(typeof value.id, "string", "send response should include id");
        assert.equal(typeof value.from, "string", "send response should include from");
        assert(Array.isArray(value.accepted), "send response should include accepted recipients");
        assert(Array.isArray(value.rejected), "send response should include rejected recipients");
        if ("status" in value) {
          assert.equal(typeof value.status, "string", "send response status should be a string");
        }
        if ("delivery_status" in value) {
          assert.equal(
            typeof value.delivery_status,
            "string",
            "send response delivery_status should be a string",
          );
        }
      },
    },
  ];
}

function buildMutatingCases(tmpRoot) {
  const state = {};
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const memoryKey = `rust-live-smoke:${nonce}`;
  const payloadIn = path.join(tmpRoot, "payload-in.txt");
  const payloadOut = path.join(tmpRoot, "payload-out.txt");
  const zeroPayloadIn = path.join(tmpRoot, "payload-zero-in.bin");
  const zeroPayloadOut = path.join(tmpRoot, "payload-zero-out.bin");
  const payloadText = `primitive rust live smoke ${nonce}\n`;
  writeFileSync(payloadIn, payloadText, "utf8");
  writeFileSync(zeroPayloadIn, "");

  return [
    {
      args: [
        "memories",
        "set",
        memoryKey,
        JSON.stringify({ nonce, source: "rust-live-smoke" }),
        "--ttl-seconds",
        "300",
      ],
      name: "mutating memories set",
      validate: (value) => {
        assert.equal(value.key, memoryKey);
        assert.equal(value.value?.nonce, nonce);
      },
    },
    {
      args: ["memories", "get", memoryKey],
      name: "mutating memories get",
      validate: (value) => {
        assert.equal(value.key, memoryKey);
        assert.equal(value.value?.nonce, nonce);
      },
    },
    {
      args: ["memories", "delete", memoryKey],
      name: "mutating memories delete",
      validate: (value) => {
        assert.equal(value.key, memoryKey);
        assert.equal(value.deleted, true);
      },
    },
    {
      args: ["payloads", "push", payloadIn, "--quiet"],
      name: "mutating payloads push",
      validate: (value) => {
        assert.equal(typeof value.merkle_root, "string");
        assert.match(value.merkle_root, /^[0-9a-f]{64}$/);
        assert.equal(typeof value.cek, "string");
        assert.match(value.cek, /^[0-9a-f]{64}$/);
        assert.equal(value.chunk_count, 1);
        assert.equal(value.total_bytes, Buffer.byteLength(payloadText));
        state.payload = value;
      },
    },
    {
      args: () => [
        "payloads",
        "pull",
        state.payload?.merkle_root ?? "",
        "--cek",
        state.payload?.cek ?? "",
        "--out",
        payloadOut,
        "--quiet",
      ],
      name: "mutating payloads pull",
      validate: (value) => {
        assert.equal(value.merkle_root, state.payload.merkle_root);
        assert.equal(value.chunk_count, 1);
        assert.equal(value.total_bytes, Buffer.byteLength(payloadText));
        assert.equal(readFileSync(payloadOut, "utf8"), payloadText);
      },
    },
    {
      args: ["payloads", "push", zeroPayloadIn, "--quiet"],
      name: "mutating payloads push zero-byte",
      validate: (value) => {
        assert.equal(value.merkle_root, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        assert.equal(typeof value.cek, "string");
        assert.match(value.cek, /^[0-9a-f]{64}$/);
        assert.equal(value.chunk_count, 0);
        assert.equal(value.total_bytes, 0);
        state.zeroPayload = value;
      },
    },
    {
      args: () => [
        "payloads",
        "pull",
        state.zeroPayload?.merkle_root ?? "",
        "--cek",
        state.zeroPayload?.cek ?? "",
        "--out",
        zeroPayloadOut,
        "--quiet",
      ],
      name: "mutating payloads pull zero-byte",
      validate: (value) => {
        assert.equal(value.merkle_root, state.zeroPayload.merkle_root);
        assert.equal(value.chunk_count, 0);
        assert.equal(value.total_bytes, 0);
        assert.equal(readFileSync(zeroPayloadOut, "utf8"), "");
      },
    },
  ];
}

const READ_ONLY_CASES = [
  {
    args: ["list-operations"],
    name: "local manifest lists operations",
    validate: (value) => {
      assert(Array.isArray(value), "list-operations should print an array");
      assert(value.some((operation) => operation.operationId === "getAccount"), "missing getAccount");
    },
  },
  {
    args: ["describe", "sending:send-email"],
    name: "local describe resolves generated operation",
    validate: (value) => {
      assert.equal(value.operationId, "sendEmail");
      assert.equal(value.path, "/send-mail");
    },
  },
  {
    args: ["templates:list-templates"],
    name: "public templates list",
    validate: (value, _result, state) => {
      const items = templateItems(value);
      assert(items, "templates:list-templates should print an array or an object with items");
      state.firstTemplate = items.find((item) => item && typeof item.slug === "string") ?? null;
    },
  },
  {
    args: (state) => {
      if (!state.firstTemplate) return null;
      return ["templates:get-template", "--id", state.firstTemplate.slug];
    },
    name: "public templates get first template",
    validate: (value, _result, state) => {
      assert.equal(value.slug, state.firstTemplate.slug);
      assert.equal(typeof value.title, "string", "templates:get-template should include title");
    },
  },
  {
    args: ["whoami", "--json"],
    name: "authenticated whoami",
    validate: (value) => {
      assert.equal(typeof value, "object");
      assert(value && typeof value.id === "string", "whoami response should include account id");
    },
  },
  {
    args: (state) =>
      state.includeSecretArgv ? ["whoami", "--api-key", state.liveApiKey, "--json"] : null,
    env: withoutEnvKey,
    name: "authenticated whoami with flag-only api key",
    validate: (value) => {
      assert.equal(typeof value, "object");
      assert(value && typeof value.id === "string", "flag-only whoami should include account id");
    },
  },
  {
    args: ["account:get-account"],
    env: savedCredentialsEnv,
    name: "authenticated account get with saved legacy credentials",
    validate: (value) => {
      assert(value && typeof value.id === "string", "saved credentials account:get-account should include account id");
    },
  },
  {
    args: ["account:get-account"],
    name: "generated account get",
    validate: (value) => {
      assert(value && typeof value.id === "string", "account:get-account should include account id");
    },
  },
  {
    args: ["account:get-account", "--envelope"],
    name: "generated account get envelope",
    validate: (value) => {
      assertEnvelope(value, "account:get-account --envelope");
      assert(value.data && typeof value.data.id === "string", "account:get-account envelope should include account id");
    },
  },
  {
    args: ["account:get-account", "--api-key", "prim_live_smoke_invalid"],
    expectedFailure: true,
    json: false,
    name: "generated account get rejects invalid api key",
    validate: (_value, result) => {
      if (!/(401|unauthorized|auth)/i.test(redactLiveOutput(result.stderr))) {
        throw new Error(
          `invalid API key stderr did not include 401/unauthorized/auth wording\n${formatCapturedOutput(result)}`,
        );
      }
    },
  },
  {
    args: ["account:get-storage-stats"],
    name: "account storage stats",
    validate: (value) => {
      assert(value && typeof value === "object", "account:get-storage-stats should print an object");
    },
  },
  {
    args: ["domains", "list", "--json"],
    name: "domains list",
    validate: (value) => {
      assert(Array.isArray(value), "domains list should print an array");
    },
  },
  {
    args: ["endpoints:list-endpoints"],
    name: "endpoints list",
    validate: (value) => {
      assert(Array.isArray(value), "endpoints:list-endpoints should print an array");
    },
  },
  {
    args: ["filters:list-filters"],
    name: "filters list",
    validate: (value) => {
      assert(Array.isArray(value), "filters:list-filters should print an array");
    },
  },
  {
    args: [
      "emails:search-emails",
      "--limit",
      "1",
      "--snippet",
      "false",
      "--include-facets",
      "false",
      "--sort",
      "received_at_desc",
    ],
    name: "generated emails search compact",
    validate: (value) => {
      assert(Array.isArray(value), "emails:search-emails should print an array");
      assert(value.length <= 1, "emails:search-emails --limit 1 should return at most one item");
    },
  },
  {
    args: ["webhook-deliveries:list-deliveries"],
    name: "webhook deliveries list",
    validate: (value) => {
      assert(Array.isArray(value), "webhook-deliveries:list-deliveries should print an array");
    },
  },
  {
    args: ["webhook-deliveries:list-deliveries", "--limit", "1", "--envelope"],
    name: "generated webhook deliveries list envelope",
    validate: (value) => {
      assertEnvelope(value, "webhook-deliveries:list-deliveries --envelope");
      assert(Array.isArray(value.data), "webhook-deliveries:list-deliveries envelope data should be an array");
      assert(value.data.length <= 1, "webhook-deliveries:list-deliveries --limit 1 should return at most one item");
    },
  },
  {
    args: ["templates:list-templates", "--limit", "1"],
    name: "generated templates list path-param seed",
    validate: (value, _result, state) => {
      const items = templateItems(value);
      assert(items, "templates:list-templates --limit 1 should print an array or an object with items");
      assert(items.length <= 1, "templates:list-templates --limit 1 should return at most one item");
      state.firstTemplateForGet = items.find((item) => item && typeof item.slug === "string") ?? null;
    },
  },
  {
    args: (state) => {
      if (!state.firstTemplateForGet) return null;
      return ["templates:get-template", "--id", state.firstTemplateForGet.slug];
    },
    name: "generated templates get path-param",
    validate: (value, _result, state) => {
      assert.equal(value.slug, state.firstTemplateForGet.slug);
      assert.equal(typeof value.id, "string", "templates:get-template should include id");
    },
  },
  {
    args: ["inbox", "status", "--json"],
    name: "inbox status",
    validate: (value) => {
      assert(value && typeof value === "object", "inbox status should print an object");
    },
  },
  {
    args: ["emails", "latest", "--limit", "1", "--json"],
    name: "emails latest",
    validate: (value) => {
      assert(value && typeof value === "object", "emails latest should print an envelope object");
    },
  },
  {
    args: ["sending", "list", "--limit", "1"],
    name: "sent emails list",
    validate: (value) => {
      assert(Array.isArray(value), "sending list should print an array");
    },
  },
  {
    args: ["sending:get-send-permissions"],
    name: "send permissions",
    validate: (value) => {
      assert(value && typeof value === "object", "sending:get-send-permissions should print an object");
    },
  },
  {
    args: ["functions", "list"],
    name: "functions list",
    validate: (value) => {
      assert(Array.isArray(value), "functions list should print an array");
    },
  },
  {
    args: ["routes", "list"],
    name: "routes list",
    validate: (value) => {
      assert(Array.isArray(value), "routes list should print an array");
    },
  },
  {
    args: ["wake", "schedules", "list"],
    name: "wake schedules list",
    validate: (value) => {
      assert(Array.isArray(value), "wake schedules list should print an array");
    },
  },
  {
    args: ["wake", "authorizations", "list"],
    name: "wake authorizations list",
    validate: (value) => {
      assert(Array.isArray(value), "wake authorizations list should print an array");
    },
  },
  {
    args: ["wake", "dispatches", "list"],
    name: "wake dispatches list",
    validate: (value) => {
      assert(Array.isArray(value), "wake dispatches list should print an array");
    },
  },
  {
    args: ["org", "secrets", "list"],
    name: "org secrets list",
    validate: (value) => {
      assert(Array.isArray(value), "org secrets list should print an array");
    },
  },
  {
    args: ["payments:list-payout-addresses"],
    name: "payments payout addresses list",
    validate: (value) => {
      assert(Array.isArray(value), "payments:list-payout-addresses should print an array");
    },
  },
  {
    args: ["payments:list-declined-payments"],
    name: "payments declined list",
    validate: (value) => {
      assert(Array.isArray(value), "payments:list-declined-payments should print an array");
    },
  },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const tmpRoot = mkdtempSync(path.join(tmpdir(), "primitive-rust-live-"));
  const state = {};
  try {
    const noKeyEnv = isolatedEnv(tmpRoot, options.apiBaseUrl, null);
    let noKeyCount = 0;
    for (const item of NO_KEY_CASES) {
      if (await runCase(options.rustBin, noKeyEnv, item, state)) {
        noKeyCount += 1;
      }
    }

    if (options.noKeyOnly) {
      process.stdout.write(`\n${noKeyCount} no-key case(s) passed; live cases skipped by request.\n`);
      return;
    }

    if (!process.env.PRIMITIVE_API_KEY) {
      process.stdout.write(`\n${noKeyCount} no-key case(s) passed.\n`);
      console.error("PRIMITIVE_API_KEY is required for live Rust CLI smoke tests.");
      console.error(
        `Live authenticated cases were skipped. Exiting ${EXIT_MISSING_API_KEY}; use --no-key-only for a local-only success exit.`,
      );
      process.exitCode = EXIT_MISSING_API_KEY;
      return;
    }

    assertSafeApiBaseUrl(options.apiBaseUrl, options.allowNonPrimitiveApiBaseUrl);

    state.apiBaseUrl = options.apiBaseUrl;
    state.includeSecretArgv = options.includeSecretArgv;
    state.liveApiKey = process.env.PRIMITIVE_API_KEY;
    const env = isolatedEnv(tmpRoot, options.apiBaseUrl, process.env.PRIMITIVE_API_KEY);
    let readOnlyCount = 0;
    for (const item of READ_ONLY_CASES) {
      if (await runCase(options.rustBin, env, item, state)) {
        readOnlyCount += 1;
      }
    }
    let mutatingCount = 0;
    if (options.includeMutating) {
      for (const item of buildMutatingCases(tmpRoot)) {
        if (await runCase(options.rustBin, env, item, state)) {
          mutatingCount += 1;
        }
      }
    }
    let emailE2eCount = 0;
    if (options.includeEmailE2e) {
      for (const item of buildEmailE2eCases()) {
        if (await runCase(options.rustBin, env, item, state)) {
          emailE2eCount += 1;
        }
      }
    }
    const mutatingSummary = options.includeMutating
      ? `, ${mutatingCount} mutating case(s)`
      : "";
    const emailE2eSummary = options.includeEmailE2e
      ? `, ${emailE2eCount} email e2e case(s)`
      : "";
    process.stdout.write(
      `\n${noKeyCount} no-key case(s), ${readOnlyCount} read-only case(s)${mutatingSummary}${emailE2eSummary} passed.\n`,
    );
  } finally {
    if (options.keepTmp) {
      process.stderr.write(`Kept temp directory: ${tmpRoot}\n`);
      if (process.env.PRIMITIVE_API_KEY && !options.noKeyOnly) {
        process.stderr.write("Warning: kept temp directory may contain live credentials.\n");
      }
    } else {
      rmSync(tmpRoot, { force: true, recursive: true });
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(EXIT_HARNESS_FAILURE);
});
