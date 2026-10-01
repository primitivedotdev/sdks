import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "vitest";
import {
  claudeWakeHookStatus,
  installClaudeWakeHook,
  uninstallClaudeWakeHook,
} from "../../src/oclif/claude-wake-install.js";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "primitive-claude-hook-"));
  const bin = join(root, "bin");
  const claudeDir = join(root, "claude");
  const configDir = join(root, "primitive");
  mkdirSync(bin);
  mkdirSync(claudeDir);
  mkdirSync(configDir);
  const cliPath = join(bin, "run.js");
  writeFileSync(cliPath, "", { mode: 0o600 });
  writeFileSync(join(bin, "claude-wake.mjs"), "", { mode: 0o600 });
  writeFileSync(join(bin, "claude-pending-mail.mjs"), "", { mode: 0o600 });
  return { root, claudeDir, configDir, cliPath };
}

test("external hook installer preserves other settings and replaces only its own entry", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const original = {
    permissions: { allow: ["Bash(ls *)"] },
    hooks: {
      Stop: [
        { hooks: [{ type: "command", command: "true" }] },
        {
          hooks: [
            {
              type: "command",
              command: process.execPath,
              args: ["/other/claude-wake.mjs", "/other/run.js", configDir],
            },
          ],
        },
      ],
      SessionStart: [
        { matcher: "resume", hooks: [{ type: "command", command: "true" }] },
      ],
      PreToolUse: [{ matcher: "Bash", hooks: [] }],
    },
  };
  writeFileSync(settingsPath, JSON.stringify(original));
  const options = {
    cliPath,
    configDir,
    profileName: "session-a",
    agentAddress: "a@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const once = readFileSync(settingsPath, "utf8");
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  assert.equal(readFileSync(settingsPath, "utf8"), once);
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.deepEqual(settings.permissions, original.permissions);
  assert.deepEqual(settings.hooks.PreToolUse, original.hooks.PreToolUse);
  assert.deepEqual(
    settings.hooks.SessionStart[0],
    original.hooks.SessionStart[0],
  );
  assert.deepEqual(settings.hooks.Stop[0], original.hooks.Stop[0]);
  assert.deepEqual(settings.hooks.Stop[1], original.hooks.Stop[1]);
  assert.equal(settings.hooks.Stop.length, 3);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.PostToolUse.length, 1);
  assert.equal(settings.hooks.SessionStart[1].matcher, "resume");
  const hook = settings.hooks.Stop[2].hooks[0];
  assert.deepEqual(settings.hooks.SessionStart[1].hooks[0], hook);
  assert.equal(hook.asyncRewake, true);
  assert.equal(hook.timeout, 604800);
  assert.deepEqual(hook.args, [
    realpathSync(join(dirname(cliPath), "claude-wake.mjs")),
    realpathSync(cliPath),
    configDir,
    "session-a",
    "a@example.com",
    sessionA,
    "primitive-agent-wake-v1",
  ]);
  assert.deepEqual(settings.hooks.PostToolUse[0].hooks[0].args, [
    realpathSync(join(dirname(cliPath), "claude-pending-mail.mjs")),
    realpathSync(cliPath),
    configDir,
    "session-a",
    "a@example.com",
    sessionA,
    "primitive-pending-mail-v1",
  ]);
  assert.deepEqual(claudeWakeHookStatus(options), {
    installed: true,
    lastFiredAt: null,
    liveness: "unknown",
  });
  const firedAt = "2026-10-01T15:00:00.000Z";
  writeMailJson(
    join(
      agentProfileDirectory(configDir, "session-a"),
      `pending-mail-${sessionA}.fired.json`,
    ),
    { version: 1, at: firedAt },
  );
  assert.deepEqual(claudeWakeHookStatus(options), {
    installed: true,
    lastFiredAt: firedAt,
    liveness: "unknown",
  });
});

