import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  existsSync,
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
  addSessionReceiver,
  readSessionReceivers,
} from "../../src/oclif/claude-session-receivers.js";
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

/** Save a connected profile, optionally bound to a session by its setup. */
function connect(
  configDir: string,
  profile: string,
  address: string,
  session?: string,
) {
  saveConnectedAgentProfile(configDir, profile, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", profile].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: address,
    owner_address: "owner@example.com",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
  if (session)
    writeMailJson(
      join(agentProfileDirectory(configDir, profile), "setup.json"),
      {
        session,
        receiverMode: "external",
      },
    );
}

/** The shared hook arguments for one config directory. */
function sharedArgs(cliPath: string, configDir: string, pending = false) {
  return [
    realpathSync(
      join(
        dirname(cliPath),
        pending ? "claude-pending-mail.mjs" : "claude-wake.mjs",
      ),
    ),
    realpathSync(cliPath),
    configDir,
    pending ? "primitive-pending-mail-v2" : "primitive-agent-wake-v2",
  ];
}

/** An exact-session hook as earlier versions wrote it. */
function perSessionHook(
  cliPath: string,
  configDir: string,
  profile: string,
  address: string,
  session: string,
  pending = false,
) {
  return {
    type: "command",
    command: process.execPath,
    args: [
      realpathSync(
        join(
          dirname(cliPath),
          pending ? "claude-pending-mail.mjs" : "claude-wake.mjs",
        ),
      ),
      realpathSync(cliPath),
      configDir,
      profile,
      address,
      session,
      pending ? "primitive-pending-mail-v1" : "primitive-agent-wake-v1",
    ],
    ...(pending ? { timeout: 10 } : { asyncRewake: true, timeout: 604800 }),
  };
}

const receivers = (configDir: string, session: string) =>
  readSessionReceivers(configDir, session).map((row) => row.profile);

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
  // One shared hook, naming no profile or session; the session's receiver
  // is recorded beside the profiles instead.
  assert.deepEqual(hook.args, sharedArgs(cliPath, configDir));
  assert.deepEqual(
    settings.hooks.PostToolUse[0].hooks[0].args,
    sharedArgs(cliPath, configDir, true),
  );
  assert.deepEqual(readSessionReceivers(configDir, sessionA), [
    { profile: "session-a", address: "a@example.com" },
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

test("on Windows hooks run Node through a stable PATH link, not the versioned binary", () => {
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
    platform: "win32" as const,
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  for (const event of ["Stop", "SessionStart", "PostToolUse"])
    assert.equal(settings.hooks[event].at(-1).hooks[0].command, link);
  assert.equal(claudeWakeHookStatus(options).installed, true);
  assert.equal(existsSync(join(configDir, "bin", "primitive-node")), false);
});

test("hooks run through the launcher, which pins the stable Node link", () => {
  const { root, claudeDir, configDir, cliPath } = fixture();
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
    platform: "linux" as const,
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const launcher = join(configDir, "bin", "primitive-node");
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  for (const event of ["Stop", "SessionStart", "PostToolUse"]) {
    const hook = settings.hooks[event].at(-1).hooks[0];
    assert.equal(hook.command, launcher);
    assert.equal(hook.args[1], realpathSync(cliPath));
  }
  assert.equal(statSync(launcher).mode & 0o777, 0o755);
  assert.ok(readFileSync(launcher, "utf8").includes(`pinned_node='${link}'`));
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
  connect(configDir, "session-a", "a@example.com", sessionA);
  const settingsPath = join(claudeDir, "settings.json");
  const sibling = { type: "command", command: "true" };
  const old = perSessionHook(
    cliPath,
    configDir,
    "session-a",
    "a@example.com",
    sessionA,
  );
  writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        Stop: [{ matcher: "", custom: "keep", hooks: [old, sibling] }],
        SessionStart: [
          { matcher: "resume", custom: "keep", hooks: [old, sibling] },
        ],
      },
    }),
  );
  const options = {
    cliPath,
    configDir,
    profileName: "session-a",
    agentAddress: "a@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.equal(settings.hooks.Stop.length, 2);
  assert.equal(settings.hooks.SessionStart.length, 2);
  assert.equal(settings.hooks.PostToolUse.length, 1);
  // The per-session hook is folded in; its siblings and metadata stay.
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
  assert.deepEqual(
    settings.hooks.Stop[1].hooks[0].args,
    sharedArgs(cliPath, configDir),
  );
  assert.equal(uninstallClaudeWakeHook(options), true);
  // Disconnecting removes the receiver; the shared hooks stay for others.
  assert.deepEqual(receivers(configDir, sessionA), []);
  const after = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.deepEqual(after.hooks.Stop[0], {
    matcher: "",
    custom: "keep",
    hooks: [sibling],
  });
  assert.equal(after.hooks.Stop.length, 2);
});

