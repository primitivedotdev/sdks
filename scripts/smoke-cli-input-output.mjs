import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-input-output-"));
const id = "11111111-1111-4111-8111-111111111111";
const row = { id, from_address: "sender@example.com", to_address: "reader@example.com", subject: "Example", status: "sent" };
const requests = [];
const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  const url = new URL(request.url, "http://localhost");
  requests.push({ path: url.pathname, body: body ? JSON.parse(body) : undefined });
  const data = url.pathname === "/v1/activity/objects"
    ? { covers: "you", items: [row], withheld: [], next_cursor: "next" }
    : url.pathname === "/v1/email-rules/covering-me" || url.pathname === "/v1/sent-emails"
      ? [row] : { id };
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ success: true, data, meta: { cursor: "next" } }));
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(PRIMITIVE_|CLAUDE|CODEX|HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|http_proxy|https_proxy|all_proxy)/.test(key)));
Object.assign(env, { HOME: config, XDG_CONFIG_HOME: config, PRIMITIVE_CONFIG_DIR: config,
  SHELL: "/bin/bash",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
  PRIMITIVE_API_KEY: "fixture-only", PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1" });

async function run(args, input = "incidental loop input\n", keepOpen = false) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.stdin.on("error", () => {}); // A command may exit without consuming the pipe.
    if (keepOpen) child.stdin.write(input);
    else child.stdin.end(input);
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); child.stdin.destroy(); done({ code, stdout, stderr }); });
  });
}
try {
  for (const args of [
    ["email-rules", "get", "--id", id],
    ["email-rules", "list-versions", "--id", id],
    ["email-rules", "get-scope", "--id", id],
    ["emails", "get", "--id", id],
    ["describe", "getEmailRule"],
  ]) {
    const result = await run([...args, "--json"], undefined, true);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    JSON.parse(result.stdout);
  }
  const before = requests.length;
  const pluginHelp = await run(["help"], undefined, true);
  assert.equal(pluginHelp.code, 0, pluginHelp.stdout + pluginHelp.stderr);
  assert.match(pluginHelp.stdout, /USAGE/);
  const pluginArgument = await run(["autocomplete", "script"]);
  assert.equal(pluginArgument.code, 0, pluginArgument.stdout + pluginArgument.stderr);
  assert.match(pluginArgument.stdout, /PRIMITIVE_AC_BASH_SETUP_PATH=/);
  assert.equal(requests.length, before);
  const missing = await run(["email-rules", "get", "--json"]);
  assert.equal(missing.code, 2, missing.stdout + missing.stderr);
  assert.equal(requests.length, before, "stdin must not substitute for a missing id");
  const conflict = await run(["email-rules", "get", "other-id", "--id", id, "--json"]);
  assert.equal(conflict.code, 2, conflict.stdout + conflict.stderr);
  assert.equal(requests.length, before, "conflicting argv ids still fail before requests");
  for (const args of [["activity", "concerning"], ["email-rule-oversight", "list-covering-me"], ["sent", "list"]]) {
    const result = await run([...args, "--json"]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.deepEqual(document.data, [row]);
    assert.equal(document.meta.cursor, "next");
  }
  const human = await run(["sent", "list"]);
  assert.equal(human.code, 0, human.stdout + human.stderr);
  assert.match(human.stdout, /^FROM\s+TO\s+STATUS/m);
  assert.match(human.stdout, /Example/);
  assert.equal(human.stderr, "next cursor: next\n");
  const body = "  body from stdin\nsecond line\n";
  const sent = await run(["send", "--from", "sender@example.com", "--to", "reader@example.com", "--subject", "Example", "--body-stdin", "--json"], body);
  assert.equal(sent.code, 0, sent.stdout + sent.stderr);
  assert.equal(requests.findLast((request) => request.path === "/v1/send-mail")?.body?.body_text, body);
  const help = await run(["email-rules", "delete-request", "--help"]);
  assert.equal(help.code, 0, help.stdout + help.stderr);
  assert.match(help.stdout, /withdrawn or declined/);
  console.log("CLI input/output: open pipes, ids, JSON envelopes, sent table, explicit body stdin and delete-request help passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
