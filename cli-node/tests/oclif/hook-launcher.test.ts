import { spawn, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  hookLauncherScript,
  hookLauncherWarningPath,
  MIN_NODE_MAJOR,
  NO_CLI_WARNING,
  NO_NODE_WARNING,
  writeHookLauncher,
} from "../../src/oclif/hook-launcher.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

const posix = process.platform !== "win32";
const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";

/**
 * A PATH holding only the utilities the launcher uses, so no Node installed
 * on the test machine is found by accident.
 */
function toolsDir(root: string): string {
  const tools = join(root, "tools");
  mkdirSync(tools);
  for (const tool of ["mkdir", "rm", "tail", "sh"]) {
    const found = spawnSync("sh", ["-c", `command -v ${tool}`], {
      encoding: "utf8",
    }).stdout.trim();
    symlinkSync(found, join(tools, tool));
  }
  return tools;
}

function setup() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "hook-launcher-")));
  directories.push(root);
  const tools = toolsDir(root);
  const configDir = join(root, "config");
  const home = join(root, "home");
  mkdirSync(home);
  // A CLI install whose hook scripts print what they were run with.
  const bin = join(root, "pkg", "bin");
  mkdirSync(bin, { recursive: true });
  for (const name of ["run.js", "claude-wake.mjs", "claude-pending-mail.mjs"])
    writeFileSync(
      join(bin, name),
      `process.stdout.write(JSON.stringify({ script: ${JSON.stringify(name)}, argv: process.argv.slice(2), dir: import.meta.dirname }));\n`,
      // npm marks package bins executable.
      { mode: 0o755 },
    );
  writeFileSync(
    join(root, "pkg", "package.json"),
    '{"name":"primitive","version":"1.48.0","type":"module"}',
  );
  return { root, configDir, home, bin, tools };
}

/** A fake Node that reports itself, then runs the real one. */
function fakeNode(path: string, label: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(
    path,
    `#!/bin/sh\nprintf '%s ' ${label}\nexec '${process.execPath}' "$@"\n`,
  );
  chmodSync(path, 0o755);
}

function install(configDir: string, node: string): string {
  const launcher = join(configDir, "bin", "primitive-node");
  writeHookLauncher(
    launcher,
    hookLauncherScript({
      node,
      version: "1.48.0",
      configDir,
      commonLocations: false,
    }),
  );
  return launcher;
}

function run(
  launcher: string,
  args: string[],
  env: Record<string, string>,
): { status: number | null; stdout: string } {
  const result = spawnSync(launcher, args, {
    encoding: "utf8",
    env,
    input: "{}",
  });
  return { status: result.status, stdout: result.stdout };
}

