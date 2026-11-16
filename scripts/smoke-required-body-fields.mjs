import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-required-body-smoke-"));
const id = "11111111-1111-4111-8111-111111111111";
const requests = [];
const server = createServer(async (request, response) => {
  let raw = "";
  for await (const chunk of request) raw += chunk;
  requests.push({ path: request.url, body: raw ? JSON.parse(raw) : undefined });
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ success: true, data: { id } }));
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));
const address = server.address();
assert(address && typeof address === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("PRIMITIVE_")));
Object.assign(env, {
  HOME: config, XDG_CONFIG_HOME: config, PRIMITIVE_CONFIG_DIR: config,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_API_KEY: "prim_test_only",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
  NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
});
async function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
  });
}
const invite = ["organizations", "invite-organization-member"];
try {
  for (const args of [["organizations"], [...invite, "--help"]]) {
    const result = await run(args);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /invite-organization-member/);
  }
  for (const args of [[], ["--email", "member@example.com"]]) {
    const result = await run([...invite, ...args, "--json"]);
    assert.equal(result.code, 2, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    const document = JSON.parse(result.stdout);
    assert.equal(document.error.code, "usage_error");
    assert.equal(document.exit_code, 2);
    assert.deepEqual(document.error.details.missing, [
      { field: "request_id", flag: "--request-id", json_path: "$.request_id" },
      ...(args.length ? [] : [{ field: "email", flag: "--email", json_path: "$.email" }]),
    ]);
  }
  const human = await run(invite);
  assert.equal(human.code, 2, human.stdout + human.stderr);
  assert.match(human.stderr, /--request-id/);
  assert.match(human.stderr, /--email/);
  assert.equal(requests.length, 0, "invalid input must not send a request");
  const file = join(config, "invitation.json");
  await writeFile(file, JSON.stringify({ request_id: id, email: "old@example.com" }));
  const valid = await run([...invite, "--body-file", file, "--email", "member@example.com", "--json"]);
  assert.equal(valid.code, 0, valid.stdout + valid.stderr);
  assert.equal(valid.stderr, "");
  assert.equal(JSON.parse(valid.stdout).data.id, id);
  assert.deepEqual(requests, [{ path: "/v1/organization/invitations", body: { request_id: id, email: "member@example.com" } }]);
  console.log("Required body fields: parent/help, structured errors before requests, and merged input passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
