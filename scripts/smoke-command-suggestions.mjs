import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-command-suggestions-"));
let requests = 0;
let allowLiteralSearch = false;
const literalQueries = [];
const server = createServer((request, response) => {
  requests += 1;
  const url = new URL(request.url, "http://127.0.0.1");
  if (allowLiteralSearch && url.pathname === "/v1/emails/search") {
    literalQueries.push(url.searchParams.get("q"));
    response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ success: true, data: [], meta: {} }));
    return;
  }
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
    [["webhook-deliveries", "get-delivery"], "primitive webhook-deliveries get"],
    [["orgs"], "primitive org list"],
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
  // Load the same published map the built binary uses. Every retired spelling
  // must fail before authentication or a request, including collapsed aliases.
  const { COMMAND_RENAMES, COMMANDS } = await import(pathToFileURL(resolve(dirname(binary), "../dist/oclif/index.js")).href);
  const retired = Object.entries(COMMAND_RENAMES);
  let next = 0;
  await Promise.all(Array.from({ length: 2 }, async () => {
    while (next < retired.length) {
      const [oldId, newId] = retired[next++];
      const result = await run([...oldId.split(":"), "--json"]);
      assert.equal(result.code, 2, `${oldId}: ${result.stdout}${result.stderr}`);
      assert.equal(result.stderr, "", oldId);
      const document = JSON.parse(result.stdout);
      assert.equal(document.error.code, "command_not_found", oldId);
      const replacement = `primitive ${newId.replaceAll(":", " ")}`;
      if (!COMMANDS[newId].hidden)
        assert(document.error.details?.suggestions.includes(replacement), `${oldId}: ${result.stdout}`);
      else
        assert(!document.error.details?.suggestions?.includes(replacement), `${oldId}: hidden command suggested`);
    }
  }));
  for (const oldId of ["emails:get-email", "functions:test-function", "account:show"]) {
    const result = await run([oldId, "--json"]);
    assert.equal(result.code, 2, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).error.code, "command_not_found");
  }
  for (const command of ["create", "update", "test", "test-sample", "generate-look-alikes", "compile"]) {
    const help = await run(["email-rules", command, "--help-full"]);
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout, /--scope[\s=]/);
    assert.doesNotMatch(help.stdout, /--evaluation-scope/);
    const oldFlag = await run(["email-rules", command, "--evaluation-scope", "author", "--json"]);
    assert.equal(oldFlag.code, 2, oldFlag.stdout + oldFlag.stderr);
    assert.match(oldFlag.stdout, /evaluation-scope/);
  }
  for (const [command, retiredFlag] of [
    ["create", "--expectation-samples-file"],
    ["update", "--add-expectation-samples-file"],
    ["accept-request", "--expectation-samples-file"],
  ]) {
    const oldFlag = await run(["email-rules", command, retiredFlag, join(config, "absent.json"), "--json"]);
    assert.equal(oldFlag.code, 2, oldFlag.stdout + oldFlag.stderr);
    assert(oldFlag.stdout.includes(retiredFlag.slice(2)), oldFlag.stdout);
  }
  for (const [command, wrongFlag, target, meaning] of [
    ["test", "samples-file", "expect-samples-file", "one-off test samples"],
    ["create", "expect-samples-file", "samples-file", "samples saved on the rule"],
  ]) {
    const wrongSample = await run(["email-rules", command, `--${wrongFlag}`, join(config, "absent.json"), "--json"]);
    assert.equal(wrongSample.code, 2, wrongSample.stdout + wrongSample.stderr);
    assert.equal(wrongSample.stderr, "");
    const message = JSON.parse(wrongSample.stdout).error.message;
    assert(message.includes(`Nonexistent flag: --${wrongFlag}`), message);
    assert(message.includes(`did you mean --${target}`), message);
    assert(message.includes(meaning), message);
  }
  const bothSamples = await run([
    "email-rules", "update", "--id", "00000000-0000-4000-8000-000000000001",
    "--samples-file", join(config, "absent.json"),
    "--add-samples-file", join(config, "absent.json"), "--json",
  ]);
  assert.equal(bothSamples.code, 2, bothSamples.stdout + bothSamples.stderr);
  assert.match(bothSamples.stdout, /samples-file/);
  assert.match(bothSamples.stdout, /add-samples-file/);
  const plain = await run(["webhook-deliveries", "get-delivery"]);
  assert.equal(plain.code, 2);
  assert.equal(plain.stdout, "");
  assert.match(plain.stderr, /Did you mean "primitive webhook-deliveries get"/);
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
  allowLiteralSearch = true;
  const literal = await run(["search", "--all-domains", "--json", "--", "semantic-search"]);
  assert.equal(literal.code, 0, literal.stdout + literal.stderr);
  assert.equal(literal.stderr, "");
  assert.equal(JSON.parse(literal.stdout).success, true);
  assert.deepEqual(literalQueries, ["semantic-search"]);
  assert.equal(requests, 1, "only the explicit literal search may send a request");
  console.log(`Command suggestions: ${retired.length} retired spellings, renamed flags, help, and suggestions sent no requests; explicit literal search passed.`);
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