test("external hook installer leaves malformed existing settings untouched", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  writeFileSync(settingsPath, "{invalid");
  assert.equal(
    installClaudeWakeHook({
      cliPath,
      configDir,
      profileName: "session-a",
      agentAddress: "a@example.com",
      sessionId: sessionA,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    "unavailable",
  );
  assert.equal(readFileSync(settingsPath, "utf8"), "{invalid");
  writeFileSync(settingsPath, "{}");
  assert.equal(
    installClaudeWakeHook({
      cliPath,
      configDir,
      profileName: "session-a",
      agentAddress: "a@example.com",
      sessionId: sessionA,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    "installed_unverified",
  );
  assert.equal(
    JSON.parse(readFileSync(settingsPath, "utf8")).hooks.Stop.length,
    1,
  );
  assert.equal(
    JSON.parse(readFileSync(settingsPath, "utf8")).hooks.SessionStart.length,
    1,
  );
  assert.equal(
    JSON.parse(readFileSync(settingsPath, "utf8")).hooks.PostToolUse.length,
    1,
  );
});

test("malformed SessionStart settings fail closed for install and uninstall", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const original = JSON.stringify({ hooks: { Stop: [], SessionStart: {} } });
  writeFileSync(settingsPath, original);
  const options = {
    cliPath,
    configDir,
    profileName: "session-a",
    agentAddress: "a@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(installClaudeWakeHook(options), "unavailable");
  assert.equal(uninstallClaudeWakeHook(options), false);
  assert.equal(readFileSync(settingsPath, "utf8"), original);
});

test("external hook installer keeps sibling hooks and entry metadata", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const sibling = { type: "command", command: "true" };
  writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        Stop: [
          {
            matcher: "",
            custom: "keep",
            hooks: [
              {
                type: "command",
                command: process.execPath,
                args: [
                  realpathSync(join(dirname(cliPath), "claude-wake.mjs")),
                  realpathSync(cliPath),
                  configDir,
                  "session-a",
                  "a@example.com",
                  sessionA,
                  "primitive-agent-wake-v1",
                ],
              },
              sibling,
            ],
          },
        ],
        SessionStart: [
          {
            matcher: "resume",
            custom: "keep",
            hooks: [
              {
                type: "command",
                command: process.execPath,
                args: [
                  realpathSync(join(dirname(cliPath), "claude-wake.mjs")),
                  realpathSync(cliPath),
                  configDir,
                  "session-a",
                  "a@example.com",
                  sessionA,
                  "primitive-agent-wake-v1",
                ],
              },
              sibling,
            ],
          },
        ],
      },
    }),
  );
  assert.equal(
    installClaudeWakeHook({
      cliPath,
      configDir,
      profileName: "session-a",
      agentAddress: "a@example.com",
      sessionId: sessionA,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    "installed_unverified",
  );
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.equal(settings.hooks.Stop.length, 2);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.PostToolUse.length, 1);
  assert.deepEqual(settings.hooks.SessionStart[0], {
    matcher: "resume",
    custom: "keep",
    hooks: [sibling],
  });
  assert.equal(settings.hooks.SessionStart[1].matcher, "resume");
  assert.deepEqual(settings.hooks.Stop[0], {
    matcher: "",
    custom: "keep",
    hooks: [sibling],
  });
  assert.equal(
    settings.hooks.Stop[1].hooks[0].args[6],
    "primitive-agent-wake-v1",
  );
  assert.equal(
    uninstallClaudeWakeHook({
      configDir,
      profileName: "session-a",
      agentAddress: "a@example.com",
      sessionId: sessionA,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    true,
  );
  const removed = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.deepEqual(removed.hooks.SessionStart, [
    { matcher: "resume", custom: "keep", hooks: [sibling] },
  ]);
  assert.deepEqual(removed.hooks.Stop, [
    { matcher: "", custom: "keep", hooks: [sibling] },
  ]);
});

test("two exact Claude sessions retain separate hooks and reinstallation changes only its own", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const options = {
    cliPath,
    configDir,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(
    installClaudeWakeHook({
      ...options,
      profileName: "first",
      agentAddress: "first@example.com",
      sessionId: sessionA,
    }),
    "installed_unverified",
  );
  assert.equal(
    installClaudeWakeHook({
      ...options,
      profileName: "second",
      agentAddress: "second@example.com",
      sessionId: sessionB,
    }),
    "installed_unverified",
  );
  assert.equal(
    installClaudeWakeHook({
      ...options,
      profileName: "first-updated",
      agentAddress: "first@example.com",
      sessionId: sessionA,
    }),
    "installed_unverified",
  );
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  assert.equal(settings.hooks.Stop.length, 2);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.PostToolUse.length, 2);
  assert.deepEqual(
    settings.hooks.Stop.map(
      (entry: { hooks: Array<{ args: string[] }> }) => entry.hooks[0].args[5],
    ).sort(),
    [sessionA, sessionB],
  );
  assert.deepEqual(
    settings.hooks.SessionStart.map(
      (entry: { hooks: Array<{ args: string[] }> }) => entry.hooks[0].args[5],
    ).sort(),
    [sessionA, sessionB],
  );
  assert.ok(
    settings.hooks.SessionStart.every(
      (entry: { matcher: string }) => entry.matcher === "resume",
    ),
  );
  assert.equal(
    settings.hooks.Stop.find(
      (entry: { hooks: Array<{ args: string[] }> }) =>
        entry.hooks[0].args[5] === sessionB,
    ).hooks[0].args[3],
    "second",
  );
});

