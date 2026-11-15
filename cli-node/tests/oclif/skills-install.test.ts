import { execFileSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const cliRoot = resolve(import.meta.dirname, "../..");
const bundleRoot = mkdtempSync(join(tmpdir(), "skills-install-bundle-"));
execFileSync(
  process.execPath,
  [
    join(cliRoot, "scripts", "bundle-skills.mjs"),
    "--out",
    join(bundleRoot, "dist"),
  ],
  { stdio: "ignore" },
);
afterAll(() => rmSync(bundleRoot, { recursive: true, force: true }));

// The command installs from its own package root; point it at the scratch bundle.
vi.mock("../../src/oclif/connect-skill.js", async () => {
  const actual = await vi.importActual<
    typeof import("../../src/oclif/connect-skill.js")
  >("../../src/oclif/connect-skill.js");
  return {
    ...actual,
    bundledSkillNames: () => actual.bundledSkillNames(bundleRoot),
    readBundledSkill: (_root: string, name: string) =>
      actual.readBundledSkill(bundleRoot, name),
  };
});

import SkillsInstallCommand, {
  installBundledSkills,
} from "../../src/oclif/commands/skills-install.js";
import {
  CONNECT_SKILL_NAME,
  skillTarget,
} from "../../src/oclif/connect-skill.js";

// The unmocked readers, for the tests of the readers themselves.
const { bundledSkillNames, readBundledSkill } = await vi.importActual<
  typeof import("../../src/oclif/connect-skill.js")
>("../../src/oclif/connect-skill.js");

let home: string;
let env: Record<string, string>;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "skills-install-home-"));
  env = {
    CLAUDE_CONFIG_DIR: join(home, "claude"),
    CODEX_HOME: join(home, "codex"),
  };
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(home, { recursive: true, force: true });
  process.exitCode = undefined;
});

const sourceVersion = (name: string) =>
  JSON.parse(
    readFileSync(
      join(cliRoot, "vendor", "skills", `${name}.source.json`),
      "utf8",
    ),
  ).version as string;

describe("bundled skill names", () => {
  it("lists every skill the build bundled, and nothing for a missing bundle", () => {
    expect(bundledSkillNames(bundleRoot)).toEqual([CONNECT_SKILL_NAME]);
    expect(bundledSkillNames(join(home, "nothing"))).toEqual([]);
  });
  it("ignores a manifest without its skill directory and names that are not plain", () => {
    const root = mkdtempSync(join(tmpdir(), "skills-install-names-"));
    try {
      mkdirSync(join(root, "dist", "skills", "Bad Name"), { recursive: true });
      writeFileSync(join(root, "dist", "skills", "Bad Name.json"), "{}");
      writeFileSync(join(root, "dist", "skills", "orphan.json"), "{}");
      expect(bundledSkillNames(root)).toEqual([]);
      expect(() => readBundledSkill(root, "../escape")).toThrow(/skill name/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("installBundledSkills", () => {
  const install = (name?: string) =>
    installBundledSkills({
      packageRoot: bundleRoot,
      name,
      runtime: "claude",
      env,
    });

  it("installs every bundled skill, then leaves the same version unchanged", () => {
    const target = skillTarget({
      name: CONNECT_SKILL_NAME,
      runtime: "claude",
      env,
    });
    expect(install()).toEqual([
      {
        name: CONNECT_SKILL_NAME,
        state: "installed",
        runtime: "claude",
        path: target,
        version: sourceVersion(CONNECT_SKILL_NAME),
      },
    ]);
    expect(existsSync(join(target, "SKILL.md"))).toBe(true);
    const before = lstatSync(join(target, "SKILL.md")).mtimeMs;
    expect(install()?.[0]).toMatchObject({ state: "unchanged" });
    expect(lstatSync(join(target, "SKILL.md")).mtimeMs).toBe(before);
  });

  it("replaces a symlinked copy with a real directory and leaves the link target alone", () => {
    const shared = join(home, "shared-skill");
    mkdirSync(shared);
    writeFileSync(join(shared, "SKILL.md"), "someone else's copy");
    const target = skillTarget({
      name: CONNECT_SKILL_NAME,
      runtime: "claude",
      env,
    });
    mkdirSync(resolve(target, ".."), { recursive: true });
    symlinkSync(shared, target);
    expect(install(CONNECT_SKILL_NAME)?.[0]).toMatchObject({
      state: "updated",
      replacedLink: true,
    });
    expect(lstatSync(target).isSymbolicLink()).toBe(false);
    expect(readFileSync(join(shared, "SKILL.md"), "utf8")).toBe(
      "someone else's copy",
    );
  });

  it("installs into the project folder for each runtime", () => {
    const cwd = join(home, "project");
    mkdirSync(cwd);
    const result = installBundledSkills({
      packageRoot: bundleRoot,
      runtime: "codex",
      project: true,
      cwd,
      env,
    });
    expect(result?.[0]?.path).toBe(
      join(cwd, ".agents", "skills", CONNECT_SKILL_NAME),
    );
  });

  it("returns null for a skill that is not bundled", () => {
    expect(install("not-bundled")).toBeNull();
  });
});

describe("primitive skills install", () => {
  function captureLog() {
    const lines: string[] = [];
    vi.spyOn(SkillsInstallCommand.prototype, "log").mockImplementation(
      (line) => {
        lines.push(String(line));
      },
    );
    return lines;
  }

  it("reports each skill's path and version as JSON", async () => {
    vi.stubEnv("CLAUDE_CONFIG_DIR", env.CLAUDE_CONFIG_DIR);
    const lines = captureLog();
    await SkillsInstallCommand.run(["--runtime", "claude", "--json"], {
      root: cliRoot,
    });
    expect(process.exitCode).toBeUndefined();
    expect(JSON.parse(lines.join("\n"))).toEqual({
      skills: [
        {
          name: CONNECT_SKILL_NAME,
          state: "installed",
          runtime: "claude",
          path: join(env.CLAUDE_CONFIG_DIR, "skills", CONNECT_SKILL_NAME),
          version: sourceVersion(CONNECT_SKILL_NAME),
        },
      ],
    });
  });

  it("prints one line per skill in text mode", async () => {
    vi.stubEnv("CODEX_HOME", env.CODEX_HOME);
    const lines = captureLog();
    await SkillsInstallCommand.run([CONNECT_SKILL_NAME, "--runtime", "codex"], {
      root: cliRoot,
    });
    expect(lines).toEqual([
      `${CONNECT_SKILL_NAME} ${sourceVersion(CONNECT_SKILL_NAME)}: installed at ${join(env.CODEX_HOME, "skills", CONNECT_SKILL_NAME)}`,
    ]);
  });

  it("refuses a name that is not bundled as a usage error", async () => {
    await expect(
      SkillsInstallCommand.run(["not-bundled", "--runtime", "claude"], {
        root: cliRoot,
      }),
    ).rejects.toMatchObject({
      message: expect.stringContaining(
        `not-bundled is not bundled with this CLI. Bundled skills: ${CONNECT_SKILL_NAME}.`,
      ),
      oclif: { exit: 2 },
    });
  });

  it("requires a runtime", async () => {
    await expect(
      SkillsInstallCommand.run([], { root: cliRoot }),
    ).rejects.toMatchObject({ oclif: { exit: 2 } });
  });
});