test("two Claude sessions share one hook set and keep separate receivers", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  connect(configDir, "first", "first-new@example.com");
  connect(configDir, "second", "second@example.com");
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
  const once = readFileSync(join(claudeDir, "settings.json"), "utf8");
  assert.equal(
    installClaudeWakeHook({
      ...options,
      profileName: "second",
      agentAddress: "second@example.com",
      sessionId: sessionB,
    }),
    "installed_unverified",
  );
  // A second session adds no hooks at all.
  assert.equal(readFileSync(join(claudeDir, "settings.json"), "utf8"), once);
  assert.equal(
    installClaudeWakeHook({
      ...options,
      profileName: "first",
      agentAddress: "first-new@example.com",
      sessionId: sessionA,
    }),
    "installed_unverified",
  );
  const settings = JSON.parse(once);
  for (const event of ["Stop", "SessionStart", "PostToolUse"])
    assert.equal(settings.hooks[event].length, 1);
  assert.equal(settings.hooks.SessionStart[0].matcher, "resume");
  assert.deepEqual(readSessionReceivers(configDir, sessionA), [
    { profile: "first", address: "first-new@example.com" },
  ]);
  assert.deepEqual(receivers(configDir, sessionB), ["second"]);
});

test("installing one profile keeps another profile receiving on the same session", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  connect(configDir, "my-agent", "mine@example.com");
  connect(configDir, `session-${sessionA}`, "session@example.com");
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
  const before = readFileSync(settingsPath, "utf8");
  // Session registration runs on every start, resume, clear and compact.
  for (let run = 0; run < 3; run++)
    assert.equal(installClaudeWakeHook(registered), "installed_unverified");
  assert.equal(readFileSync(settingsPath, "utf8"), before);
  assert.deepEqual(receivers(configDir, sessionA), [
    "my-agent",
    `session-${sessionA}`,
  ]);
  assert.equal(installClaudeWakeHook(connected), "installed_unverified");
  assert.deepEqual(receivers(configDir, sessionA), [
    "my-agent",
    `session-${sessionA}`,
  ]);
  assert.equal(readFileSync(settingsPath, "utf8"), before);
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
  // Disconnecting changes only the receiver record, not the settings.
  assert.equal(uninstallClaudeWakeHook(options), true);
  assert.equal(backups().length, 1);
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
    // Hooks that name Node directly, as on Windows and from older CLIs.
    platform: "win32" as const,
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

test("reinstalling (as agent connect --resume does) moves a hook pinned to a removed Node onto the launcher", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  const options = {
    cliPath,
    configDir,
    profileName: "session-a",
    agentAddress: "a@example.com",
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
    platform: "linux" as const,
  };
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const launcher = join(configDir, "bin", "primitive-node");
  // An older CLI pinned an nvm version that has since been removed.
  const removed = "/usr/local/nvm/versions/node/v24.21.0/bin/node";
  writeFileSync(
    settingsPath,
    readFileSync(settingsPath, "utf8").replaceAll(
      JSON.stringify(launcher),
      JSON.stringify(removed),
    ),
  );
  assert.equal(claudeWakeHookStatus(options).installed, false);
  assert.equal(installClaudeWakeHook(options), "installed_unverified");
  const hooks = JSON.parse(readFileSync(settingsPath, "utf8")).hooks;
  for (const event of ["Stop", "SessionStart", "PostToolUse"]) {
    assert.equal(hooks[event].length, 1);
    assert.equal(hooks[event][0].hooks[0].command, launcher);
  }
  assert.equal(claudeWakeHookStatus(options).installed, true);
});