test("uninstall removes only the exact profile and session and is idempotent", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const base = { cliPath, configDir, env: { CLAUDE_CONFIG_DIR: claudeDir } };
  const first = {
    ...base,
    profileName: "first",
    agentAddress: "first@example.com",
    sessionId: sessionA,
  };
  const second = {
    ...base,
    profileName: "second",
    agentAddress: "second@example.com",
    sessionId: sessionB,
  };
  assert.equal(installClaudeWakeHook(first), "installed_unverified");
  assert.equal(installClaudeWakeHook(second), "installed_unverified");
  const settingsPath = join(claudeDir, "settings.json");
  assert.equal(
    uninstallClaudeWakeHook({ ...first, sessionId: sessionB }),
    true,
  );
  let settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.equal(settings.hooks.Stop.length, 2);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(uninstallClaudeWakeHook(first), true);
  const once = readFileSync(settingsPath, "utf8");
  assert.equal(uninstallClaudeWakeHook(first), true);
  assert.equal(readFileSync(settingsPath, "utf8"), once);
  settings = JSON.parse(once);
  assert.equal(settings.hooks.Stop.length, 1);
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.equal(settings.hooks.PostToolUse.length, 1);
  assert.equal(settings.hooks.Stop[0].hooks[0].args[5], sessionB);
  assert.equal(settings.hooks.SessionStart[0].hooks[0].args[5], sessionB);
  assert.equal(uninstallClaudeWakeHook(second), true);
  assert.deepEqual(
    JSON.parse(readFileSync(settingsPath, "utf8")).hooks.Stop,
    [],
  );
  assert.deepEqual(
    JSON.parse(readFileSync(settingsPath, "utf8")).hooks.SessionStart,
    [],
  );
});

