import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-command-suggestions-"));
let requests = 0;
const server = createServer((_request, response) => {
  requests += 1;
  response.writeHead(500).end();
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("PRIMITIVE_")));
Object.assign(env, {
  HOME: config,
  PRIMITIVE_CONFIG_DIR: config,
  XDG_CONFIG_HOME: config,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
  PRIMITIVE_API_KEY: "prim_test_only",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
  NO_PROXY: "127.0.0.1,localhost",
  no_proxy: "127.0.0.1,localhost",
});

function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}

try {
  for (const parent of ["webhook-deliveries", "org", "emails", "agent"]) {
    const result = await run([parent]);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /COMMANDS|USAGE/);
  }
  for (const [args, expected] of [
    [["webhook-deliveries", "get"], "primitive webhook-deliveries get-delivery"],
    [["org", "list"], "primitive orgs"],
    [["mail"], "primitive emails --help"],
    [["serach"], "primitive search"],
    [["emails", "lsit"], "primitive emails list"],
    [["agent", "contcts", "list"], "primitive agent contacts --help"],
  ]) {
    const result = await run([...args, "--json"]);
    assert.equal(result.code, 2, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "command_not_found");
    assert.equal(document.exit_code, 2);
    assert(document.error.details.suggestions.includes(expected), result.stdout);
    assert(document.error.details.suggestions.length <= 3);
    const help = await run([...expected.split(" ").slice(1), ...(expected.endsWith("--help") ? [] : ["--help"])]);
    assert.equal(help.code, 0, help.stdout + help.stderr);
  }
  const plain = await run(["webhook-deliveries", "get"]);
  assert.equal(plain.code, 2);
  assert.equal(plain.stdout, "");
  assert.match(plain.stderr, /Did you mean "primitive webhook-deliveries get-delivery"/);
  const extra = await run(["emails", "list", "private-value", "--json"]);
  assert.equal(extra.code, 2);
  const error = JSON.parse(extra.stdout).error;
  assert.equal(error.code, "unexpected_argument");
  assert.equal(error.details?.suggestions, undefined);
  const hidden = await run(["confg", "--json"]);
  assert.equal(hidden.code, 2);
  assert.equal(hidden.stderr, "");
  assert.equal(JSON.parse(hidden.stdout).error.details?.suggestions, undefined);
  assert.equal(requests, 0, "command mistakes and help must not send requests");
  console.log("Command suggestions: real parents, nearby commands, JSON errors, and no requests passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
