// Packaged smoke for one-command `agent connect`: the installed tarball must
// carry the bundled primitive-connect skill, install it for the detected
// runtime before any claim, and leave it untouched on a repeat run.
import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const binary = resolve(process.argv[2] ?? "cli-node/bin/run.js");
const packageRoot = resolve(dirname(binary), "..", "primitive");
const installedRoot = statSync(join(packageRoot, "package.json"), { throwIfNoEntry: false })
  ? packageRoot
  : resolve(dirname(binary), "..");
const temp = mkdtempSync(join(tmpdir(), "primitive-connect-smoke-"));
const session = "11111111-1111-4111-8111-111111111111";
const base = { ...process.env, XDG_CONFIG_HOME: join(temp, "config") };
for (const name of [
  "PRIMITIVE_API_KEY",
  "PRIMITIVE_KEY",
  "PRIMITIVE_AGENT_PROFILE",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CONFIG_DIR",
  "CODEX_THREAD_ID",
  "CODEX_SESSION_ID",
  "CODEX_HOME",
])
  delete base[name];

function invoke(args, env, stdin) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [binary, ...args], { env: { ...base, ...env } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (exit) => resolveRun({ exit, stdout, stderr }));
    child.stdin.end(stdin ?? "");
  });
}

function tree(root) {
  const out = {};
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
      else out[relative] = createHash("sha256").update(readFileSync(join(directory, entry.name))).digest("hex");
    }
  };
  walk(root, "");
  return out;
}

try {
  const manifest = JSON.parse(
    readFileSync(join(installedRoot, "dist", "skills", "primitive-connect.json"), "utf8"),
  );
  const bundled = tree(join(installedRoot, "dist", "skills", "primitive-connect"));
  assert.equal(manifest.name, "primitive-connect");
  assert.deepEqual(bundled, manifest.files);
  assert.match(readFileSync(join(installedRoot, "dist", "skills", "primitive-connect", "SKILL.md"), "utf8"), /## Connect in one command/);

  const help = await invoke(["agent", "connect", "--help"]);
  assert.equal(help.exit, 0);
  for (const flag of ["--name", "--info", "--[no-]skill", "--project", "--session", "--resume"])
    assert.ok(help.stdout.includes(flag), `agent connect --help lacks ${flag}`);
  assert.match(help.stdout, /in one call/);

  // Codex without a native session socket: the skill installs, then setup
  // stops before any claim.
  const codexHome = join(temp, "codex");
  const codex = await invoke(
    ["agent", "connect", "--session", session, "--json"],
    { CODEX_THREAD_ID: session, CODEX_HOME: codexHome },
    "https://api.primitive.dev/v1/agent-connections/setup#token=smoke\n",
  );
  assert.notEqual(codex.exit, 0);
  assert.match(codex.stdout, /No invitation was claimed/);
  assert.doesNotMatch(codex.stdout + codex.stderr, /token=smoke/);
  const codexSkill = join(codexHome, "skills", "primitive-connect");
  assert.deepEqual(tree(codexSkill), bundled);
  const firstMtime = statSync(join(codexSkill, "SKILL.md")).mtimeMs;
  await invoke(
    ["agent", "connect", "--session", session, "--json"],
    { CODEX_THREAD_ID: session, CODEX_HOME: codexHome },
    "https://api.primitive.dev/v1/agent-connections/setup#token=smoke\n",
  );
  assert.equal(statSync(join(codexSkill, "SKILL.md")).mtimeMs, firstMtime);
  assert.deepEqual(readdirSync(join(codexHome, "skills")), ["primitive-connect"]);

  // Claude: an invitation for an unofficial origin is refused before any
  // request, after the skill is in place.
  const claudeDir = join(temp, "claude");
  const claude = await invoke(
    ["agent", "connect", "--session", session, "--json"],
    { CLAUDE_CODE_SESSION_ID: session, CLAUDE_CONFIG_DIR: claudeDir },
    "https://example.test/v1/agent-connections/setup#token=smoke\n",
  );
  assert.notEqual(claude.exit, 0);
  assert.doesNotMatch(claude.stdout + claude.stderr, /token=smoke/);
  assert.deepEqual(tree(join(claudeDir, "skills", "primitive-connect")), bundled);

  const declined = await invoke(
    ["agent", "connect", "--session", session, "--no-skill", "--json"],
    { CODEX_THREAD_ID: session, CODEX_HOME: join(temp, "declined") },
    "https://api.primitive.dev/v1/agent-connections/setup#token=smoke\n",
  );
  assert.notEqual(declined.exit, 0);
  assert.throws(() => statSync(join(temp, "declined")));
  console.error("agent connect smoke OK");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
