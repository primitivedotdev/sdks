import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "vitest";
import {
  claudeWakeHookStatus,
  editClaudeSettings,
  HOOK_RECENT_MS,
  installClaudeWakeHook,
  recordHookMailCheck,
  uninstallClaudeWakeHook,
} from "../../src/oclif/claude-wake-install.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
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
    lastMailCheckAt: null,
    firedRecently: false,
    liveness: "unknown",
  });
  const firedAt = "2026-10-01T15:00:00.000Z";
  const fired = Date.parse(firedAt);
  writeMailJson(
    join(
      agentProfileDirectory(configDir, "session-a"),
      `pending-mail-${sessionA}.fired.json`,
    ),
    { version: 1, at: firedAt },
  );
  assert.deepEqual(
    claudeWakeHookStatus({ ...options, now: fired + HOOK_RECENT_MS + 1 }),
    {
      installed: true,
      lastFiredAt: firedAt,
      lastMailCheckAt: null,
      firedRecently: false,
      liveness: "unknown",
    },
  );
  // A hook that just ran is not live on its own: its mail check may fail.
  assert.deepEqual(claudeWakeHookStatus({ ...options, now: fired + 60_000 }), {
    installed: true,
    lastFiredAt: firedAt,
    lastMailCheckAt: null,
    firedRecently: true,
    liveness: "unknown",
  });
  // A completed mail check within the window is.
  recordHookMailCheck({
    configDir,
    profileName: "session-a",
    sessionId: sessionA,
    at: fired + 2_000,
  });
  const checkedAt = new Date(fired + 2_000).toISOString();
  assert.deepEqual(claudeWakeHookStatus({ ...options, now: fired + 60_000 }), {
    installed: true,
    lastFiredAt: firedAt,
    lastMailCheckAt: checkedAt,
    firedRecently: true,
    liveness: "checked_recently",
  });
  assert.equal(
    claudeWakeHookStatus({ ...options, now: fired + 2_000 + HOOK_RECENT_MS })
      .liveness,
    "checked_recently",
  );
  assert.equal(
    claudeWakeHookStatus({
      ...options,
      now: fired + 2_000 + HOOK_RECENT_MS + 1,
    }).liveness,
    "unknown",
  );
  // A record far in the future is not trusted as recent.
  assert.equal(
    claudeWakeHookStatus({ ...options, now: fired - 5 * 60_000 }).liveness,
    "unknown",
  );
});

test("hooks run Node through a stable PATH link, not the versioned binary", () => {
  const { root, claudeDir, configDir, cliPath } = fixture();
  // A package manager's bin/node links to the versioned install directory.
  const pathDir = join(root, "path-bin");
  mkdirSync(pathDir);
  const link = join(pathDir, "node");
  symlinkSync(process.execPath, link);
  const options = {
    cliPath,
    configDir,
    profileName: "stable",
    agentAddress: "stable@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir, PATH: pathDir },
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  for (const event of ["Stop", "SessionStart", "PostToolUse"])
    assert.equal(settings.hooks[event].at(-1).hooks[0].command, link);
  assert.equal(claudeWakeHookStatus(options).installed, true);
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
      profileName: "first",
      agentAddress: "first-new@example.com",
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
  assert.equal(
    settings.hooks.Stop.find(
      (entry: { hooks: Array<{ args: string[] }> }) =>
        entry.hooks[0].args[5] === sessionA,
    ).hooks[0].args[4],
    "first-new@example.com",
  );
});

test("installing one profile keeps another profile's hooks on the same session", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const base = { cliPath, configDir, env: { CLAUDE_CONFIG_DIR: claudeDir } };
  const connected = {
    ...base,
    profileName: "my-agent",
    agentAddress: "mine@example.com",
    sessionId: sessionA,
  };
  const registered = {
    ...base,
    profileName: `session-${sessionA}`,
    agentAddress: "session@example.com",
    sessionId: sessionA,
  };
  assert.equal(installClaudeWakeHook(connected), "installed_unverified");
  const ownHooks = (profile: string) => {
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    return ["Stop", "SessionStart", "PostToolUse"].map(
      (event) =>
        settings.hooks[event].filter(
          (entry: { hooks: Array<{ args: string[] }> }) =>
            entry.hooks[0].args[3] === profile,
        ).length,
    );
  };
  assert.deepEqual(ownHooks("my-agent"), [1, 1, 1]);
  // Session registration runs on every start, resume, clear and compact.
  for (let run = 0; run < 3; run++)
    assert.equal(installClaudeWakeHook(registered), "installed_unverified");
  assert.deepEqual(ownHooks("my-agent"), [1, 1, 1]);
  assert.deepEqual(ownHooks(`session-${sessionA}`), [1, 1, 1]);
  // Reinstalling the first profile is idempotent and keeps the second.
  const before = readFileSync(settingsPath, "utf8");
  assert.equal(installClaudeWakeHook(registered), "installed_unverified");
  assert.equal(readFileSync(settingsPath, "utf8"), before);
  assert.equal(installClaudeWakeHook(connected), "installed_unverified");
  assert.deepEqual(ownHooks("my-agent"), [1, 1, 1]);
  assert.deepEqual(ownHooks(`session-${sessionA}`), [1, 1, 1]);
});

