import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  CONNECT_SKILL_NAME,
  connectSkillTarget,
  connectSkillVersion,
  detectAgentRuntime,
  installConnectSkill,
  readBundledConnectSkill,
} from "../../src/oclif/connect-skill.js";

const cliRoot = resolve(import.meta.dirname, "../..");
const session = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const directories: string[] = [];
function temp(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of directories.splice(0)) {
    try {
      chmodSync(directory, 0o700);
    } catch {}
    rmSync(directory, { recursive: true, force: true });
  }
});

/** Run the real build step into a scratch package root. */
function bundledPackage(): string {
  const root = temp("connect-skill-package-");
  execFileSync(
    process.execPath,
    [
      join(cliRoot, "scripts", "bundle-skills.mjs"),
      "--out",
      join(root, "dist"),
    ],
    { stdio: "ignore" },
  );
  return root;
}

function files(root: string): string[] {
  const out: string[] = [];
  const walk = (directory: string, prefix: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(join(directory, entry.name), relative);
      else out.push(relative);
    }
  };
  walk(root, "");
  return out.sort();
}

describe("runtime detection", () => {
  it("names the runtime whose environment holds this exact session", () => {
    expect(
      detectAgentRuntime(session, { CLAUDE_CODE_SESSION_ID: session }),
    ).toBe("claude");
    expect(
      detectAgentRuntime(session.toUpperCase(), {
        CLAUDE_CODE_SESSION_ID: session,
      }),
    ).toBe("claude");
    expect(detectAgentRuntime(session, { CODEX_THREAD_ID: session })).toBe(
      "codex",
    );
    expect(detectAgentRuntime(session, { CODEX_SESSION_ID: session })).toBe(
      "codex",
    );
  });
  it("prefers the loaded Codex thread over its process session", () => {
    expect(
      detectAgentRuntime(session, {
        CODEX_THREAD_ID: other,
        CODEX_SESSION_ID: session,
      }),
    ).toBeNull();
    expect(
      detectAgentRuntime(other, {
        CODEX_THREAD_ID: other,
        CODEX_SESSION_ID: session,
      }),
    ).toBe("codex");
  });
  it("refuses to guess for a different, ambiguous or malformed session", () => {
    expect(detectAgentRuntime(session, {})).toBeNull();
    expect(
      detectAgentRuntime(session, { CLAUDE_CODE_SESSION_ID: other }),
    ).toBeNull();
    expect(
      detectAgentRuntime(session, {
        CLAUDE_CODE_SESSION_ID: session,
        CODEX_THREAD_ID: session,
      }),
    ).toBeNull();
    expect(
      detectAgentRuntime("not-a-session", {
        CLAUDE_CODE_SESSION_ID: "not-a-session",
      }),
    ).toBeNull();
  });
});

describe("skill target", () => {
  it("uses each runtime's user skills folder and honors its config override", () => {
    const home = temp("connect-skill-home-");
    expect(
      connectSkillTarget({
        runtime: "claude",
        env: { CLAUDE_CONFIG_DIR: join(home, "claude") },
      }),
    ).toBe(join(home, "claude", "skills", CONNECT_SKILL_NAME));
    expect(
      connectSkillTarget({
        runtime: "codex",
        env: { CODEX_HOME: join(home, "codex") },
      }),
    ).toBe(join(home, "codex", "skills", CONNECT_SKILL_NAME));
  });
  it("installs into the project with --project", () => {
    const cwd = temp("connect-skill-project-");
    expect(connectSkillTarget({ runtime: "claude", project: true, cwd })).toBe(
      join(cwd, ".claude", "skills", CONNECT_SKILL_NAME),
    );
    expect(connectSkillTarget({ runtime: "codex", project: true, cwd })).toBe(
      join(cwd, ".agents", "skills", CONNECT_SKILL_NAME),
    );
  });
});

