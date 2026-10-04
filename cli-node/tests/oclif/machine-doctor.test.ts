import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { saveCliCredentials } from "../../src/oclif/auth.js";
import { claudeWakeHookStatus } from "../../src/oclif/claude-wake-install.js";
import { codexHookTrustHash } from "../../src/oclif/codex-machine-hooks.js";
import {
  agentProfileDirectory,
  type ConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { acquireListenLock } from "../../src/oclif/listen-state.js";
import {
  type DoctorCheckId,
  type DoctorReport,
  type MachineDoctorOptions,
  managedInstructions,
  runMachineDoctor,
} from "../../src/oclif/machine-doctor.js";
import { renderManagedBlock } from "../../src/oclif/machine-files.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";

function profile(address: string): ConnectedAgentProfile {
  return {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", address.split("@")[0]].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "33333333-3333-4333-8333-333333333333",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

/** A temp HOME with a fake installed CLI, config dir and runtime dirs. */
function machine(options: { runtimes?: string[] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "machine-doctor-")));
  directories.push(root);
  const home = join(root, "home");
  const bin = join(root, "lib", "primitive", "bin");
  const configDir = join(home, ".config", "primitive");
  mkdirSync(bin, { recursive: true });
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  for (const file of ["run.js", "claude-wake.mjs", "claude-pending-mail.mjs"])
    writeFileSync(join(bin, file), "", { mode: 0o755 });
  for (const runtime of options.runtimes ?? ["claude", "codex"])
    mkdirSync(join(home, runtime === "omp" ? ".omp" : `.${runtime}`), {
      recursive: true,
    });
  const bundleDir = join(root, "bundle");
  mkdirSync(bundleDir);
  writeFileSync(
    join(bundleDir, "SKILL.md"),
    "---\nname: primitive-connect\n---\nSkill\n",
  );
  const skillHash = createHash("sha256")
    .update(readFileSync(join(bundleDir, "SKILL.md")))
    .digest("hex");
  const versionDigest = createHash("sha256")
    .update(`SKILL.md\0${skillHash}\n`)
    .digest("hex")
    .slice(0, 16);
  const options_: MachineDoctorOptions = {
    fix: false,
    configDir,
    home,
    env: { PATH: "" },
    packageRoot: root,
    cliVersion: "1.40.0",
    cliEntry: join(bin, "run.js"),
    execPath: process.execPath,
    latestVersion: async () => "1.40.0",
    fetch: (async () => {
      throw new TypeError("offline");
    }) as typeof fetch,
    now: () => new Date("2026-10-02T12:00:00.000Z"),
    bundle: () => ({
      directory: bundleDir,
      version: versionDigest,
      commit: null,
      files: { "SKILL.md": skillHash },
    }),
  };
  return { root, home, bin, configDir, options: options_ };
}

function byId(report: DoctorReport) {
  return Object.fromEntries(
    report.checks.map((item) => [item.id, item]),
  ) as Record<DoctorCheckId, DoctorReport["checks"][number]>;
}

/** Every file under HOME except the doctor's own lock area, with content hashes. */
function snapshot(home: string): Record<string, string> {
  const files: Record<string, string> = {};
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (!relative(home, path).startsWith(".config/primitive/machine/"))
        files[relative(home, path)] = createHash("sha256")
          .update(readFileSync(path))
          .digest("hex");
    }
  };
  walk(home);
  return files;
}

function wakeHook(
  bin: string,
  configDir: string,
  profileName: string,
  address: string,
  session: string,
) {
  return {
    type: "command",
    command: process.execPath,
    args: [
      join(bin, "claude-wake.mjs"),
      join(bin, "run.js"),
      configDir,
      profileName,
      address,
      session,
      "primitive-agent-wake-v1",
    ],
    asyncRewake: true,
    timeout: 604800,
  };
}