test("concurrent installers retain every session in one Claude settings file", async () => {
  const { root, claudeDir, configDir, cliPath } = fixture();
  const installerUrl = pathToFileURL(
    join(import.meta.dirname, "../../src/oclif/claude-wake-install.ts"),
  ).href;
  const childScript = join(root, "install.mjs");
  writeFileSync(
    childScript,
    `import { installClaudeWakeHook } from ${JSON.stringify(installerUrl)};\nconst result = installClaudeWakeHook(JSON.parse(process.argv[2]));\nif (result !== "installed_unverified") process.exitCode = 1;\n`,
  );
  const tsx = join(
    import.meta.dirname,
    "../../node_modules/tsx/dist/loader.mjs",
  );
  const sessions = Array.from({ length: 8 }, () => randomUUID());
  const results = await Promise.all(
    sessions.map(
      (sessionId, index) =>
        new Promise<{ code: number | null; stderr: string }>(
          (resolve, reject) => {
            const child = spawn(
              process.execPath,
              [
                "--import",
                tsx,
                childScript,
                JSON.stringify({
                  cliPath,
                  configDir,
                  profileName: `session-${index}`,
                  agentAddress: `session-${index}@example.com`,
                  sessionId,
                  env: { CLAUDE_CONFIG_DIR: claudeDir },
                }),
              ],
              { stdio: ["ignore", "ignore", "pipe"] },
            );
            let stderr = "";
            child.stderr.on("data", (chunk) => {
              stderr += String(chunk);
            });
            child.once("error", reject);
            child.once("close", (code) => resolve({ code, stderr }));
          },
        ),
    ),
  );
  assert.deepEqual(
    results.map((result) => result.code),
    Array(8).fill(0),
    JSON.stringify(results),
  );
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  assert.deepEqual(
    settings.hooks.Stop.map(
      (entry: { hooks: Array<{ args: string[] }> }) => entry.hooks[0].args[5],
    ).sort(),
    sessions.sort(),
  );
  assert.deepEqual(
    settings.hooks.SessionStart.map(
      (entry: { hooks: Array<{ args: string[] }> }) => entry.hooks[0].args[5],
    ).sort(),
    sessions,
  );
});

test("legacy generic hook stays available while new sessions gain pinned hooks", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const wrapperPath = realpathSync(join(dirname(cliPath), "claude-wake.mjs"));
  const oldProfile = "old-other-session";
  writeMailJson(
    join(agentProfileDirectory(configDir, oldProfile), "setup.json"),
    { session: sessionB },
  );
  writeFileSync(
    join(claudeDir, "settings.json"),
    JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: process.execPath,
                args: [
                  wrapperPath,
                  realpathSync(cliPath),
                  configDir,
                  "primitive-agent-wake-v1",
                ],
                asyncRewake: true,
              },
            ],
          },
          {
            hooks: [
              {
                type: "command",
                command: process.execPath,
                args: [
                  wrapperPath,
                  realpathSync(cliPath),
                  configDir,
                  oldProfile,
                  "old@example.com",
                  "primitive-agent-wake-v1",
                ],
                asyncRewake: true,
              },
            ],
          },
        ],
      },
    }),
  );
  const base = { cliPath, configDir, env: { CLAUDE_CONFIG_DIR: claudeDir } };
  assert.equal(
    installClaudeWakeHook({
      ...base,
      profileName: `session-${sessionA}`,
      agentAddress: "a@example.com",
      sessionId: sessionA,
    }),
    "installed_unverified",
  );
  let settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  assert.equal(settings.hooks.Stop.length, 3);
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.equal(settings.hooks.PostToolUse.length, 1);
  assert.equal(settings.hooks.Stop[0].hooks[0].args.length, 4);
  assert.equal(settings.hooks.Stop[1].hooks[0].args[3], oldProfile);
  assert.equal(settings.hooks.Stop[2].hooks[0].args[5], sessionA);
  assert.equal(
    installClaudeWakeHook({
      ...base,
      profileName: oldProfile,
      agentAddress: "old@example.com",
      sessionId: sessionB,
    }),
    "installed_unverified",
  );
  settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8"));
  assert.equal(settings.hooks.Stop.length, 3);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.Stop[0].hooks[0].args.length, 4);
  assert.deepEqual(
    settings.hooks.Stop.slice(1)
      .map(
        (entry: { hooks: Array<{ args: string[] }> }) => entry.hooks[0].args[5],
      )
      .sort(),
    [sessionA, sessionB],
  );
  assert.equal(
    uninstallClaudeWakeHook({
      configDir,
      profileName: oldProfile,
      agentAddress: "old@example.com",
      sessionId: sessionB,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    true,
  );
  settings = JSON.parse(readFileSync(join(claudeDir, "settings.json"), "utf8"));
  assert.equal(settings.hooks.Stop.length, 2);
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.equal(settings.hooks.Stop[0].hooks[0].args.length, 4);
  assert.equal(settings.hooks.Stop[1].hooks[0].args[5], sessionA);
});