describe("bundled skill", () => {
  it("ships exactly the vendored files with the recorded source version", () => {
    const bundle = readBundledConnectSkill(bundledPackage());
    const vendored = join(cliRoot, "vendor", "skills", CONNECT_SKILL_NAME);
    const source = JSON.parse(
      readFileSync(
        join(cliRoot, "vendor", "skills", `${CONNECT_SKILL_NAME}.source.json`),
        "utf8",
      ),
    );
    expect(Object.keys(bundle.files)).toEqual(files(vendored));
    expect(files(bundle.directory)).toEqual(files(vendored));
    for (const file of files(vendored))
      expect(readFileSync(join(bundle.directory, file))).toEqual(
        readFileSync(join(vendored, file)),
      );
    expect(bundle.version).toBe(source.version);
    expect(connectSkillVersion(bundle.files)).toBe(source.version);
    expect(bundle.commit).toBe(source.commit);
    expect(source.repository).toBe("https://github.com/primitivedotdev/skills");
    expect(files(vendored)).toContain("SKILL.md");
    expect(files(vendored).some((file) => /\.test\./.test(file))).toBe(false);
  });
  it("leads the bundled skill with the one command", () => {
    const skill = readFileSync(
      join(cliRoot, "vendor", "skills", CONNECT_SKILL_NAME, "SKILL.md"),
      "utf8",
    );
    const firstSection = skill.slice(skill.indexOf("\n## ") + 1);
    expect(firstSection.startsWith("## Connect in one command")).toBe(true);
    expect(skill).toContain(
      `npx -y primitive@latest agent connect --session "$CLAUDE_CODE_SESSION_ID" --json`,
    );
  });
  it("refuses a bundle whose files no longer match the manifest", () => {
    const root = bundledPackage();
    writeFileSync(
      join(root, "dist", "skills", CONNECT_SKILL_NAME, "SKILL.md"),
      "tampered",
    );
    expect(() => readBundledConnectSkill(root)).toThrow(/manifest/);
  });
  it("refuses a missing bundle", () => {
    expect(() =>
      readBundledConnectSkill(temp("connect-skill-empty-")),
    ).toThrow();
  });
  it("refuses a build from hand-edited vendored files", () => {
    const root = temp("connect-skill-copy-");
    mkdirSync(join(root, "scripts"));
    for (const script of ["bundle-skills.mjs", "skill-files.mjs"])
      writeFileSync(
        join(root, "scripts", script),
        readFileSync(join(cliRoot, "scripts", script)),
      );
    execFileSync("cp", ["-R", join(cliRoot, "vendor"), join(root, "vendor")]);
    writeFileSync(
      join(root, "vendor", "skills", CONNECT_SKILL_NAME, "SKILL.md"),
      "edited",
    );
    expect(() =>
      execFileSync(
        process.execPath,
        [join(root, "scripts", "bundle-skills.mjs")],
        { stdio: "pipe" },
      ),
    ).toThrow(/edited by hand/);
  });
});