test("every hook write leaves a backup of the previous settings, and an unchanged install writes nothing", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const original = `${JSON.stringify({ theme: "dark" })}\n`;
  writeFileSync(settingsPath, original);
  const options = {
    cliPath,
    configDir,
    profileName: "my-agent",
    agentAddress: "mine@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  const backups = () =>
    readdirSync(claudeDir).filter((name) =>
      name.startsWith("settings.json.primitive-bak-"),
    );
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  assert.equal(backups().length, 1);
  assert.equal(
    readFileSync(join(claudeDir, backups()[0] as string), "utf8"),
    original,
  );
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  assert.equal(backups().length, 1);
  assert.equal(uninstallClaudeWakeHook(options), true);
  assert.equal(backups().length, 2);
});

test("hook status reads a shared-readable settings file larger than a private record", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  writeFileSync(
    settingsPath,
    `${JSON.stringify({ notes: "x".repeat(40_000) })}\n`,
    { mode: 0o644 },
  );
  chmodSync(settingsPath, 0o644);
  const options = {
    configDir,
    profileName: "my-agent",
    agentAddress: "mine@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(
    installClaudeWakeHook({ ...options, cliPath }),
    "installed_unverified",
  );
  assert.equal(statSync(settingsPath).mode & 0o777, 0o644);
  assert.equal(claudeWakeHookStatus(options).installed, true);
});

test("a settings change made by another tool during an edit is merged, not overwritten", () => {
  const { claudeDir } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  writeFileSync(settingsPath, `${JSON.stringify({ theme: "dark" })}\n`);
  const seen: unknown[] = [];
  assert.equal(
    editClaudeSettings(claudeDir, (settings) => {
      seen.push(settings);
      // Another tool, which does not take our lock, writes while the first
      // attempt is being prepared.
      if (seen.length === 1)
        writeFileSync(
          settingsPath,
          `${JSON.stringify({ theme: "dark", model: "opus" })}\n`,
        );
      return { ...settings, added: true };
    }),
    true,
  );
  assert.deepEqual(seen, [{ theme: "dark" }, { theme: "dark", model: "opus" }]);
  assert.deepEqual(JSON.parse(readFileSync(settingsPath, "utf8")), {
    theme: "dark",
    model: "opus",
    added: true,
  });
  const backups = readdirSync(claudeDir).filter((name) =>
    name.startsWith("settings.json.primitive-bak-"),
  );
  assert.ok(backups.length >= 1);
  assert.ok(
    backups.some(
      (name) =>
        readFileSync(join(claudeDir, name), "utf8") ===
        `${JSON.stringify({ theme: "dark", model: "opus" })}\n`,
    ),
  );
});