test("uninstall removes only the exact profile and session and is idempotent", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  connect(configDir, "first", "first@example.com");
  connect(configDir, "second", "second@example.com");
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
  const installed = readFileSync(settingsPath, "utf8");
  assert.equal(
    uninstallClaudeWakeHook({ ...first, sessionId: sessionB }),
    true,
  );
  assert.deepEqual(receivers(configDir, sessionA), ["first"]);
  assert.deepEqual(receivers(configDir, sessionB), ["second"]);
  assert.equal(uninstallClaudeWakeHook(first), true);
  assert.equal(uninstallClaudeWakeHook(first), true);
  assert.deepEqual(receivers(configDir, sessionA), []);
  assert.deepEqual(receivers(configDir, sessionB), ["second"]);
  assert.equal(uninstallClaudeWakeHook(second), true);
  assert.deepEqual(receivers(configDir, sessionB), []);
  // The shared hooks stay; with no receivers they exit at once.
  assert.equal(readFileSync(settingsPath, "utf8"), installed);
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
  sessions.forEach((_, index) => {
    connect(configDir, `session-${index}`, `session-${index}@example.com`);
  });
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
  for (const event of ["Stop", "SessionStart", "PostToolUse"])
    assert.equal(settings.hooks[event].length, 1);
  sessions.forEach((sessionId, index) => {
    assert.deepEqual(receivers(configDir, sessionId), [`session-${index}`]);
  });
});

test("legacy generic hooks stay beside the shared hooks", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  connect(configDir, `session-${sessionA}`, "a@example.com");
  const wrapperPath = realpathSync(join(dirname(cliPath), "claude-wake.mjs"));
  const generic = {
    type: "command",
    command: process.execPath,
    args: [
      wrapperPath,
      realpathSync(cliPath),
      configDir,
      "primitive-agent-wake-v1",
    ],
    asyncRewake: true,
  };
  // A six-argument hook names a profile but no session; it is kept unless
  // its saved setup ties it to the installing session.
  const oldProfile = {
    ...generic,
    args: [
      wrapperPath,
      realpathSync(cliPath),
      configDir,
      "old-other-session",
      "old@example.com",
      "primitive-agent-wake-v1",
    ],
  };
  writeFileSync(
    join(claudeDir, "settings.json"),
    JSON.stringify({
      hooks: { Stop: [{ hooks: [generic] }, { hooks: [oldProfile] }] },
    }),
  );
  assert.equal(
    installClaudeWakeHook({
      cliPath,
      configDir,
      profileName: `session-${sessionA}`,
      agentAddress: "a@example.com",
      sessionId: sessionA,
      env: { CLAUDE_CONFIG_DIR: claudeDir },
    }),
    "installed_unverified",
  );
  const settings = JSON.parse(
    readFileSync(join(claudeDir, "settings.json"), "utf8"),
  );
  assert.deepEqual(settings.hooks.Stop[0].hooks[0], generic);
  assert.deepEqual(settings.hooks.Stop[1].hooks[0], oldProfile);
  assert.deepEqual(
    settings.hooks.Stop[2].hooks[0].args,
    sharedArgs(cliPath, configDir),
  );
});

