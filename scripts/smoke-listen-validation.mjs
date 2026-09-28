import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const directory = await mkdtemp(join(tmpdir(), "primitive-listen-validation-"));
const env = {
  ...process.env,
  PRIMITIVE_CONFIG_DIR: directory,
  XDG_CONFIG_HOME: directory,
  PRIMITIVE_SKIP_NEW_VERSION_CHECK: "1",
};
for (const key of [
  "PRIMITIVE_API_KEY",
  "PRIMITIVE_API_BASE_URL",
  "PRIMITIVE_API_HEADERS",
])
  delete env[key];
async function run(args) {
  return new Promise((done, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      cwd: directory,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
    child.stdout.on("data", (bytes) => {
      stdout += bytes;
    });
    child.stderr.on("data", (bytes) => {
      stderr += bytes;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timer);
      done({
        code,
        stdout,
        stderr: stderr.replace(/^\s*›\s*/gm, "").replace(/\s+/g, " "),
      });
    });
  });
}
try {
  const help = await run(["listen", "--help"]);
  assert.equal(help.code, 0, help.stderr);
  assert.match(help.stdout, /--notify-session/);
  const session = "11111111-1111-4111-8111-111111111111";
  for (const [flag, value, message] of [
    ["--transport", "poll", /requires --transport websocket/],
    ["--subscription", "custom", /omit --subscription/],
  ]) {
    const result = await run([
      "listen",
      "--notify-session",
      session,
      "--sender",
      "peer@example.com",
      flag,
      value,
    ]);
    assert.notEqual(result.code, 0);
    assert.match(
      result.stderr.replace(/^\s*›\s*/gm, "").replace(/\s+/g, " "),
      message,
    );
    assert.doesNotMatch(
      result.stderr,
      /sign.?in|native socket|private socket|API key is required/i,
    );
  }
  const reserved = await run([
    "listen",
    "--subscription",
    "local-mail-11111111-1111-4111-8111-111111111111",
  ]);
  assert.notEqual(reserved.code, 0);
  assert.match(reserved.stderr, /reserved for shared mail receiving/);
  console.log(
    "Listener packaged validation passed: help and incompatible native transport/subscription options before authentication.",
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