describe("primitive machine doctor", () => {
  it("repairs a fresh machine, then a second --fix changes nothing", async () => {
    const { home, options } = machine();
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "settings.json"),
      '{\n    "model": "opus",\n    "hooks": {\n        "Stop": [{"hooks": [{"type": "command", "command": "echo mine"}]}]\n    }\n}\n',
    );
    const before = byId(await runMachineDoctor(options));
    expect(before["claude.hook.session_start"].status).toBe("fail");
    expect(before["claude.hook.session_start"].fixable).toBe(true);
    expect(before["claude.instructions"].fixable).toBe(true);
    expect(before["skill.claude"].fixable).toBe(true);
    expect(before["auth.member_login"]).toMatchObject({
      status: "fail",
      fixable: false,
      action: "login",
    });

    const fixed = await runMachineDoctor({ ...options, fix: true });
    const checks = byId(fixed);
    for (const id of [
      "claude.hook.session_start",
      "claude.hook.session_end",
      "claude.instructions",
      "codex.instructions",
      "skill.claude",
      "skill.codex",
    ] as const)
      expect(checks[id], id).toMatchObject({ status: "ok", fixed: true });
    expect(checks["omp.instructions"].status).toBe("skip");
    // Installed, but Codex has not recorded trust for it yet.
    expect(checks["codex.hook.session_start"]).toMatchObject({
      status: "warn",
      fixed: true,
    });
    expect(fixed.fixedCount).toBe(7);
    expect(fixed.version).toBe(1);
    expect(fixed.summary).toEqual({ ok: 12, warn: 1, fail: 1, skip: 1 });

    const settings = JSON.parse(
      readFileSync(join(home, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop).toEqual([
      { hooks: [{ type: "command", command: "echo mine" }] },
    ]);
    expect(settings.hooks.SessionStart).toHaveLength(1);
    expect(settings.hooks.SessionStart[0].hooks[0].args.slice(1)).toEqual([
      "agent",
      "session-register",
      "--runtime",
      "claude",
      "--hook",
    ]);
    expect(settings.hooks.SessionEnd[0].hooks[0].args[2]).toBe("session-end");
    // The file keeps its four-space indentation.
    expect(
      readFileSync(join(home, ".claude", "settings.json"), "utf8"),
    ).toContain('\n    "model": "opus"');
    expect(
      readdirSync(join(home, ".claude")).filter((name) =>
        name.startsWith("settings.json.primitive-bak-"),
      ),
    ).toHaveLength(1);
    expect(readFileSync(join(home, ".codex", "AGENTS.md"), "utf8")).toBe(
      `${renderManagedBlock(managedInstructions("codex"))}\n`,
    );

    const first = snapshot(home);
    const again = await runMachineDoctor({ ...options, fix: true });
    expect(again.fixedCount).toBe(0);
    expect(snapshot(home)).toEqual(first);
  });

  it("collapses stale duplicate hooks from an old CLI path and keeps everything else", async () => {
    const { home, bin, configDir, options } = machine();
    saveConnectedAgentProfile(
      configDir,
      `session-${sessionA}`,
      profile("live@example.test"),
    );
    const oldBin = "/old/node_modules/primitive/bin";
    const oldGlobal = {
      type: "command",
      command: "/old/node",
      args: [
        `${oldBin}/run.js`,
        "agent",
        "session-register",
        "--runtime",
        "claude",
        "--hook",
      ],
      timeout: 30,
    };
    const liveOld = {
      ...wakeHook(
        oldBin,
        configDir,
        `session-${sessionA}`,
        "live@example.test",
        sessionA,
      ),
      command: "/old/node",
    };
    const liveCurrent = wakeHook(
      bin,
      configDir,
      `session-${sessionA}`,
      "live@example.test",
      sessionA,
    );
    const dead = wakeHook(
      bin,
      configDir,
      `session-${sessionB}`,
      "gone@example.test",
      sessionB,
    );
    const userHook = { type: "command", command: "~/.claude/hooks/mine.sh" };
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Bash(ls *)"] },
        hooks: {
          SessionStart: [
            { hooks: [userHook, oldGlobal] },
            { hooks: [oldGlobal] },
            { matcher: "resume", hooks: [liveOld] },
            { matcher: "resume", hooks: [dead] },
          ],
          Stop: [
            { hooks: [userHook] },
            { hooks: [liveOld] },
            { hooks: [liveCurrent] },
            { hooks: [dead] },
          ],
        },
      }),
    );
    const before = byId(await runMachineDoctor(options));
    expect(before["claude.hook.session_start"].detail).toContain(
      "2 SessionStart hooks",
    );
    expect(before["claude.hook.stop"]).toMatchObject({
      status: "fail",
      fixable: true,
    });
    expect(before["claude.hook.stop"].detail).toContain(
      "for disconnected or removed sessions",
    );

    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["claude.hook.session_start"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(report["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    const settings = JSON.parse(
      readFileSync(join(home, ".claude", "settings.json"), "utf8"),
    );
    expect(settings.permissions).toEqual({ allow: ["Bash(ls *)"] });
    const start = settings.hooks.SessionStart;
    // The user's hook keeps its entry; the managed hook is rewritten in place
    // with the user's longer timeout kept; the duplicate is dropped.
    expect(start[0].hooks[0]).toEqual(userHook);
    expect(start[0].hooks[1]).toMatchObject({
      timeout: 30,
      args: [
        join(bin, "run.js"),
        "agent",
        "session-register",
        "--runtime",
        "claude",
        "--hook",
      ],
    });
    const wakes = (entries: Array<{ hooks: unknown[] }>) =>
      entries
        .flatMap((entry) => entry.hooks)
        .filter(
          (hook) =>
            typeof hook === "object" &&
            hook !== null &&
            Array.isArray((hook as { args?: unknown }).args),
        ) as Array<{ command: string; args: string[] }>;
    const stopWakes = wakes(settings.hooks.Stop);
    expect(stopWakes).toHaveLength(1);
    expect(stopWakes[0]?.args[0]).toBe(join(bin, "claude-wake.mjs"));
    expect(stopWakes[0]?.args[5]).toBe(sessionA);
    expect(settings.hooks.Stop[0]).toEqual({ hooks: [userHook] });
    const resumeWakes = wakes(settings.hooks.SessionStart).filter((hook) =>
      hook.args[0]?.endsWith("claude-wake.mjs"),
    );
    expect(resumeWakes).toHaveLength(1);
    expect(resumeWakes[0]?.args[1]).toBe(join(bin, "run.js"));
    expect(JSON.stringify(settings).includes("gone@example.test")).toBe(false);
  });

  it("repairs the Codex hook without moving any other hook, and checks approval by hash", async () => {
    const { home, bin, options } = machine();
    const hooksPath = join(home, ".codex", "hooks.json");
    const hook = (name: string) => ({ type: "command", command: name });
    const stale = hook(
      "'/old/node' '/old/primitive/bin/run.js' agent session-register --runtime codex --hook",
    );
    const original = {
      hooks: {
        SessionStart: [
          { hooks: [hook("first.sh")] },
          { hooks: [stale, hook("middle.sh")] },
          { hooks: [stale] },
          { matcher: "startup", hooks: [hook("last.sh")] },
        ],
        Stop: [{ hooks: [hook("stop.sh")] }],
      },
    };
    writeFileSync(hooksPath, `${JSON.stringify(original, null, 2)}\n`);
    const before = byId(await runMachineDoctor(options));
    expect(before["codex.hook.session_start"]).toMatchObject({
      status: "fail",
      fixable: true,
    });
    const fixed = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(fixed["codex.hook.session_start"]).toMatchObject({
      status: "warn",
      fixed: true,
    });
    expect(fixed["codex.hook.session_start"].detail).toContain(
      "approval needs to be confirmed in Codex",
    );
    const hooks = JSON.parse(readFileSync(hooksPath, "utf8")).hooks;
    const desired = `'${process.execPath}' '${join(bin, "run.js")}' agent session-register --runtime codex --hook`;
    // Every unrelated hook keeps its exact entry and hook index.
    expect(hooks.Stop).toEqual(original.hooks.Stop);
    expect(hooks.SessionStart).toHaveLength(4);
    expect(hooks.SessionStart[0]).toEqual({ hooks: [hook("first.sh")] });
    expect(hooks.SessionStart[1]).toEqual({
      hooks: [hook(desired), hook("middle.sh")],
    });
    expect(hooks.SessionStart[2]).toEqual({ hooks: [] });
    expect(hooks.SessionStart[3]).toEqual(original.hooks.SessionStart[3]);
    expect(
      readdirSync(join(home, ".codex")).some((name) =>
        name.startsWith("hooks.json.primitive-bak-"),
      ),
    ).toBe(true);

    const configToml = join(home, ".codex", "config.toml");
    const key = `[hooks.state."${hooksPath}:session_start:1:0"]`;
    writeFileSync(configToml, `${key}\ntrusted_hash = "sha256:stale"\n`);
    expect(
      byId(await runMachineDoctor(options))["codex.hook.session_start"],
    ).toMatchObject({ status: "warn" });
    writeFileSync(
      configToml,
      `${key}\ntrusted_hash = "${codexHookTrustHash("session_start", null, hook(desired))}"\n`,
    );
    expect(
      byId(await runMachineDoctor(options))["codex.hook.session_start"].status,
    ).toBe("ok");
    writeFileSync(
      configToml,
      `${key}\ntrusted_hash = "${codexHookTrustHash("session_start", null, hook(desired))}"\nenabled = false\n`,
    );
    expect(
      byId(await runMachineDoctor(options))["codex.hook.session_start"].detail,
    ).toContain("disabled");
    const first = snapshot(home);
    expect((await runMachineDoctor({ ...options, fix: true })).fixedCount).toBe(
      0,
    );
    expect(snapshot(home)).toEqual(first);
  });

  it("leaves a duplicate Codex hook that precedes another hook in place", async () => {
    const { home, bin, options } = machine();
    const hooksPath = join(home, ".codex", "hooks.json");
    const desired = `'${process.execPath}' '${join(bin, "run.js")}' agent session-register --runtime codex --hook`;
    const original = {
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: desired }] },
          {
            hooks: [
              { type: "command", command: desired },
              { type: "command", command: "after.sh" },
            ],
          },
        ],
      },
    };
    const text = `${JSON.stringify(original, null, 2)}\n`;
    writeFileSync(hooksPath, text);
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["codex.hook.session_start"]).toMatchObject({
      status: "warn",
      fixable: false,
    });
    expect(report["codex.hook.session_start"].detail).toContain(
      "left in place",
    );
    expect(readFileSync(hooksPath, "utf8")).toBe(text);
  });

  it("reproduces the trust hash Codex records", () => {
    // Recorded by Codex itself for this hooks.json SessionStart hook.
    expect(
      codexHookTrustHash("session_start", null, {
        type: "command",
        command:
          "/opt/homebrew/bin/node /private/tmp/primitive-autoconnect-research/codex-start.mjs",
      }),
    ).toBe(
      "sha256:16f4fa2f695709d0d6e4dd3068a3000d2b6e4f731014623d843a3511d94f2c0b",
    );
  });

  it("reports malformed Codex hooks.json and leaves it alone", async () => {
    const { home, options } = machine();
    const hooksPath = join(home, ".codex", "hooks.json");
    writeFileSync(hooksPath, "{ not json");
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["codex.hook.session_start"]).toMatchObject({
      status: "fail",
      fixable: false,
      action: "edit_file",
    });
    expect(readFileSync(hooksPath, "utf8")).toBe("{ not json");
  });

  it("reports malformed settings.json and never rewrites it", async () => {
    const { home, options } = machine();
    mkdirSync(join(home, ".claude"), { recursive: true });
    const path = join(home, ".claude", "settings.json");
    const broken = '{\n  "hooks": { "Stop": [ }\n';
    writeFileSync(path, broken);
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["claude.settings_valid"]).toMatchObject({
      status: "fail",
      fixable: false,
      action: "edit_file",
    });
    expect(report["claude.settings_valid"].detail).toContain(
      "is not valid JSON",
    );
    for (const id of [
      "claude.hook.session_start",
      "claude.hook.session_end",
      "claude.hook.stop",
    ] as const)
      expect(report[id]).toMatchObject({ status: "fail", fixable: false });
    expect(readFileSync(path, "utf8")).toBe(broken);
    expect(
      readdirSync(join(home, ".claude")).some((name) =>
        name.includes("primitive-bak"),
      ),
    ).toBe(false);
    // Unrelated repairs still happen.
    expect(report["claude.instructions"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
  });

  it("reports a hooks value of the wrong type without touching it", async () => {
    const { home, options } = machine();
    mkdirSync(join(home, ".claude"), { recursive: true });
    const path = join(home, ".claude", "settings.json");
    writeFileSync(path, '{"hooks": {"SessionStart": {"not": "a list"}}}\n');
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["claude.hook.session_start"]).toMatchObject({
      status: "fail",
      fixable: false,
    });
    expect(report["claude.hook.session_end"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    const settings = JSON.parse(readFileSync(path, "utf8"));
    expect(settings.hooks.SessionStart).toEqual({ not: "a list" });
  });

  it("preserves user text around the managed block and refuses broken markers", async () => {
    const { home, options } = machine();
    const claudeMd = join(home, ".claude", "CLAUDE.md");
    const before = "# Mine\n\nRule one.\n\n";
    const after = "\n\n## Later\nRule two.\n";
    writeFileSync(
      claudeMd,
      `${before}<!-- primitive:managed-block v=0 START -->\nold\n<!-- primitive:managed-block END -->${after}`,
    );
    const codexMd = join(home, ".codex", "AGENTS.md");
    const malformed =
      "keep\n<!-- primitive:managed-block v=1 START -->\nhalf a block\n";
    writeFileSync(codexMd, malformed);
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["claude.instructions"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(readFileSync(claudeMd, "utf8")).toBe(
      `${before}${renderManagedBlock(managedInstructions("claude"))}${after}`,
    );
    expect(report["codex.instructions"]).toMatchObject({
      status: "fail",
      fixable: false,
      action: "edit_file",
    });
    expect(readFileSync(codexMd, "utf8")).toBe(malformed);
  });

  it("points runtimes that get the skill at it instead of summarizing it", () => {
    for (const runtime of ["claude", "codex"] as const) {
      const block = managedInstructions(runtime);
      const rules = block.split("\n").filter((line) => line.startsWith("- "));
      expect(rules[0]).toContain("Load the `primitive-connect` skill");
      expect(block).not.toContain("agent working set");
      expect(block).not.toContain("read receipts are automatic");
    }
    const unbundled = managedInstructions("claude", { skillBundled: false });
    expect(unbundled).not.toContain("primitive-connect");
    expect(unbundled).toContain("agent working clear");
    const omp = managedInstructions("omp");
    expect(omp).not.toContain("primitive-connect");
    expect(omp).toContain("primitive reply");
    expect(omp).toContain("agent working clear");
  });

  it("uses Codex's override file when it has content", async () => {
    const { home, options } = machine();
    writeFileSync(join(home, ".codex", "AGENTS.override.md"), "Override.\n");
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["codex.instructions"].path).toBe(
      join(home, ".codex", "AGENTS.override.md"),
    );
    expect(existsSync(join(home, ".codex", "AGENTS.md"))).toBe(false);
  });

  it("skips omp when it is absent and writes its AGENTS.md when present", async () => {
    const absent = machine({ runtimes: ["claude"] });
    const report = byId(
      await runMachineDoctor({ ...absent.options, fix: true }),
    );
    expect(report["omp.instructions"].status).toBe("skip");
    expect(report["codex.instructions"].status).toBe("skip");
    expect(existsSync(join(absent.home, ".omp"))).toBe(false);
    expect(existsSync(join(absent.home, ".codex"))).toBe(false);

    const present = machine({ runtimes: ["omp"] });
    const ompReport = byId(
      await runMachineDoctor({ ...present.options, fix: true }),
    );
    expect(ompReport["omp.instructions"]).toMatchObject({
      status: "ok",
      fixed: true,
      path: join(present.home, ".omp", "agent", "AGENTS.md"),
    });
    expect(
      readFileSync(join(present.home, ".omp", "agent", "AGENTS.md"), "utf8"),
    ).toContain("--runtime omp");
  });

  it("keeps the short rules when no skill is bundled to install", async () => {
    const { home, options } = machine({ runtimes: ["claude"] });
    await runMachineDoctor({
      ...options,
      fix: true,
      bundle: () => {
        throw new Error("no bundled skill");
      },
    });
    const written = readFileSync(join(home, ".claude", "CLAUDE.md"), "utf8");
    expect(written).not.toContain("primitive-connect");
    expect(written).toContain("agent working clear");
  });

  it("with --check repairs only the named check and still reports all of them", async () => {
    const { home, options } = machine();
    const report = await runMachineDoctor({
      ...options,
      fix: true,
      only: new Set(["claude.instructions"]),
    });
    const checks = byId(report);
    expect(report.checks).toHaveLength(15);
    expect(checks["claude.instructions"]).toMatchObject({ fixed: true });
    expect(checks["codex.instructions"].status).toBe("fail");
    expect(checks["claude.hook.session_start"].status).toBe("fail");
    expect(existsSync(join(home, ".claude", "settings.json"))).toBe(false);
    expect(report.fixedCount).toBe(1);
  });

  it("fails cli.version below --min-cli-version and warns when behind npm", async () => {
    const { options } = machine();
    const below = byId(
      await runMachineDoctor({ ...options, minCliVersion: "1.41.0" }),
    );
    expect(below["cli.version"]).toMatchObject({
      status: "fail",
      action: "update_cli",
    });
    const behind = byId(
      await runMachineDoctor({
        ...options,
        minCliVersion: "1.39.2",
        latestVersion: async () => "1.42.0",
      }),
    );
    expect(behind["cli.version"].status).toBe("warn");
    const offline = byId(
      await runMachineDoctor({ ...options, latestVersion: async () => null }),
    );
    expect(offline["cli.version"].status).toBe("skip");
  });

  it("refuses to point hooks at a package-runner cache", async () => {
    const { root, options } = machine();
    const npx = join(root, "_npx", "abc", "node_modules", "primitive", "bin");
    mkdirSync(npx, { recursive: true });
    for (const file of ["run.js", "claude-wake.mjs", "claude-pending-mail.mjs"])
      writeFileSync(join(npx, file), "");
    const report = byId(
      await runMachineDoctor({
        ...options,
        cliEntry: join(npx, "run.js"),
        fix: true,
      }),
    );
    expect(report["cli.path_stable"]).toMatchObject({
      status: "fail",
      action: "install_cli",
    });
    expect(report["claude.hook.session_start"]).toMatchObject({
      status: "fail",
      fixable: false,
      action: "install_cli",
    });
  });

  it("moves profiles revoked in Primitive aside locally and drops their hooks", async () => {
    const { home, bin, configDir, options } = machine();
    const name = `session-${sessionA}`;
    saveConnectedAgentProfile(configDir, name, profile("revoked@example.test"));
    // Bound to a live session, so only the move aside stops its hooks
    // being reinstalled.
    writeMailJson(join(agentProfileDirectory(configDir, name), "setup.json"), {
      session: sessionA,
      receiverMode: "external",
    });
    saveConnectedAgentProfile(
      configDir,
      `session-${sessionB}`,
      profile("live@example.test"),
    );
    mkdirSync(join(home, ".claude"), { recursive: true });
    writeFileSync(
      join(home, ".claude", "settings.json"),
      JSON.stringify({
        hooks: {
          Stop: [
            {
              hooks: [
                wakeHook(
                  bin,
                  configDir,
                  name,
                  "revoked@example.test",
                  sessionA,
                ),
              ],
            },
          ],
        },
      }),
    );
    const fetchStub = (async (
      input: string | URL | Request,
      init?: RequestInit,
    ) => {
      const auth = new Headers(init?.headers).get("authorization") ?? "";
      const address = auth.includes("revoked")
        ? "revoked@example.test"
        : "live@example.test";
      if (String(input).endsWith("/agent-connections/me"))
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              connection: {
                address,
                status: address.startsWith("revoked") ? "revoked" : "connected",
              },
            },
          }),
          { status: 200 },
        );
      throw new TypeError("offline");
    }) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fix: true, fetch: fetchStub }),
    );
    expect(report["profiles.orphaned"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(
      existsSync(join(configDir, "agent-connections", "profiles", name)),
    ).toBe(false);
    const aside = readdirSync(join(configDir, "agent-connections", "orphaned"));
    expect(aside).toEqual([`${name}-20261002T120000Z`]);
    expect(
      lstatSync(
        join(configDir, "agent-connections", "profiles", `session-${sessionB}`),
      ).isDirectory(),
    ).toBe(true);
    expect(report["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(
      readFileSync(join(home, ".claude", "settings.json"), "utf8"),
    ).not.toContain("revoked@example.test");
  });

  it("rewrites receive hooks that pin the versioned Node binary to the stable PATH link", async () => {
    const { root, home, bin, configDir, options } = machine({
      runtimes: ["claude"],
    });
    const settingsPath = join(home, ".claude", "settings.json");
    // A package manager's bin/node links to the versioned binary that an
    // upgrade replaces.
    const versioned = realpathSync(process.execPath);
    const pathDir = join(root, "path-bin");
    mkdirSync(pathDir);
    const link = join(pathDir, "node");
    symlinkSync(versioned, link);
    const env = { PATH: pathDir };
    saveConnectedAgentProfile(
      configDir,
      "my-agent",
      profile("my-agent@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "my-agent"), "setup.json"),
      { session: sessionA, receiverMode: "external" },
    );
    const wake = {
      ...wakeHook(
        bin,
        configDir,
        "my-agent",
        "my-agent@example.test",
        sessionA,
      ),
      command: versioned,
    };
    const pending = {
      type: "command",
      command: versioned,
      args: [
        join(bin, "claude-pending-mail.mjs"),
        join(bin, "run.js"),
        configDir,
        "my-agent",
        "my-agent@example.test",
        sessionA,
        "primitive-pending-mail-v1",
      ],
      timeout: 10,
    };
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [wake] }],
          SessionStart: [{ matcher: "resume", hooks: [wake] }],
          PostToolUse: [{ hooks: [pending] }],
        },
      }),
    );
    const before = byId(await runMachineDoctor({ ...options, env }));
    expect(before["claude.hook.stop"].status).toBe("fail");
    expect(before["claude.hook.stop"].detail).toContain(
      "3 pointing at an old CLI path",
    );
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        env,
        fix: true,
        only: new Set(["claude.hook.stop"]),
      }),
    );
    expect(fixed["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    const hooks = JSON.parse(readFileSync(settingsPath, "utf8")).hooks;
    for (const event of ["Stop", "SessionStart", "PostToolUse"])
      expect(hooks[event][0].hooks[0].command).toBe(link);
    const again = byId(await runMachineDoctor({ ...options, env }));
    expect(again["claude.hook.stop"].status).toBe("ok");
  });

  it("replaces a receive hook naming an old address, agreeing with connect --status", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    saveConnectedAgentProfile(
      configDir,
      "my-agent",
      profile("new@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "my-agent"), "setup.json"),
      { session: sessionA, receiverMode: "external" },
    );
    const old = wakeHook(
      bin,
      configDir,
      "my-agent",
      "old@example.test",
      sessionA,
    );
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [old] }],
          SessionStart: [{ matcher: "resume", hooks: [old] }],
        },
      }),
    );
    const status = () =>
      claudeWakeHookStatus({
        configDir,
        profileName: "my-agent",
        agentAddress: "new@example.test",
        sessionId: sessionA,
        env: { CLAUDE_CONFIG_DIR: join(home, ".claude") },
      }).installed;
    expect(status()).toBe(false);
    const before = byId(await runMachineDoctor(options));
    expect(before["claude.hook.stop"].status).toBe("fail");
    expect(before["claude.hook.stop"].detail).toContain(
      "2 naming an old agent address",
    );
    expect(before["claude.hook.stop"].detail).toContain(
      "3 missing for connected sessions",
    );
    const fixed = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(fixed["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    const text = readFileSync(settingsPath, "utf8");
    expect(text).not.toContain("old@example.test");
    expect(JSON.parse(text).hooks.Stop).toEqual([
      {
        hooks: [
          wakeHook(bin, configDir, "my-agent", "new@example.test", sessionA),
        ],
      },
    ]);
    expect(status()).toBe(true);
  });

  it("names each profile and session the receive hook repair would change, and reports what it changed", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    saveConnectedAgentProfile(
      configDir,
      "my-agent",
      profile("my-agent@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "my-agent"), "setup.json"),
      { session: sessionA, receiverMode: "external" },
    );
    // A hook for a profile that no longer exists is stale.
    const dead = wakeHook(
      bin,
      configDir,
      "removed-agent",
      "gone@example.test",
      sessionB,
    );
    writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [{ hooks: [dead] }] } }),
    );
    const before = byId(await runMachineDoctor(options));
    const stop = before["claude.hook.stop"];
    expect(stop.status).toBe("fail");
    expect(stop.detail).toContain(
      `Affected: profile my-agent, session ${sessionA}; profile removed-agent, session ${sessionB}.`,
    );
    expect(stop.items).toEqual([
      {
        profile: "my-agent",
        session: sessionA,
        hook: "Stop",
        state: "missing",
      },
      {
        profile: "my-agent",
        session: sessionA,
        hook: "SessionStart",
        state: "missing",
      },
      {
        profile: "my-agent",
        session: sessionA,
        hook: "PostToolUse",
        state: "missing",
      },
      {
        profile: "removed-agent",
        session: sessionB,
        hook: "Stop",
        state: "stale",
      },
    ]);
    expect(stop.changes).toBeUndefined();

    const fixed = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(fixed["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(fixed["claude.hook.stop"].items).toBeUndefined();
    expect(fixed["claude.hook.stop"].changes).toEqual([
      {
        profile: "removed-agent",
        session: sessionB,
        hook: "Stop",
        state: "stale",
        action: "removed",
      },
      {
        profile: "my-agent",
        session: sessionA,
        hook: "Stop",
        state: "missing",
        action: "added",
      },
      {
        profile: "my-agent",
        session: sessionA,
        hook: "SessionStart",
        state: "missing",
        action: "added",
      },
      {
        profile: "my-agent",
        session: sessionA,
        hook: "PostToolUse",
        state: "missing",
        action: "added",
      },
    ]);
  });

  it("reports no receive hook changes when the settings write fails", async () => {
    const { home, configDir, options } = machine({ runtimes: ["claude"] });
    const claudeDir = join(home, ".claude");
    const settingsPath = join(claudeDir, "settings.json");
    writeFileSync(settingsPath, "{}\n");
    saveConnectedAgentProfile(
      configDir,
      "my-agent",
      profile("my-agent@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "my-agent"), "setup.json"),
      { session: sessionA, receiverMode: "external" },
    );
    // Another command holds the settings lock, so every write fails. The
    // SessionStart repair runs first and would also add the receive hooks.
    const release = acquireListenLock(claudeDir, "primitive-claude-settings");
    let report: ReturnType<typeof byId>;
    try {
      report = byId(await runMachineDoctor({ ...options, fix: true }));
    } finally {
      release();
    }
    const stop = report["claude.hook.stop"];
    expect(stop.status).toBe("fail");
    expect(stop.fixed).toBeFalsy();
    expect(stop.changes).toBeUndefined();
    expect(stop.items).toHaveLength(3);
    expect(stop.detail).toContain(
      "Repair failed: Another Primitive command is editing Claude settings",
    );
    expect(report["claude.hook.session_start"].detail).toContain(
      "Repair failed",
    );
    expect(readFileSync(settingsPath, "utf8")).toBe("{}\n");
  }, 20_000);

  it("with profiles set, repairs only those profiles' receive hooks", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    writeFileSync(settingsPath, "{}\n");
    for (const [name, session] of [
      ["my-agent", sessionA],
      ["test-agent", sessionB],
    ] as const) {
      saveConnectedAgentProfile(
        configDir,
        name,
        profile(`${name}@example.test`),
      );
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        { session, receiverMode: "external" },
      );
    }
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        only: new Set(["claude.hook.stop"]),
        profiles: new Set(["my-agent"]),
      }),
    );
    const stop = fixed["claude.hook.stop"];
    expect(stop.status).toBe("fail");
    expect(stop.fixed).toBe(false);
    expect(stop.detail).toContain("Only the selected profiles were repaired.");
    expect(stop.changes?.map((change) => change.profile)).toEqual([
      "my-agent",
      "my-agent",
      "my-agent",
    ]);
    expect(stop.changes?.every((change) => change.action === "added")).toBe(
      true,
    );
    expect(
      stop.items?.map((item) => [item.profile, item.state, item.selected]),
    ).toEqual([
      ["test-agent", "missing", false],
      ["test-agent", "missing", false],
      ["test-agent", "missing", false],
    ]);
    const text = readFileSync(settingsPath, "utf8");
    expect(text).toContain("my-agent@example.test");
    expect(text).not.toContain("test-agent@example.test");
    expect(JSON.parse(text).hooks.Stop).toEqual([
      {
        hooks: [
          wakeHook(
            bin,
            configDir,
            "my-agent",
            "my-agent@example.test",
            sessionA,
          ),
        ],
      },
    ]);
  });

  it("reinstalls a removed receive hook for a connected session, never for an ended one", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    writeFileSync(settingsPath, '{"model": "opus"}\n');
    for (const [name, session] of [
      ["my-agent", sessionA],
      ["finished", sessionB],
    ] as const) {
      saveConnectedAgentProfile(
        configDir,
        name,
        profile(`${name}@example.test`),
      );
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        { session, receiverMode: "external" },
      );
    }
    writeMailJson(join(configDir, "machine", "sessions", `${sessionB}.json`), {
      version: 1,
      session: sessionB,
      endedAt: "2026-10-01T00:00:00.000Z",
    });
    const before = byId(await runMachineDoctor(options));
    expect(before["claude.hook.stop"]).toMatchObject({
      status: "fail",
      fixable: true,
    });
    expect(before["claude.hook.stop"].detail).toContain(
      "3 missing for connected sessions",
    );

    const fixed = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(fixed["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.model).toBe("opus");
    expect(settings.hooks.Stop).toEqual([
      {
        hooks: [
          wakeHook(
            bin,
            configDir,
            "my-agent",
            "my-agent@example.test",
            sessionA,
          ),
        ],
      },
    ]);
    expect(settings.hooks.SessionStart).toContainEqual({
      matcher: "resume",
      hooks: [
        wakeHook(bin, configDir, "my-agent", "my-agent@example.test", sessionA),
      ],
    });
    expect(settings.hooks.PostToolUse).toEqual([
      {
        hooks: [
          {
            type: "command",
            command: process.execPath,
            args: [
              join(bin, "claude-pending-mail.mjs"),
              join(bin, "run.js"),
              configDir,
              "my-agent",
              "my-agent@example.test",
              sessionA,
              "primitive-pending-mail-v1",
            ],
            timeout: 10,
          },
        ],
      },
    ]);
    expect(JSON.stringify(settings)).not.toContain("finished");

    const again = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(again["claude.hook.stop"]).toMatchObject({ status: "ok" });
    expect(again["claude.hook.stop"].fixed).toBeFalsy();
  });

  it("does not bind a second profile to a session that receives through another", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    // The session is connected as prod-agent. other-agent was connected to
    // the same session earlier and its hooks were removed afterwards; it is
    // still used for one-off commands with PRIMITIVE_AGENT_PROFILE.
    for (const name of ["prod-agent", "other-agent"]) {
      saveConnectedAgentProfile(
        configDir,
        name,
        profile(`${name}@example.test`),
      );
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        { session: sessionA, receiverMode: "external" },
      );
    }
    const prod = wakeHook(
      bin,
      configDir,
      "prod-agent",
      "prod-agent@example.test",
      sessionA,
    );
    const pending = {
      type: "command",
      command: process.execPath,
      args: [
        join(bin, "claude-pending-mail.mjs"),
        join(bin, "run.js"),
        configDir,
        "prod-agent",
        "prod-agent@example.test",
        sessionA,
        "primitive-pending-mail-v1",
      ],
      timeout: 10,
    };
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          Stop: [{ hooks: [prod] }],
          SessionStart: [{ matcher: "resume", hooks: [prod] }],
          PostToolUse: [{ hooks: [pending] }],
        },
      }),
    );
    const only = new Set<DoctorCheckId>(["claude.hook.stop"]);
    const before = byId(await runMachineDoctor({ ...options, only }));
    expect(before["claude.hook.stop"].status).toBe("ok");
    expect(before["claude.hook.stop"].detail).toContain(
      `profile other-agent is bound to session ${sessionA}, which receives as prod-agent`,
    );

    const text = readFileSync(settingsPath, "utf8");
    const fixed = byId(await runMachineDoctor({ ...options, fix: true, only }));
    expect(fixed["claude.hook.stop"].status).toBe("ok");
    expect(fixed["claude.hook.stop"].changes).toBeUndefined();
    expect(readFileSync(settingsPath, "utf8")).toBe(text);

    // Naming the profile is the deliberate choice that binds it.
    const chosen = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        only,
        profiles: new Set(["other-agent"]),
      }),
    );
    expect(
      chosen["claude.hook.stop"].changes?.map((change) => [
        change.profile,
        change.action,
      ]),
    ).toEqual([
      ["other-agent", "added"],
      ["other-agent", "added"],
      ["other-agent", "added"],
    ]);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(JSON.stringify(settings.hooks.Stop)).toContain("prod-agent");
    expect(JSON.stringify(settings.hooks.Stop)).toContain("other-agent");
  });

  it("restores a profile that lost only some receive hooks, even beside another profile", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    for (const name of ["prod-agent", "other-agent"]) {
      saveConnectedAgentProfile(
        configDir,
        name,
        profile(`${name}@example.test`),
      );
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        { session: sessionA, receiverMode: "external" },
      );
    }
    const prod = wakeHook(
      bin,
      configDir,
      "prod-agent",
      "prod-agent@example.test",
      sessionA,
    );
    // prod-agent still has its Stop hook; the other two were lost.
    writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [{ hooks: [prod] }] } }),
    );
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        only: new Set(["claude.hook.stop"]),
      }),
    );
    expect(
      fixed["claude.hook.stop"].changes?.map((change) => [
        change.profile,
        change.hook,
        change.action,
      ]),
    ).toEqual([
      ["prod-agent", "SessionStart", "added"],
      ["prod-agent", "PostToolUse", "added"],
    ]);
    expect(readFileSync(settingsPath, "utf8")).not.toContain("other-agent");
  });

  it("restores the only connected profile when the session's other hook is stale", async () => {
    const { home, bin, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    saveConnectedAgentProfile(
      configDir,
      "live-agent",
      profile("live-agent@example.test"),
    );
    writeMailJson(
      join(agentProfileDirectory(configDir, "live-agent"), "setup.json"),
      { session: sessionA, receiverMode: "external" },
    );
    // The only hook left for the session belongs to a removed profile.
    const dead = wakeHook(
      bin,
      configDir,
      "removed-agent",
      "gone@example.test",
      sessionA,
    );
    writeFileSync(
      settingsPath,
      JSON.stringify({ hooks: { Stop: [{ hooks: [dead] }] } }),
    );
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        only: new Set(["claude.hook.stop"]),
      }),
    );
    expect(fixed["claude.hook.stop"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(
      fixed["claude.hook.stop"].changes?.map((change) => [
        change.profile,
        change.hook,
        change.action,
      ]),
    ).toEqual([
      ["removed-agent", "Stop", "removed"],
      ["live-agent", "Stop", "added"],
      ["live-agent", "SessionStart", "added"],
      ["live-agent", "PostToolUse", "added"],
    ]);
    const text = readFileSync(settingsPath, "utf8");
    expect(text).not.toContain("removed-agent");
    expect(JSON.parse(text).hooks.Stop).toEqual([
      {
        hooks: [
          wakeHook(
            bin,
            configDir,
            "live-agent",
            "live-agent@example.test",
            sessionA,
          ),
        ],
      },
    ]);
  });

  it("restores none of several profiles bound to a session that receives as none", async () => {
    const { home, configDir, options } = machine({ runtimes: ["claude"] });
    const settingsPath = join(home, ".claude", "settings.json");
    writeFileSync(settingsPath, "{}\n");
    for (const name of ["prod-agent", "other-agent"]) {
      saveConnectedAgentProfile(
        configDir,
        name,
        profile(`${name}@example.test`),
      );
      writeMailJson(
        join(agentProfileDirectory(configDir, name), "setup.json"),
        { session: sessionA, receiverMode: "external" },
      );
    }
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        only: new Set(["claude.hook.stop"]),
      }),
    );
    expect(fixed["claude.hook.stop"].status).toBe("ok");
    expect(fixed["claude.hook.stop"].detail).toContain(
      "has several bound profiles and receives as none",
    );
    expect(readFileSync(settingsPath, "utf8")).toBe("{}\n");
  });

  it("checks every saved profile, however many there are", async () => {
    const { configDir, options } = machine();
    for (let index = 0; index < 205; index++)
      saveConnectedAgentProfile(
        configDir,
        `profile-${index}`,
        profile(`agent${index}@example.test`),
      );
    const seen = new Set<string>();
    const fetchStub = (async (
      _input: string | URL | Request,
      init?: RequestInit,
    ) => {
      seen.add(new Headers(init?.headers).get("authorization") ?? "");
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            connection: { address: "agent204@example.test", status: "revoked" },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fetch: fetchStub }),
    );
    // Only the last profile matches the revoked reply, so it must have been read.
    expect(report["profiles.orphaned"].detail).toContain(
      "agent204@example.test",
    );
  }, 30_000);

  it("moves aside a rejected profile whose agent is gone from the owner's complete list", async () => {
    const { configDir, options } = machine();
    const removed = `session-${sessionA}`;
    saveConnectedAgentProfile(
      configDir,
      removed,
      profile("removed@example.test"),
    );
    saveCliCredentials(configDir, {
      auth_method: "oauth",
      access_token: ["member", "token"].join("-"),
      refresh_token: ["inert", "refresh"].join("-"),
      token_type: "Bearer",
      expires_at: "2099-01-01T00:00:00.000Z",
      oauth_grant_id: "grant",
      oauth_client_id: "fixture",
      org_id: "33333333-3333-4333-8333-333333333333",
      org_name: null,
      api_base_url: "https://api.primitive.dev/v1",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const listQueries: string[] = [];
    const fetchStub = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/agent-connections/me"))
        return new Response(JSON.stringify({ success: false }), {
          status: 401,
        });
      if (url.pathname.endsWith("/agent-connections")) {
        listQueries.push(url.search);
        return new Response(
          JSON.stringify({
            success: true,
            data: [{ address: "other@example.test", status: "connected" }],
            meta: { cursor: null },
          }),
          { status: 200 },
        );
      }
      throw new TypeError("offline");
    }) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fetch: fetchStub }),
    );
    expect(
      listQueries.every((query) => query.includes("include_hidden=true")),
    ).toBe(true);
    expect(report["profiles.orphaned"]).toMatchObject({
      status: "fail",
      fixable: true,
    });
    expect(report["profiles.orphaned"].detail).toContain(
      "removed@example.test",
    );
    const fixed = byId(
      await runMachineDoctor({ ...options, fix: true, fetch: fetchStub }),
    );
    expect(fixed["profiles.orphaned"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
    expect(
      existsSync(join(configDir, "agent-connections", "profiles", removed)),
    ).toBe(false);
    expect(
      readdirSync(join(configDir, "agent-connections", "orphaned")),
    ).toEqual([`${removed}-20261002T120000Z`]);
  });

  it("never treats a page without an explicit end cursor as the whole list", async () => {
    const { configDir, options } = machine();
    saveConnectedAgentProfile(
      configDir,
      `session-${sessionA}`,
      profile("later-page@example.test"),
    );
    saveCliCredentials(configDir, {
      auth_method: "oauth",
      access_token: ["member", "token"].join("-"),
      refresh_token: ["inert", "refresh"].join("-"),
      token_type: "Bearer",
      expires_at: "2099-01-01T00:00:00.000Z",
      oauth_grant_id: "grant",
      oauth_client_id: "fixture",
      org_id: "33333333-3333-4333-8333-333333333333",
      org_name: null,
      api_base_url: "https://api.primitive.dev/v1",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const fetchStub = (async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/agent-connections"))
        return new Response(
          JSON.stringify({ success: true, data: [], meta: {} }),
          { status: 200 },
        );
      return new Response(JSON.stringify({ success: false }), {
        status: 401,
      });
    }) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fix: true, fetch: fetchStub }),
    );
    expect(report["profiles.orphaned"].status).toBe("warn");
    expect(
      existsSync(
        join(configDir, "agent-connections", "profiles", `session-${sessionA}`),
      ),
    ).toBe(true);
  });

  it("says when rejected profiles belong to another API than the sign-in", async () => {
    const { configDir, options } = machine();
    saveConnectedAgentProfile(configDir, `session-${sessionA}`, {
      ...profile("staging-agent@example.test"),
      api_base_url: "https://api.primitive-staging-1.com/v1",
    });
    saveCliCredentials(configDir, {
      auth_method: "oauth",
      access_token: ["member", "token"].join("-"),
      refresh_token: ["inert", "refresh"].join("-"),
      token_type: "Bearer",
      expires_at: "2099-01-01T00:00:00.000Z",
      oauth_grant_id: "grant",
      oauth_client_id: "fixture",
      org_id: "33333333-3333-4333-8333-333333333333",
      org_name: null,
      api_base_url: "https://api.primitive.dev/v1",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const fetchStub = (async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 401,
      })) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fetch: fetchStub }),
    );
    expect(report["profiles.orphaned"].status).toBe("warn");
    expect(report["profiles.orphaned"].detail).toContain(
      "1 of them belong to an organization or Primitive API your current sign-in is not for",
    );
  });

  it("names rejected profiles it cannot confirm and says how to clean them up", async () => {
    const { configDir, options } = machine();
    saveConnectedAgentProfile(
      configDir,
      `session-${sessionA}`,
      profile("stale@example.test"),
    );
    const fetchStub = (async () =>
      new Response(JSON.stringify({ success: false }), {
        status: 401,
      })) as typeof fetch;
    const report = byId(
      await runMachineDoctor({ ...options, fetch: fetchStub }),
    );
    expect(report["profiles.orphaned"].status).toBe("warn");
    expect(report["profiles.orphaned"].detail).toContain("stale@example.test");
    expect(report["profiles.orphaned"].detail).toContain("primitive login");
  });

  it("retries disconnecting ended sessions whose agent is still connected", async () => {
    const { configDir, options } = machine();
    const { writeMailJson } = await import(
      "../../src/oclif/shared-mail-files.js"
    );
    writeMailJson(join(configDir, "machine", "sessions", `${sessionA}.json`), {
      version: 1,
      runtime: "claude",
      session: sessionA,
      profile: `session-${sessionA}`,
      name: "claude-repo",
      createdBy: "session-register",
      address: "ended@example.test",
      agentInfo: null,
      registeredAt: "2026-10-01T00:00:00.000Z",
      endedAt: "2026-10-01T01:00:00.000Z",
      disconnect: "pending",
    });
    const revoked: string[] = [];
    const before = byId(await runMachineDoctor(options));
    expect(before["profiles.orphaned"]).toMatchObject({
      status: "fail",
      fixable: true,
    });
    expect(before["profiles.orphaned"].detail).toContain("ended@example.test");
    const fixed = byId(
      await runMachineDoctor({
        ...options,
        fix: true,
        sessionDisconnect: {
          revokeByAddress: async (_configDir, address) => {
            revoked.push(address);
            return true;
          },
        },
      }),
    );
    expect(revoked).toEqual(["ended@example.test"]);
    expect(fixed["profiles.orphaned"]).toMatchObject({
      status: "ok",
      fixed: true,
    });
  });

  it("backs up the whole replaced skill, installed helper packages included", async () => {
    const { home, configDir, options } = machine();
    const skill = join(home, ".claude", "skills", "primitive-connect");
    mkdirSync(join(skill, "node_modules", "helper"), { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "old skill\n");
    writeFileSync(
      join(skill, "node_modules", "helper", "index.js"),
      "helper\n",
    );
    const report = byId(await runMachineDoctor({ ...options, fix: true }));
    expect(report["skill.claude"]).toMatchObject({ status: "ok", fixed: true });
    const backups = join(configDir, "machine", "backups", "skills");
    const [backup] = readdirSync(backups).filter((name) =>
      name.startsWith("claude-"),
    );
    expect(readFileSync(join(backups, backup ?? "", "SKILL.md"), "utf8")).toBe(
      "old skill\n",
    );
    expect(
      readFileSync(
        join(backups, backup ?? "", "node_modules", "helper", "index.js"),
        "utf8",
      ),
    ).toBe("helper\n");
  });

  it("keeps only the newest two skill backups", async () => {
    const { home, configDir, options } = machine();
    const skill = join(home, ".claude", "skills", "primitive-connect");
    const backups = join(configDir, "machine", "backups", "skills");
    for (let round = 0; round < 4; round++) {
      mkdirSync(skill, { recursive: true });
      writeFileSync(join(skill, "SKILL.md"), `edited ${round}\n`);
      const report = byId(
        await runMachineDoctor({
          ...options,
          fix: true,
          only: new Set(["skill.claude"]),
          now: () => new Date(Date.UTC(2026, 9, 2, 12, round)),
        }),
      );
      expect(report["skill.claude"].fixed).toBe(true);
    }
    const kept = readdirSync(backups)
      .filter((name) => name.startsWith("claude-"))
      .sort();
    expect(kept).toEqual([
      "claude-000003-20261002T120200Z",
      "claude-000004-20261002T120300Z",
    ]);
    expect(readFileSync(join(backups, kept[1] ?? "", "SKILL.md"), "utf8")).toBe(
      "edited 3\n",
    );
  });

  it("keeps the newest two backups when many replacements share one second", async () => {
    const { home, configDir, options } = machine();
    const skill = join(home, ".claude", "skills", "primitive-connect");
    const backups = join(configDir, "machine", "backups", "skills");
    const sameSecond = () => new Date(Date.UTC(2026, 9, 2, 12, 0, 0, 500));
    for (let round = 0; round < 5; round++) {
      mkdirSync(skill, { recursive: true });
      writeFileSync(join(skill, "SKILL.md"), `edited ${round}\n`);
      const report = byId(
        await runMachineDoctor({
          ...options,
          fix: true,
          only: new Set(["skill.claude"]),
          now: sameSecond,
        }),
      );
      expect(report["skill.claude"].fixed).toBe(true);
    }
    const kept = readdirSync(backups).filter((name) =>
      name.startsWith("claude-"),
    );
    expect(kept.sort()).toEqual([
      "claude-000004-20261002T120000Z",
      "claude-000005-20261002T120000Z",
    ]);
    expect(
      kept.map((name) => readFileSync(join(backups, name, "SKILL.md"), "utf8")),
    ).toEqual(["edited 3\n", "edited 4\n"]);
  });

  it("prunes backups from the earlier naming scheme first", async () => {
    const { home, configDir, options } = machine();
    const skill = join(home, ".claude", "skills", "primitive-connect");
    const backups = join(configDir, "machine", "backups", "skills");
    for (const name of [
      "claude-20261001T090000Z",
      "claude-20261001T090000Z-1",
      "claude-20261001T100000Z",
      "codex-20261001T090000Z",
    ])
      mkdirSync(join(backups, name), { recursive: true });
    for (let round = 0; round < 2; round++) {
      mkdirSync(skill, { recursive: true });
      writeFileSync(join(skill, "SKILL.md"), `edited ${round}\n`);
      await runMachineDoctor({
        ...options,
        fix: true,
        only: new Set(["skill.claude"]),
        now: () => new Date(Date.UTC(2026, 9, 2, 12, round)),
      });
    }
    expect(readdirSync(backups).sort()).toEqual([
      "claude-000001-20261002T120000Z",
      "claude-000002-20261002T120100Z",
      // Another runtime's backups are never touched.
      "codex-20261001T090000Z",
    ]);
  });

  it("after one replacement keeps the newest legacy backup alongside the new one", async () => {
    const { home, configDir, options } = machine();
    const skill = join(home, ".claude", "skills", "primitive-connect");
    const backups = join(configDir, "machine", "backups", "skills");
    for (const name of ["claude-20261001T090000Z", "claude-20261001T090000Z-1"])
      mkdirSync(join(backups, name), { recursive: true });
    mkdirSync(skill, { recursive: true });
    writeFileSync(join(skill, "SKILL.md"), "edited\n");
    await runMachineDoctor({
      ...options,
      fix: true,
      only: new Set(["skill.claude"]),
    });
    expect(readdirSync(backups).sort()).toEqual([
      "claude-000001-20261002T120000Z",
      "claude-20261001T090000Z-1",
    ]);
  });

  it("does not repair while another repair holds the lock", async () => {
    const { configDir, options } = machine();
    const { acquireListenLock } = await import(
      "../../src/oclif/listen-state.js"
    );
    const release = acquireListenLock(
      join(configDir, "machine"),
      "machine-doctor",
    );
    try {
      const report = await runMachineDoctor({ ...options, fix: true });
      expect(report.repair).toBe("skipped_busy");
      expect(report.fixedCount).toBe(0);
    } finally {
      release();
    }
  }, 20_000);
});
