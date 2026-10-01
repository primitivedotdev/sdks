import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { createServer } from "node:http";

const runFile = promisify(execFile);
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const temp = mkdtempSync(join(tmpdir(), "primitive-enroll-smoke-"));
const env = { ...process.env, XDG_CONFIG_HOME: temp };
delete env.PRIMITIVE_API_KEY;
delete env.PRIMITIVE_KEY;
delete env.PRIMITIVE_AGENT_PROFILE;

async function invoke(args) {
  try {
    const result = await runFile(process.execPath, [binary, ...args], {
      env,
      timeout: 10000,
    });
    return { exit: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return { exit: error.code, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
}

try {
  const parent = await invoke(["agent"]);
  assert.equal(parent.exit, 0);
  assert.match(parent.stdout, /agent enroll/);

  const help = await invoke(["agent", "enroll", "--help"]);
  assert.equal(help.exit, 0);
  assert.match(help.stdout, /--session/);
  assert.match(help.stdout, /--receiver/);
  assert.match(help.stdout, /--continue-setup/);
  assert.match(help.stdout, /still pending/);
  assert.match(help.stdout, /connection list\s+for confirmed\s+pairing/);
  assert.match(help.stdout, /install a fail-open Stop hook/);

  const bare = await invoke(["agent", "enroll"]);
  assert.notEqual(bare.exit, 0);
  assert.match(bare.stderr, /required flag session/);

  const session = "11111111-1111-4111-8111-111111111111";
  const absent = await invoke(["agent", "enroll", "--session", session, "--receiver", "external"]);
  assert.notEqual(absent.exit, 0);
  assert.match(absent.stderr, /saved member OAuth login|Sign in/);

  const continuing = await invoke(["agent", "enroll", "--session", session, "--continue-setup", "--json"]);
  assert.notEqual(continuing.exit, 0);
  // With --json the refusal is in the one JSON document; stderr stays empty.
  assert.match(continuing.stdout, /saved member OAuth login|Sign in/);
  assert.doesNotMatch(continuing.stdout, /Nonexistent flags/);
  assert.equal(continuing.stderr, "");

  const accountParent = await invoke(["account"]);
  assert.equal(accountParent.exit, 0);
  assert.match(accountParent.stdout, /account whoami/);
  assert.match(accountParent.stdout, /account provision-member-address/);
  const authRequests = [];
  const authServer = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    authRequests.push({method:request.method, url:request.url, authorization:request.headers.authorization, body:raw ? JSON.parse(raw) : null});
    response.writeHead(401, {"Content-Type":"application/json"});
    response.end(JSON.stringify({success:false,error:{code:"unauthorized",message:"Invalid or missing API key"}}));
  });
  await new Promise(resolve => authServer.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${authServer.address().port}/v1`;
  try {
  for (const command of ["whoami", "provision-member-address"]) {
    const accountHelp = await invoke(["account", command, "--help"]);
    assert.equal(accountHelp.exit, 0);
    assert.match(accountHelp.stdout, new RegExp(`account ${command}`));
    const choice = command === "provision-member-address" ? ["--address", "person_123456789@example.test", "--confirm-existing-mail"] : [];
    if (command === "provision-member-address") {
      assert.match(accountHelp.stdout, /--address/);
      assert.match(accountHelp.stdout, /--confirm-existing-mail/);
      const bareProvision = await invoke(["account", command, "--api-base-url", origin]);
      assert.notEqual(bareProvision.exit, 0);
      assert.match(bareProvision.stderr, /address|body|payload/i);
    }
    const noLogin = await invoke(["account", command, ...choice, "--api-base-url", origin]);
    assert.notEqual(noLogin.exit, 0);
    assert.match(noLogin.stderr, /No API key|Sign in|sign in|credentials|Invalid or missing API key/);
  }

  assert.deepEqual(authRequests.map(({method,url})=>({method,url})), [
    {method:"GET",url:"/v1/whoami"}, {method:"PUT",url:"/v1/account/member-address"}]);
  assert.ok(authRequests.every(request=>request.authorization===undefined));
  assert.deepEqual(authRequests[1].body, {address:"person_123456789@example.test",confirm_existing_mail:true});
  } finally { await new Promise(resolve => authServer.close(resolve)); }
  const createHelp = await invoke(["agent-connections", "create-agent-connection", "--help"]);
  assert.equal(createHelp.exit, 0);
  assert.match(createHelp.stdout, /--create-request-id/);
  const inviteHelp = await invoke(["agent-connections", "invite-agent-connection", "--help"]);
  assert.equal(inviteHelp.exit, 0);
  assert.match(inviteHelp.stdout, /--pending-only/);

  const connectHelp = await invoke(["agent", "connect", "--help"]);
  assert.equal(connectHelp.exit, 0);
  assert.match(connectHelp.stdout, /fail-open Stop hook/);
  const mismatched = await invoke([
    "agent", "connect", "--profile", "isolated", "--session", session,
    "--receiver", "external", "--json",
  ]);
  assert.notEqual(mismatched.exit, 0);
  assert.match(mismatched.stdout, /exact Claude session ID/);
  assert.equal(mismatched.stderr, "");

  const connectionParent = await invoke(["agent-connections"]);
  assert.equal(connectionParent.exit, 0);
  for (const command of [
    "create-agent-connection",
    "list-agent-connections",
    "invite-agent-connection",
    "revoke-agent-connection",
    "remove-agent-connection",
    "claim-agent-connection",
    "agent-connection-setup",
  ]) {
    assert.match(connectionParent.stdout, new RegExp(`agent-connections ${command}`));
    const operationHelp = await invoke(["agent-connections", command, "--help"]);
    assert.equal(operationHelp.exit, 0, command);
    assert.match(operationHelp.stdout, new RegExp(`agent-connections ${command}`));
  }

  process.stdout.write("Built agent enrollment, invitation setup, and public connection management command shapes passed without network or account mutation.\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
