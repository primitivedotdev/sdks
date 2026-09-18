import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-delete-smoke-"));
const id = "11111111-1111-4111-8111-111111111111";
const address = "agent+demo@example.com";
const requests = [];
let responseStatus = 200;
let responseCode = "sent_email_not_settled";
const server = createServer(async (request, response) => {
  let body = "";
  for await (const chunk of request) body += chunk;
  requests.push({ method: request.method, path: request.url, body });
  response.writeHead(responseStatus, { "Content-Type": "application/json" });
  response.end(JSON.stringify(responseStatus === 200
    ? { success: true, data: { deleted: true } }
    : { success: false, error: { code: responseCode, message: "Request refused", details: { idempotent_replay: responseStatus === 410 } } }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const bound = server.address();
assert(bound && typeof bound === "object");
const base = `http://127.0.0.1:${bound.port}/v1`;
async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      env: { ...process.env, PRIMITIVE_CONFIG_DIR: config, XDG_CONFIG_HOME: config,
        PRIMITIVE_API_KEY: ["fixture", "credential"].join("-"),
        PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", reject);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, output }); });
  });
}
try {
  for (const args of [["sent"], ["sending"], ["agent-connections"], ["sent", "delete", "--help"], ["sending", "delete-sent-email", "--help"], ["agent-connections", "remove-agent-connection", "--help"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /delete|remove-agent-connection/);
  }
  for (const args of [["sent", "delete", "--id", id], ["sending", "delete-sent-email", "--id", id], ["agent-connections", "remove-agent-connection", "--address", address]]) {
    const result = await run([...args, "--api-base-url", base]);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /"deleted": true/);
  }
  assert.deepEqual(requests, [
    { method: "DELETE", path: `/v1/sent-emails/${id}`, body: "" },
    { method: "DELETE", path: `/v1/sent-emails/${id}`, body: "" },
    { method: "POST", path: `/v1/agent-connections/${encodeURIComponent(address)}/remove`, body: "" },
  ]);
  for (const [status, code, args] of [
    [409, "sent_email_not_settled", ["sent", "delete", "--id", id]],
    [503, "sent_email_cleanup_failed", ["sent", "delete", "--id", id]],
    [403, "forbidden", ["agent-connections", "remove-agent-connection", "--address", address]],
    [409, "connection_not_revoked", ["agent-connections", "remove-agent-connection", "--address", address]],
    [410, "sent_email_deleted", ["sending", "send-email", "--from", "sender@example.com", "--to", "receiver@example.com", "--subject", "Example", "--body-text", "Hello"]],
  ]) {
    responseStatus = status;
    responseCode = code;
    const before = requests.length;
    const result = await run([...args, "--api-base-url", base]);
    assert.notEqual(result.code, 0, result.output);
    assert.match(result.output, new RegExp(code));
    assert.equal(requests.length, before + 1, "Refusals must not retry or change the key");
  }
  console.log("Mailbox deletion commands: parent/help, sent alias, revoked connection, errors and no-retry checks passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await rm(config, { recursive: true, force: true });
}