test("an install folds every per-session hook of its config directory into the shared hooks", () => {
  const { root, claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  connect(configDir, "session-a", "a@example.com", sessionA);
  connect(configDir, "session-b", "b@example.com", sessionB);
  // A profile disconnected since: its hooks are pruned, not folded in.
  const sessionC = randomUUID();
  const otherConfig = join(root, "other-config");
  mkdirSync(otherConfig);
  connect(otherConfig, "elsewhere", "e@example.com", sessionC);
  const old = (
    profile: string,
    address: string,
    session: string,
    pending = false,
    dir = configDir,
  ) => ({
    hooks: [
      {
        ...perSessionHook(cliPath, dir, profile, address, session, pending),
        // Written by an older CLI install at another path.
        command: "/old/node",
      },
    ],
  });
  const unrelated = { hooks: [{ type: "command", command: "true" }] };
  writeFileSync(
    settingsPath,
    JSON.stringify({
      hooks: {
        Stop: [
          old("session-a", "a@example.com", sessionA),
          unrelated,
          old("session-b", "b@example.com", sessionB),
          old("gone", "gone@example.com", sessionC),
          old("elsewhere", "e@example.com", sessionC, false, otherConfig),
        ],
        SessionStart: [
          { matcher: "resume", ...old("session-b", "b@example.com", sessionB) },
        ],
        PostToolUse: [old("session-a", "a@example.com", sessionA, true)],
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
  // Unrelated hooks and another config directory's hooks are untouched;
  // this directory's per-session hooks became one shared set.
  assert.deepEqual(settings.hooks.Stop, [
    unrelated,
    old("elsewhere", "e@example.com", sessionC, false, otherConfig),
    sharedHookEntryFor("Stop", cliPath, configDir, settings),
  ]);
  for (const event of ["SessionStart", "PostToolUse"])
    assert.equal(settings.hooks[event].length, 1);
  assert.deepEqual(receivers(configDir, sessionA), ["session-a"]);
  assert.deepEqual(receivers(configDir, sessionB), ["session-b"]);
  assert.deepEqual(receivers(configDir, sessionC), []);
  // Running it again changes nothing.
  const once = readFileSync(settingsPath, "utf8");
  installClaudeWakeHook({
    cliPath,
    configDir,
    profileName: "session-b",
    agentAddress: "b@example.com",
    sessionId: sessionB,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  });
  assert.equal(readFileSync(settingsPath, "utf8"), once);
});

test("an automatic install yields to another connected profile the session already receives as", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  connect(configDir, "profile-a", "a@example.com");
  connect(configDir, "profile-b", "b@example.com");
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
  // An automatic install of B adds nothing.
  assert.equal(installClaudeWakeHook(b), "held_for_other_profile");
  assert.equal(readFileSync(settingsPath, "utf8"), onlyA);
  assert.deepEqual(receivers(configDir, sessionA), ["profile-a"]);
  // Another session is unaffected.
  assert.equal(
    installClaudeWakeHook({ ...b, sessionId: sessionB }),
    "installed_unverified",
  );
  assert.deepEqual(receivers(configDir, sessionB), ["profile-b"]);
  // Naming B explicitly (agent connect, agent enroll) still binds it.
  assert.equal(
    installClaudeWakeHook({ ...b, yieldToOtherProfiles: false }),
    "installed_unverified",
  );
  assert.deepEqual(receivers(configDir, sessionA), ["profile-a", "profile-b"]);
  // Once B receives there, an automatic install keeps it.
  assert.equal(installClaudeWakeHook(b), "installed_unverified");
});

test("a held install still removes the profile's own legacy hook for the session", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  connect(configDir, "profile-a", "a@example.com");
  // B's saved setup ties it to session A, and B still has an older
  // six-argument wake hook, which names no session.
  connect(configDir, "profile-b", "b@example.com", sessionA);
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
  // The session receives as A through the shared hooks.
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
  // Only A receives; B's legacy hook is gone and unrelated hooks are kept.
  assert.deepEqual(receivers(configDir, sessionA), ["profile-a"]);
  assert.deepEqual(settings.hooks.Stop[0].hooks, [unrelated]);
  assert.equal(JSON.stringify(settings).includes("profile-b"), false);
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

/** The shared entry an install writes for one event, read from settings. */
function sharedHookEntryFor(
  event: string,
  cliPath: string,
  configDir: string,
  settings: {
    hooks: Record<string, Array<{ hooks: Array<{ args: string[] }> }>>;
  },
) {
  const entry = settings.hooks[event]?.find(
    (row) =>
      JSON.stringify(row.hooks[0]?.args) ===
      JSON.stringify(sharedArgs(cliPath, configDir, event === "PostToolUse")),
  );
  assert.ok(entry, `no shared ${event} hook`);
  return entry;
}

test("a held install keeps the profile's hooks for its other sessions", () => {
  const { claudeDir, configDir, cliPath } = fixture();
  const settingsPath = join(claudeDir, "settings.json");
  connect(configDir, "profile-a", "a@example.com");
  connect(configDir, "profile-b", "b@example.com");
  const elsewhere = perSessionHook(
    cliPath,
    configDir,
    "profile-b",
    "b@example.com",
    sessionB,
  );
  writeFileSync(
    settingsPath,
    JSON.stringify({ hooks: { Stop: [{ hooks: [elsewhere] }] } }),
  );
  const common = {
    cliPath,
    configDir,
    sessionId: sessionA,
    env: { CLAUDE_CONFIG_DIR: claudeDir },
  };
  addSessionReceiver(configDir, sessionA, {
    profile: "profile-a",
    address: "a@example.com",
  });
  assert.equal(
    installClaudeWakeHook({
      ...common,
      profileName: "profile-b",
      agentAddress: "b@example.com",
      yieldToOtherProfiles: true,
    }),
    "held_for_other_profile",
  );
  // Session B still receives as profile-b through its own hook.
  const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
  assert.deepEqual(settings.hooks.Stop, [{ hooks: [elsewhere] }]);
  assert.deepEqual(receivers(configDir, sessionA), ["profile-a"]);
});
