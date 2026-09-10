import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-pull-smoke-"));
const id = "11111111-1111-4111-8111-111111111111";
const requests = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  requests.push({ method: request.method, path: request.url, body: JSON.parse(raw) });
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data: request.url.endsWith("/pull")
    ? { delivery: null, backlog: 0, gap_count: 0, last_gap_reason: null, retention_seconds: 86400, handler_timeout_seconds: 30 }
    : { result: "completed" } }));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object");
const base = `http://127.0.0.1:${address.port}/v1`;
async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      env: { ...process.env, XDG_CONFIG_HOME: config, PRIMITIVE_CONFIG_DIR: config,
        PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_API_KEY: "prim_test_only",
        NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost" },
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
  for (const args of [["endpoints"], ["endpoints", "pull-webhook-event", "--help"], ["endpoints", "complete-webhook-event", "--help"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /pull-webhook-event|complete-webhook-event/);
  }
  const create = await run(["endpoints", "create", "--kind", "pull", "--name", "local-agent", "--api-base-url", base]);
  assert.equal(create.code, 0, create.output);
  const pull = await run(["endpoints", "pull-webhook-event", "--id", id, "--wait-seconds", "0", "--api-base-url", base]);
  assert.equal(pull.code, 0, pull.output);
  const bodies = [
    { queue_id: id, delivery_id: id, lease_token: id, mode: "stdout", write_succeeded: true, duration_ms: 1 },
    { queue_id: id, delivery_id: id, lease_token: id, mode: "exec", exit_code: 0, duration_ms: 1 },
    { queue_id: id, delivery_id: id, lease_token: id, mode: "http", status_code: 204, confirmed: false, duration_ms: 1 },
  ];
  for (const body of bodies) {
    const complete = await run(["endpoints", "complete-webhook-event", "--id", id, "--raw-body", JSON.stringify(body), "--api-base-url", base]);
    assert.equal(complete.code, 0, complete.output);
  }
  assert.deepEqual(requests, [
    { method: "POST", path: "/v1/endpoints", body: { kind: "pull", name: "local-agent" } },
    { method: "POST", path: `/v1/endpoints/${id}/pull`, body: { wait_seconds: 0 } },
    ...bodies.map((body) => ({ method: "POST", path: `/v1/endpoints/${id}/complete`, body })),
  ]);
  console.log("Pull API commands: parent/help, named creation, pull, and all completion modes passed.");
} finally {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await rm(config, { recursive: true, force: true });
}