describe("skill install", () => {
  function setup(runtime: "claude" | "codex" = "codex") {
    const bundle = readBundledConnectSkill(bundledPackage());
    const home = temp("connect-skill-install-");
    const env = {
      CODEX_HOME: join(home, "codex"),
      CLAUDE_CONFIG_DIR: join(home, "claude"),
    };
    const install = () => installConnectSkill({ bundle, runtime, env });
    const target = connectSkillTarget({ runtime, env });
    return { bundle, env, install, target };
  }
  const leftovers = (target: string) =>
    readdirSync(resolve(target, "..")).filter((name) => name.startsWith("."));

  it("installs once and is idempotent for the same version", () => {
    const { bundle, install, target } = setup();
    expect(install()).toEqual({
      state: "installed",
      runtime: "codex",
      path: target,
      version: bundle.version,
    });
    expect(files(target)).toEqual(Object.keys(bundle.files));
    const before = lstatSync(join(target, "SKILL.md")).mtimeMs;
    expect(install()).toEqual({
      state: "unchanged",
      runtime: "codex",
      path: target,
      version: bundle.version,
    });
    expect(lstatSync(join(target, "SKILL.md")).mtimeMs).toBe(before);
    expect(readdirSync(resolve(target, ".."))).toEqual([CONNECT_SKILL_NAME]);
  });
  it("replaces a different version in place without a duplicate directory", () => {
    const { bundle, install, target } = setup("claude");
    install();
    writeFileSync(join(target, "SKILL.md"), "older text");
    writeFileSync(join(target, "stale.md"), "removed on refresh");
    const result = install();
    expect(result.state).toBe("updated");
    expect(result.previousVersion).toMatch(/^[0-9a-f]{16}$/);
    expect(result.previousVersion).not.toBe(bundle.version);
    expect(files(target)).toEqual(Object.keys(bundle.files));
    expect(readdirSync(resolve(target, ".."))).toEqual([CONNECT_SKILL_NAME]);
    expect(leftovers(target)).toEqual([]);
  });
  it("replaces a symlinked copy without touching the link target", () => {
    const { bundle, install, target } = setup();
    const shared = temp("connect-skill-shared-");
    writeFileSync(
      join(shared, "SKILL.md"),
      "---\nname: primitive-connect\n---\nold",
    );
    mkdirSync(resolve(target, ".."), { recursive: true });
    symlinkSync(shared, target);
    const result = install();
    expect(result.state).toBe("updated");
    expect(lstatSync(target).isSymbolicLink()).toBe(false);
    expect(files(target)).toEqual(Object.keys(bundle.files));
    expect(readFileSync(join(shared, "SKILL.md"), "utf8")).toContain("old");
  });
  it("replaces a symlink even when it points at the same version", () => {
    const { bundle, install, target } = setup();
    const shared = temp("connect-skill-same-");
    execFileSync("cp", ["-R", `${bundle.directory}/.`, shared]);
    mkdirSync(resolve(target, ".."), { recursive: true });
    symlinkSync(shared, target);
    const result = install();
    expect(result).toMatchObject({ state: "updated", replacedLink: true });
    expect(result).not.toHaveProperty("previousVersion");
    expect(lstatSync(target).isSymbolicLink()).toBe(false);
    expect(install().state).toBe("unchanged");
  });
  it("puts back a copy left aside by an interrupted refresh, then refreshes it", () => {
    const { bundle, install, target } = setup();
    install();
    writeFileSync(join(target, "SKILL.md"), "older");
    const root = resolve(target, "..");
    const retired = join(root, `.${CONNECT_SKILL_NAME}.retired-old`);
    const staging = join(root, `.${CONNECT_SKILL_NAME}.staging-old`);
    renameSync(target, retired);
    mkdirSync(staging);
    const past = new Date(Date.now() - 120_000);
    utimesSync(retired, past, past);
    utimesSync(staging, past, past);
    const result = install();
    expect(result).toMatchObject({ state: "updated", recovered: true });
    expect(result.previousVersion).toBeDefined();
    expect(files(target)).toEqual(Object.keys(bundle.files));
    expect(leftovers(target)).toEqual([]);
  });
  it("leaves fresh leftovers that may belong to a refresh in progress", () => {
    const { install, target } = setup();
    install();
    const root = resolve(target, "..");
    const fresh = join(root, `.${CONNECT_SKILL_NAME}.staging-live`);
    mkdirSync(fresh);
    expect(install().state).toBe("unchanged");
    expect(existsSync(fresh)).toBe(true);
  });
  it("keeps installed helper dependencies when the lockfile is unchanged", () => {
    const { install, target } = setup();
    install();
    mkdirSync(join(target, "node_modules", "dep"), { recursive: true });
    writeFileSync(join(target, "node_modules", "dep", "index.js"), "kept");
    writeFileSync(join(target, "SKILL.md"), "older");
    const result = install();
    expect(result).toMatchObject({ state: "updated", dependencies: "kept" });
    expect(
      readFileSync(join(target, "node_modules", "dep", "index.js"), "utf8"),
    ).toBe("kept");
    expect(leftovers(target)).toEqual([]);
  });
  it("recovers helper dependencies left in the old copy by an interrupted refresh", () => {
    const { install, target } = setup();
    install();
    const root = resolve(target, "..");
    const retired = join(root, `.${CONNECT_SKILL_NAME}.retired-old`);
    execFileSync("cp", ["-R", target, retired]);
    writeFileSync(join(retired, "SKILL.md"), "older");
    mkdirSync(join(retired, "node_modules", "dep"), { recursive: true });
    writeFileSync(join(retired, "node_modules", "dep", "index.js"), "kept");
    const past = new Date(Date.now() - 120_000);
    utimesSync(retired, past, past);
    expect(install().state).toBe("unchanged");
    expect(
      readFileSync(join(target, "node_modules", "dep", "index.js"), "utf8"),
    ).toBe("kept");
    expect(leftovers(target)).toEqual([]);
  });
  it("never carries recovered dependencies through a symlink", () => {
    const { bundle, install, target } = setup();
    const root = resolve(target, "..");
    mkdirSync(root, { recursive: true });
    const shared = temp("connect-skill-linked-");
    execFileSync("cp", ["-R", `${bundle.directory}/.`, shared]);
    symlinkSync(shared, target);
    const retired = join(root, `.${CONNECT_SKILL_NAME}.retired-old`);
    execFileSync("cp", ["-R", `${bundle.directory}/.`, retired]);
    mkdirSync(join(retired, "node_modules"));
    const past = new Date(Date.now() - 120_000);
    utimesSync(retired, past, past);
    expect(install()).toMatchObject({ state: "updated", replacedLink: true });
    expect(existsSync(join(shared, "node_modules"))).toBe(false);
    expect(leftovers(target)).toEqual([]);
  });
  it("asks for a dependency reinstall when the lockfile changed", () => {
    const { install, target } = setup();
    install();
    mkdirSync(join(target, "node_modules"), { recursive: true });
    writeFileSync(join(target, "package-lock.json"), "{}");
    const result = install();
    expect(result).toMatchObject({
      state: "updated",
      dependencies: "reinstall_needed",
    });
    expect(existsSync(join(target, "node_modules"))).toBe(false);
  });
  it("reports other copies of the skill without deleting them", () => {
    const { install, target } = setup();
    const root = resolve(target, "..");
    for (const name of ["primitive-connect-30a17ad", "unrelated"]) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(
        join(root, name, "SKILL.md"),
        `---\nname: ${name === "unrelated" ? "something-else" : CONNECT_SKILL_NAME}\ndescription: x\n---\n`,
      );
    }
    const first = install();
    expect(first.otherCopies).toEqual([
      join(root, "primitive-connect-30a17ad"),
    ]);
    expect(install().otherCopies).toEqual([
      join(root, "primitive-connect-30a17ad"),
    ]);
    expect(existsSync(join(root, "primitive-connect-30a17ad"))).toBe(true);
  });
  it("reports a failed install and leaves no staging directory", () => {
    const { install, target } = setup();
    const root = resolve(target, "..");
    mkdirSync(root, { recursive: true });
    chmodSync(root, 0o500);
    try {
      const result = install();
      expect(result.state).toBe("failed");
      expect(result.reason).toBeTruthy();
      expect(existsSync(target)).toBe(false);
    } finally {
      chmodSync(root, 0o700);
    }
    expect(leftovers(target)).toEqual([]);
  });
  it("keeps the previous copy when a refresh cannot be staged", () => {
    const { install, target } = setup();
    install();
    writeFileSync(join(target, "SKILL.md"), "previous");
    // A read-only skills folder blocks both staging and the swap.
    const root = resolve(target, "..");
    chmodSync(root, 0o500);
    try {
      expect(install().state).toBe("failed");
    } finally {
      chmodSync(root, 0o700);
    }
    expect(readFileSync(join(target, "SKILL.md"), "utf8")).toBe("previous");
    expect(leftovers(target)).toEqual([]);
  });
});