describe.runIf(posix)("hook launcher", () => {
  it("runs the pinned Node while it exists", () => {
    const { root, configDir, home, bin, tools } = setup();
    const pinned = join(
      root,
      "nvm",
      "versions",
      "node",
      "v24.0.0",
      "bin",
      "node",
    );
    fakeNode(pinned, "pinned");
    const launcher = install(configDir, pinned);
    const result = run(
      launcher,
      [join(bin, "claude-wake.mjs"), join(bin, "run.js"), "x"],
      { PATH: tools, HOME: home },
    );
    expect(result.status).toBe(0);
    expect(result.stdout.startsWith("pinned ")).toBe(true);
    expect(JSON.parse(result.stdout.slice("pinned ".length))).toMatchObject({
      script: "claude-wake.mjs",
      argv: [join(bin, "run.js"), "x"],
    });
  });

  it("falls back to the Node on PATH when the pinned one is removed", () => {
    const { root, configDir, home, bin, tools } = setup();
    const pinned = join(
      root,
      "nvm",
      "versions",
      "node",
      "v24.0.0",
      "bin",
      "node",
    );
    const onPath = join(root, "path-bin", "node");
    fakeNode(onPath, "path");
    const launcher = install(configDir, pinned);
    const result = run(launcher, [join(bin, "claude-wake.mjs"), "x"], {
      PATH: `${join(root, "path-bin")}:${tools}`,
      HOME: home,
    });
    expect(result.status).toBe(0);
    expect(result.stdout.startsWith("path ")).toBe(true);
    expect(existsSync(hookLauncherWarningPath(configDir))).toBe(false);
  });

  it("falls back to another installed version beside the removed one", () => {
    const { root, configDir, home, bin, tools } = setup();
    const versions = join(root, "nvm", "versions", "node");
    fakeNode(join(versions, "v22.1.0", "bin", "node"), "sibling");
    const launcher = install(
      configDir,
      join(versions, "v24.0.0", "bin", "node"),
    );
    const result = run(launcher, [join(bin, "claude-wake.mjs")], {
      PATH: tools,
      HOME: home,
    });
    expect(result.stdout.startsWith("sibling ")).toBe(true);
  });

  it("shows the warning once even when a session's hooks run at the same time", async () => {
    const { root, configDir, home, bin, tools } = setup();
    const launcher = install(configDir, join(root, "gone", "bin", "node"));
    const outputs = await Promise.all(
      Array.from(
        { length: 8 },
        () =>
          new Promise<string>((done) => {
            const child = spawn(
              launcher,
              [
                join(bin, "claude-pending-mail.mjs"),
                join(bin, "run.js"),
                configDir,
                "profile",
                "a@example.test",
                sessionA,
                "primitive-pending-mail-v1",
              ],
              { env: { PATH: tools, HOME: home } },
            );
            let stdout = "";
            child.stdout.on("data", (chunk) => {
              stdout += String(chunk);
            });
            child.on("close", () => done(stdout));
          }),
      ),
    );
    expect(outputs.filter(Boolean)).toHaveLength(1);
  });

  it("skips a Node on PATH too old to run the CLI", () => {
    const { root, configDir, home, bin, tools } = setup();
    const versions = join(root, "nvm", "versions", "node");
    fakeNode(join(versions, "v22.1.0", "bin", "node"), "sibling");
    // Answers the version check as an unsupported Node would.
    const old = join(root, "old-bin", "node");
    mkdirSync(join(root, "old-bin"));
    writeFileSync(
      old,
      `#!/bin/sh\n[ "$1" = -e ] && exit 1\nprintf 'old '\nexec '${process.execPath}' "$@"\n`,
    );
    chmodSync(old, 0o755);
    const launcher = install(
      configDir,
      join(versions, "v24.0.0", "bin", "node"),
    );
    const result = run(launcher, [join(bin, "claude-wake.mjs")], {
      PATH: `${join(root, "old-bin")}:${tools}`,
      HOME: home,
    });
    expect(result.stdout.startsWith("sibling ")).toBe(true);
  });

  it("matches the Node version the CLI package requires", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "..", "..", "package.json"),
        "utf8",
      ),
    ) as { engines: { node: string } };
    expect(manifest.engines.node).toBe(`>=${MIN_NODE_MAJOR}`);
  });

  it("writes a warning when no Node is found and shows it once to the PostToolUse hook", () => {
    const { root, configDir, home, bin, tools } = setup();
    const launcher = install(configDir, join(root, "gone", "bin", "node"));
    const env = { PATH: tools, HOME: home };
    // A Stop hook exits 0 so Claude Code is never blocked.
    const stop = run(launcher, [join(bin, "claude-wake.mjs")], env);
    expect(stop).toEqual({ status: 0, stdout: "" });
    expect(readFileSync(hookLauncherWarningPath(configDir), "utf8")).toBe(
      `${NO_NODE_WARNING}\n`,
    );
    // The PostToolUse hook's sixth argument is its session.
    const pendingArgs = (session: string) => [
      join(bin, "claude-pending-mail.mjs"),
      join(bin, "run.js"),
      configDir,
      "profile",
      "a@example.test",
      session,
      "primitive-pending-mail-v1",
    ];
    const notice = {
      hookSpecificOutput: {
        hookEventName: "PostToolUse",
        additionalContext: NO_NODE_WARNING,
      },
    };
    const pending = run(launcher, pendingArgs(sessionA), env);
    expect(pending.status).toBe(0);
    expect(JSON.parse(pending.stdout)).toEqual(notice);
    expect(run(launcher, pendingArgs(sessionA), env)).toEqual({
      status: 0,
      stdout: "",
    });
    // Another session using the same launcher still sees it once.
    expect(
      JSON.parse(run(launcher, pendingArgs(sessionB), env).stdout),
    ).toEqual(notice);
    expect(run(launcher, pendingArgs(sessionB), env).stdout).toBe("");

    // Once Node is back, the next hook run clears the warning.
    fakeNode(join(root, "gone", "bin", "node"), "back");
    const back = run(launcher, [join(bin, "claude-wake.mjs")], env);
    expect(back.stdout.startsWith("back ")).toBe(true);
    expect(existsSync(hookLauncherWarningPath(configDir))).toBe(false);
  });

  it("runs the hook scripts from the primitive on PATH when the npx cache is gone", () => {
    const { root, configDir, home, bin, tools } = setup();
    const pathBin = join(root, "global-bin");
    mkdirSync(pathBin);
    symlinkSync(join(bin, "run.js"), join(pathBin, "primitive"));
    const gone = join(root, "_npx", "abc", "node_modules", "primitive", "bin");
    const launcher = install(configDir, process.execPath);
    const result = run(
      launcher,
      [
        join(gone, "claude-pending-mail.mjs"),
        join(gone, "run.js"),
        configDir,
        "profile",
      ],
      { PATH: `${pathBin}:${tools}`, HOME: home },
    );
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      script: "claude-pending-mail.mjs",
      argv: [join(bin, "run.js"), configDir, "profile"],
      dir: bin,
    });
  });

  it("finds another copy when only the hook's run.js is gone", () => {
    const { root, configDir, home, bin, tools } = setup();
    const pathBin = join(root, "global-bin");
    mkdirSync(pathBin);
    symlinkSync(join(bin, "run.js"), join(pathBin, "primitive"));
    // The hook script survives in a directory without run.js.
    const partial = join(root, "partial", "bin");
    mkdirSync(partial, { recursive: true });
    writeFileSync(join(partial, "claude-wake.mjs"), "process.exit(9);\n");
    const launcher = install(configDir, process.execPath);
    const result = run(
      launcher,
      [join(partial, "claude-wake.mjs"), join(partial, "run.js"), configDir],
      { PATH: `${pathBin}:${tools}`, HOME: home },
    );
    expect(JSON.parse(result.stdout)).toEqual({
      script: "claude-wake.mjs",
      argv: [join(bin, "run.js"), configDir],
      dir: bin,
    });
  });

  it("replaces the CLI entry of a machine-wide session hook the same way", () => {
    const { root, configDir, home, bin, tools } = setup();
    const pathBin = join(root, "global-bin");
    mkdirSync(pathBin);
    symlinkSync(join(bin, "run.js"), join(pathBin, "primitive"));
    const launcher = install(configDir, process.execPath);
    const result = run(
      launcher,
      [
        join(root, "_npx", "gone", "bin", "run.js"),
        "agent",
        "session-register",
      ],
      { PATH: `${pathBin}:${tools}`, HOME: home },
    );
    expect(JSON.parse(result.stdout)).toEqual({
      script: "run.js",
      argv: ["agent", "session-register"],
      dir: bin,
    });
  });

  it("fetches the pinned version with npx when no copy is installed", () => {
    const { root, configDir, home, bin, tools } = setup();
    // An npx that reports the package bin it would put on PATH.
    const nodeDir = join(root, "node-bin");
    mkdirSync(nodeDir);
    symlinkSync(process.execPath, join(nodeDir, "node"));
    const exec = join(root, "npx-exec");
    mkdirSync(exec);
    symlinkSync(join(bin, "run.js"), join(exec, "primitive"));
    writeFileSync(
      join(nodeDir, "npx"),
      `#!/bin/sh\necho "$@" > '${join(root, "npx-args")}'\nPATH='${exec}':$PATH sh -c "$5"\n`,
    );
    chmodSync(join(nodeDir, "npx"), 0o755);
    const launcher = install(configDir, join(nodeDir, "node"));
    const gone = join(root, "_npx", "gone", "bin");
    const result = run(
      launcher,
      [join(gone, "claude-wake.mjs"), join(gone, "run.js")],
      { PATH: tools, HOME: home },
    );
    expect(readFileSync(join(root, "npx-args"), "utf8").trim()).toBe(
      "-y -p primitive@1.48.0 -c command -v primitive",
    );
    expect(JSON.parse(result.stdout)).toMatchObject({
      script: "claude-wake.mjs",
      argv: [join(bin, "run.js")],
    });
  });

  it("warns instead of failing when no copy of the CLI can be found", () => {
    const { root, configDir, home, tools } = setup();
    // A Node with no npx beside it, so nothing is fetched.
    const nodeDir = join(root, "node-bin");
    mkdirSync(nodeDir);
    symlinkSync(process.execPath, join(nodeDir, "node"));
    const launcher = install(configDir, join(nodeDir, "node"));
    const gone = join(root, "_npx", "gone", "bin");
    const env = { PATH: tools, HOME: home };
    expect(
      run(launcher, [join(gone, "claude-wake.mjs"), join(gone, "run.js")], env),
    ).toEqual({ status: 0, stdout: "" });
    expect(readFileSync(hookLauncherWarningPath(configDir), "utf8")).toBe(
      `${NO_CLI_WARNING}\n`,
    );
  });

  it("rewrites the launcher only when its content changes", () => {
    const { configDir } = setup();
    const path = join(configDir, "bin", "primitive-node");
    const content = hookLauncherScript({
      node: "/a/node",
      version: "1.0.0",
      configDir,
    });
    expect(writeHookLauncher(path, content)).toBe(true);
    expect(writeHookLauncher(path, content)).toBe(false);
    expect(content).toContain("pinned_node='/a/node'");
    expect(content).toContain("/opt/homebrew/bin/node");
  });
});
