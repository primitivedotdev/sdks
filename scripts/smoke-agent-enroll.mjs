import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

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

  const bare = await invoke(["agent", "enroll"]);
  assert.notEqual(bare.exit, 0);
  assert.match(bare.stderr, /required flag session/);

  const session = "11111111-1111-4111-8111-111111111111";
  const absent = await invoke(["agent", "enroll", "--session", session, "--receiver", "external"]);
  assert.notEqual(absent.exit, 0);
  assert.match(absent.stderr, /saved owner OAuth login|Sign in/);

  process.stdout.write("Built agent enrollment command shapes passed without network or account mutation.\n");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
