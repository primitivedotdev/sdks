import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMMANDS } from "../../src/oclif/index.js";
import { completionFunctionPath } from "../../src/oclif/shell-completion-script.js";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const chunks: string[] = [];
  // oclif's `this.log` routes through `ux.stdout`, which is `console.log`.
  // The autocomplete cache builder writes its progress spinner to stderr
  // (`console.error`), which we deliberately leave alone.
  const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
    chunks.push(args.map((arg) => String(arg)).join(" "));
  });
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return chunks.join("\n");
}

describe("completionFunctionPath", () => {
  it("points at the generated bash function file", () => {
    expect(completionFunctionPath("/cache", "primitive", "bash")).toBe(
      path.join(
        "/cache",
        "autocomplete",
        "functions",
        "bash",
        "primitive.bash",
      ),
    );
  });

  it("points at the generated zsh function file", () => {
    expect(completionFunctionPath("/cache", "primitive", "zsh")).toBe(
      path.join("/cache", "autocomplete", "functions", "zsh", "_primitive"),
    );
  });
});

describe("completion command", () => {
  const isTTY = process.stdout.isTTY;
  let originalCacheHome: string | undefined;

  beforeEach(() => {
    // Isolate the autocomplete cache writes to a throwaway dir.
    originalCacheHome = process.env.XDG_CACHE_HOME;
    process.env.XDG_CACHE_HOME = mkdtempSync(
      path.join(tmpdir(), "primitive-completion-"),
    );
  });

  afterEach(() => {
    if (originalCacheHome === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalCacheHome;
    }
    // Restore whatever the real tty state was after we force it below.
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: isTTY,
    });
  });

  type RunnableCommand = {
    run(argv: string[], config: Config): Promise<unknown>;
  };

  async function runCompletion(shell: string): Promise<string> {
    const config = await Config.load(pkgRoot);
    const command = COMMANDS.completion as unknown as RunnableCommand;
    return captureStdout(async () => {
      await command.run([shell], config);
    });
  }

  it("emits a sourceable bash function when stdout is not a TTY", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    });

    const out = await runCompletion("bash");

    // The real completion function, safe to drop into bash_completion.d.
    expect(out).toContain("_primitive_autocomplete()");
    expect(out).toContain("complete -F _primitive_autocomplete primitive");
    // NOT the human-readable instructions that previously got sourced as
    // shell commands and produced `bash: Setup: command not found`.
    expect(out).not.toContain("Setup Instructions");
    expect(out).not.toContain("Run this command in your terminal window");
  });

  it("emits a sourceable zsh function when stdout is not a TTY", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    });

    const out = await runCompletion("zsh");

    expect(out).toContain("#compdef primitive");
    expect(out).not.toContain("Setup Instructions");
  });

  it("prints setup instructions for bash in an interactive terminal", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: true,
    });

    const out = await runCompletion("bash");

    expect(out).toContain("Setup Instructions");
  });

  it("emits the fish completion script directly", async () => {
    Object.defineProperty(process.stdout, "isTTY", {
      configurable: true,
      value: false,
    });

    const out = await runCompletion("fish");

    expect(out).toContain("complete -c primitive");
    expect(out).not.toContain("Setup Instructions");
  });
});