test("hook status accepts a Node path that resolves to the running binary", () => {
  const { root, claudeDir, configDir, cliPath } = fixture();
  const options = {
    configDir,
    profileName: "my-agent",
    agentAddress: "mine@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(
    installClaudeWakeHook({ ...options, cliPath }),
    "installed_unverified",
  );
  assert.equal(claudeWakeHookStatus(options).installed, true);
  // A repair writes a stable link to the same Node binary.
  const link = join(root, "node-link");
  symlinkSync(process.execPath, link);
  const settingsPath = join(claudeDir, "settings.json");
  const text = readFileSync(settingsPath, "utf8").replaceAll(
    JSON.stringify(process.execPath),
    JSON.stringify(link),
  );
  writeFileSync(settingsPath, text);
  assert.ok(text.includes(JSON.stringify(link)));
  assert.equal(claudeWakeHookStatus(options).installed, true);
  // A different binary is not this CLI's hook.
  const other = join(root, "other-node");
  writeFileSync(other, "");
  writeFileSync(
    settingsPath,
    text.replaceAll(JSON.stringify(link), JSON.stringify(other)),
  );
  assert.equal(claudeWakeHookStatus(options).installed, false);
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

test("reinstalling replaces this session's hooks written by an older CLI path", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const oldArgs = (script: string, marker: string, session: string) => [
    `/old/primitive/bin/${script}`,
    "/old/primitive/bin/run.js",
    configDir,
    "session-a",
    "a@example.com",
    session,
    marker,
  ];
  writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        Stop: [
          {
            hooks: [
              {
                type: "command",
                command: "/old/node",
                args: oldArgs(
                  "claude-wake.mjs",
                  "primitive-agent-wake-v1",
                  sessionA,
                ),
                asyncRewake: true,
              },
            ],
          },
          {
            hooks: [
              {
                type: "command",
                command: "/old/node",
                args: oldArgs(
                  "claude-wake.mjs",
                  "primitive-agent-wake-v1",
                  sessionB,
                ),
                asyncRewake: true,
              },
            ],
          },
        ],
        PostToolUse: [
          {
            hooks: [
              {
                type: "command",
                command: "/old/node",
                args: oldArgs(
                  "claude-pending-mail.mjs",
                  "primitive-pending-mail-v1",
                  sessionA,
                ),
              },
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
  const sessions = (entries: Array<{ hooks: Array<{ args: string[] }> }>) =>
    entries.flatMap((entry) => entry.hooks.map((hook) => hook.args[5]));
  // Another session's hook stays; this session has exactly one, current.
  assert.deepEqual(sessions(settings.hooks.Stop), [sessionB, sessionA]);
  assert.deepEqual(sessions(settings.hooks.PostToolUse), [sessionA]);
  assert.equal(
    settings.hooks.PostToolUse[0].hooks[0].args[1],
    realpathSync(cliPath),
  );
});

test("an automatic install yields to another connected profile the session already receives as", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  saveConnectedAgentProfile(configDir, "profile-a", {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", "x"].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: "a@example.com",
    owner_address: "owner@example.com",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
  const common = {
    cliPath,
    configDir,
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  const a = {
    ...common,
    profileName: "profile-a",
    agentAddress: "a@example.com",
  };
  const b = {
    ...common,
    profileName: "profile-b",
    agentAddress: "b@example.com",
    yieldToOtherProfiles: true,
  };
  // The session receives as A.
  assert.equal(installClaudeWakeHook(a), "installed_unverified");
  const onlyA = readFileSync(settingsPath, "utf8");
  // An automatic install of B writes nothing.
  assert.equal(installClaudeWakeHook(b), "held_for_other_profile");
  assert.equal(readFileSync(settingsPath, "utf8"), onlyA);
  // Another session is unaffected.
  assert.equal(
    installClaudeWakeHook({ ...b, sessionId: sessionB }),
    "installed_unverified",
  );
  // Naming B explicitly (agent connect, agent enroll) still binds it.
  assert.equal(
    installClaudeWakeHook({ ...b, yieldToOtherProfiles: false }),
    "installed_unverified",
  );
  const both = JSON.parse(readFileSync(settingsPath, "utf8"));
  // B keeps any hook it still has, so a partly removed B is repaired.
  both.hooks.Stop = both.hooks.Stop.filter(
    (entry: { hooks: Array<{ args: string[] }> }) =>
      !(
        entry.hooks[0]?.args[3] === "profile-b" &&
        entry.hooks[0]?.args[5] === sessionA
      ),
  );
  writeFileSync(settingsPath, JSON.stringify(both));
  assert.equal(installClaudeWakeHook(b), "installed_unverified");
  const repaired = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.ok(
    repaired.hooks.Stop.some(
      (entry: { hooks: Array<{ args: string[] }> }) =>
        entry.hooks[0]?.args[3] === "profile-b" &&
        entry.hooks[0]?.args[5] === sessionA,
    ),
  );
});

test("a held install still removes the profile's own legacy hook for the session", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  saveConnectedAgentProfile(configDir, "profile-a", {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", "x"].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: "a@example.com",
    owner_address: "owner@example.com",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
  // B's saved setup ties it to session A, and B still has an older
  // six-argument wake hook, which names no session.
  writeMailJson(
    join(agentProfileDirectory(configDir, "profile-b"), "setup.json"),
    { session: sessionA, receiverMode: "external" },
  );
  const legacy = {
    type: "command",
    command: process.execPath,
    args: [
      join(dirname(cliPath), "claude-wake.mjs"),
      cliPath,
      configDir,
      "profile-b",
      "b@example.com",
      "primitive-agent-wake-v1",
    ],
  };
  const unrelated = { type: "command", command: "true" };
  writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        Stop: [{ hooks: [legacy, unrelated] }],
        SessionStart: [{ matcher: "resume", hooks: [legacy] }],
      },
    }),
  );
  const common = {
    cliPath,
    configDir,
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  // The session receives as A through current hooks.
  assert.equal(
    installClaudeWakeHook({
      ...common,
      profileName: "profile-a",
      agentAddress: "a@example.com",
    }),
    "installed_unverified",
  );
  assert.equal(
    installClaudeWakeHook({
      ...common,
      profileName: "profile-b",
      agentAddress: "b@example.com",
      yieldToOtherProfiles: true,
    }),
    "held_for_other_profile",
  );
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  const profiles = (["Stop", "SessionStart", "PostToolUse"] as const).flatMap(
    (event) =>
      (settings.hooks[event] ?? []).flatMap(
        (entry: { hooks: Array<{ args?: string[] }> }) =>
          entry.hooks.flatMap((hook) => (hook.args ? [hook.args[3]] : [])),
      ),
  );
  // Only A receives; B's legacy hook is gone and unrelated hooks are kept.
  assert.deepEqual([...new Set(profiles)], ["profile-a"]);
  assert.deepEqual(settings.hooks.Stop[0].hooks, [unrelated]);
  // A second held run finds nothing of B's to remove and writes nothing.
  const after = readFileSync(settingsPath, "utf8");
  assert.equal(
    installClaudeWakeHook({
      ...common,
      profileName: "profile-b",
      agentAddress: "b@example.com",
      yieldToOtherProfiles: true,
    }),
    "held_for_other_profile",
  );
  assert.equal(readFileSync(settingsPath, "utf8"), after);
});
