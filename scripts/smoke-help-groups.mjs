import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const config = await mkdtemp(join(tmpdir(), "primitive-help-groups-"));
let requests = 0;
let acceptInvitation = false;
const received = [];
const server = createServer(async (request, response) => {
  requests += 1;
  if (acceptInvitation && request.url === "/v1/organization/invitations" && request.method === "POST") {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    received.push(JSON.parse(raw));
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify({ success: true, data: { id: "invitation" } }));
    return;
  }
  response.writeHead(500).end();
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert(address && typeof address === "object");
const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(PRIMITIVE_|CLAUDE|CODEX)/.test(name)));
Object.assign(env, {
  HOME: config, XDG_CONFIG_HOME: config, PRIMITIVE_CONFIG_DIR: config,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1", PRIMITIVE_API_KEY: "prim_test_only",
  PRIMITIVE_API_BASE_URL: `http://127.0.0.1:${address.port}/v1`,
  NO_PROXY: "127.0.0.1,localhost", no_proxy: "127.0.0.1,localhost",
});
function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => { clearTimeout(timer); done({ code, stdout, stderr }); });
  });
}
const group = (text, heading) => text.split(`${heading}\n`)[1]?.split(/\n[A-Z][A-Z ]+\n/, 1)[0] ?? "";
try {
  const parent = await run(["organizations"]);
  assert.equal(parent.code, 0, parent.stderr);
  assert.match(parent.stdout, /invite-organization-member/);
  for (const mode of ["--help", "--help-full"]) {
    const invite = await run(["organizations", "invite-organization-member", mode]);
    assert.equal(invite.code, 0, invite.stderr);
    assert(invite.stdout.indexOf("REQUIRED INPUTS") < invite.stdout.indexOf("COMMAND OPTIONS"));
    assert(invite.stdout.indexOf("COMMAND OPTIONS") < invite.stdout.indexOf("COMMON FLAGS"));
    assert.match(group(invite.stdout, "REQUIRED INPUTS"), /--email/);
    assert.match(group(invite.stdout, "REQUIRED INPUTS"), /--request-id/);
    assert.match(group(invite.stdout, "COMMAND OPTIONS"), /--role/);
    for (const flag of ["--raw-body", "--idempotency-key", "--step-up-token"])
      assert(group(invite.stdout, "COMMON FLAGS").includes(flag));
    const note = await run(["address-notes", "put-address-note", mode]);
    assert.equal(note.code, 0, note.stderr);
    assert.match(group(note.stdout, "REQUIRED INPUTS"), /\$\.value/);
    const send = await run(["send", mode]);
    assert.equal(send.code, 0, send.stderr);
    assert.match(group(send.stdout, "COMMAND OPTIONS"), /--body-file/);
    assert.doesNotMatch(group(send.stdout, "COMMON FLAGS"), /--body-file/);
  }
  const short = await run(["send", "--help"]);
  assert(short.stdout.trimEnd().split("\n").length <= 40);
  assert(Buffer.byteLength(short.stdout) <= 3000);
  for (const line of short.stdout.split("\n")) assert(line.length <= 100);
  assert.equal(requests, 0, "help must not send API requests");
  const ignoredFile = await run(["organizations", "invite-organization-member", "--body-file", join(config, "absent.json"), "--help"]);
  assert.equal(ignoredFile.code, 0, ignoredFile.stderr);
  assert.equal(requests, 0);
  acceptInvitation = true;
  const requestId = "11111111-1111-4111-8111-111111111111";
  const bodyFile = join(config, "invitation.json");
  await writeFile(bodyFile, JSON.stringify({ request_id: requestId, email: "old@example.com" }));
  for (const args of [
    ["--raw-body", JSON.stringify({ request_id: requestId, email: "member@example.com" })],
    ["--body-file", bodyFile, "--email", "member@example.com"],
  ]) {
    const result = await run(["organizations", "invite-organization-member", ...args, "--json"]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stderr, "");
    assert.equal(JSON.parse(result.stdout).data.id, "invitation");
  }
  assert.equal(requests, 2, "valid JSON input must still work without individual required flags");
  assert.deepEqual(received, [0, 1].map(() => ({ request_id: requestId, email: "member@example.com" })));
  console.log("Help groups: rendering, budgets, no help requests, and actual JSON/file/flag API bodies passed.");
} finally {
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  await rm(config, { recursive: true, force: true });
}
