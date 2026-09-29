import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const runFile = promisify(execFile);
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const temp = mkdtempSync(join(tmpdir(), "primitive-disconnect-smoke-"));
const env = {
  ...process.env,
  XDG_CONFIG_HOME: temp,
  PRIMITIVE_API_KEY: ["local", "smoke"].join("-"),
};
delete env.PRIMITIVE_AGENT_PROFILE;

async function invoke(args) {
  try {
    const result = await runFile(process.execPath, [binary, ...args], {
      env,
      timeout: 10000,
    });
    return { exit: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exit: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

try {
  const topic = await invoke(["agent"]);
  assert.equal(topic.exit, 0);
  assert.match(topic.stdout, /agent disconnect/);

  const bare = await invoke(["agent", "disconnect"]);
  assert.notEqual(bare.exit, 0);
  assert.match(bare.stderr, /profile/i);

  const absent = await invoke(["agent", "disconnect", "--profile", `smoke-${Date.now()}`]);
  assert.notEqual(absent.exit, 0);
  assert.match(absent.stderr, /not configured/i);

  const help = await invoke(["agent", "disconnect", "--help"]);
  assert.equal(help.exit, 0);
  assert.match(help.stdout, /pinned Primitive\s+origin/);
  assert.match(help.stdout, /--profile/);

  const chatHelp = await invoke(["chat", "--help"]);
  assert.equal(chatHelp.exit, 0);
  assert.match(chatHelp.stdout, /--async/);
  const bareChat = await invoke(["chat"]);
  assert.notEqual(bareChat.exit, 0);
  const asyncWithoutProfile = await invoke(["chat", "peer@example.test", "Hello", "--async", "--api-key", ["local", "smoke"].join("-")]);
  assert.notEqual(asyncWithoutProfile.exit, 0);
  assert.match(asyncWithoutProfile.stderr, /--async requires a connected-agent profile/);

  process.stdout.write("Built agent disconnect and chat --async command shapes passed without network or mutation.\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
