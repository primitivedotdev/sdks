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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { codexHookTrustHash } from "../../src/oclif/codex-machine-hooks.js";
import {
  type ConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  type DoctorCheckId,
  type DoctorReport,
  type MachineDoctorOptions,
  managedInstructions,
  runMachineDoctor,
} from "../../src/oclif/machine-doctor.js";
import { renderManagedBlock } from "../../src/oclif/machine-files.js";

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
