import { type ChildProcess, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { otherBoardFlag } from "../../src/oclif/commands/board.js";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const vbBin = path.join(
  path.dirname(
    createRequire(import.meta.url).resolve("@vercel/board/package.json"),
  ),
  "dist",
  "cli.mjs",
);

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("no port")),
      );
    });
  });

// Waits until vb serve answers at `url` and has saved its token, which it
// writes to `tokenFile` after it starts listening.
async function waitForBoard(
  url: string,
  tokenFile: string,
  serve: ChildProcess,
): Promise<string> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serve.exitCode !== null)
      throw new Error(`vb serve exited with ${serve.exitCode}`);
    try {
      if ((await fetch(url)).ok)
        return (
          JSON.parse(readFileSync(tokenFile, "utf8")) as { token: string }
        ).token;
    } catch {
      // Not listening, or no token yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`vb serve did not answer at ${url}`);
}

type Run = { code: number; stdout: string; stderr: string };

describe("primitive board against vb serve", () => {
  const dirs: string[] = [];
  const tmp = (prefix: string) => {
    const dir = mkdtempSync(path.join(tmpdir(), prefix));
    dirs.push(dir);
    return dir;
  };
  const savedEnv = { ...process.env };
  let serve: ChildProcess;
  let boardUrl: string;
  let config: Config;

  // Runs `primitive board <argv>` in this process, as the real CLI does.
  async function primitiveBoard(argv: string[]): Promise<Run> {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const out = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stdout.push(String(chunk));
        return true;
      });
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
      });
    const log = vi.spyOn(console, "log").mockImplementation((...args) => {
      stdout.push(`${args.join(" ")}\n`);
    });
    process.exitCode = undefined;
    try {
      await config.runCommand("board", argv);
    } finally {
      out.mockRestore();
      err.mockRestore();
      log.mockRestore();
    }
    const code = Number(process.exitCode ?? 0);
    process.exitCode = undefined;
    return { code, stdout: stdout.join(""), stderr: stderr.join("") };
  }

  beforeAll(async () => {
    const port = await freePort();
    const serveConfig = tmp("vb-serve-config-");
    serve = spawn(
      process.execPath,
      [
        vbBin,
        "serve",
        "--port",
        String(port),
        "--dir",
        tmp("vb-serve-log-"),
        "--no-inspect",
        "--no-open",
      ],
      {
        env: { ...savedEnv, XDG_CONFIG_HOME: serveConfig },
        stdio: "ignore",
      },
    );
    boardUrl = `http://127.0.0.1:${port}/api/board`;
    // The token vb serve signed for its user. It stands in for the Primitive
    // login: the CLI must carry it to the board itself.
    const token = await waitForBoard(
      boardUrl,
      path.join(
        serveConfig,
        "board",
        "local",
        `${createHash("sha256").update(boardUrl).digest("hex").slice(0, 32)}.json`,
      ),
      serve,
    );

    for (const name of Object.keys(process.env))
      if (name.startsWith("BOARD_") || name.startsWith("PRIMITIVE_"))
        delete process.env[name];
    // A config home with no vb serve token file, so the only credential the
    // board sees is the Primitive one.
    process.env.XDG_CONFIG_HOME = tmp("primitive-cli-config-");
    process.env.PRIMITIVE_API_KEY = token;
    process.env.PRIMITIVE_API_BASE_URL = `http://127.0.0.1:${port}/api`;
    process.env.PRIMITIVE_SKIP_NEW_VERSION_CHECK = "true";

    config = await Config.load(pkgRoot);
    Object.defineProperty(config, "configDir", {
      value: tmp("primitive-config-dir-"),
    });
  }, 30_000);

  afterAll(() => {
    serve?.kill();
    process.env = savedEnv;
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  it("posts to a channel", async () => {
    const posted = await primitiveBoard([
      "post",
      "dev",
      "ready to promote?",
      "--json",
    ]);
    expect(posted.stderr).toBe("");
    expect(posted.code).toBe(0);
    const { message, outcome } = JSON.parse(posted.stdout) as {
      message: { id: string; text: string };
      outcome: string;
    };
    expect(outcome).toBe("posted");
    expect(message.text).toBe("ready to promote?");
    expect(process.env.BOARD_URL).toBe(boardUrl);

    const read = await primitiveBoard(["read", "dev", "--json"]);
    expect(read.code).toBe(0);
    expect(read.stdout).toContain(message.id);
  });

  it("claims the oldest ready task", async () => {
    const created = await primitiveBoard([
      "tasks",
      "create",
      "work",
      "build the thing",
      "--json",
    ]);
    expect(created.code).toBe(0);
    const { task } = JSON.parse(created.stdout) as { task: { id: string } };

    const claimed = await primitiveBoard([
      "tasks",
      "claim",
      "--ready",
      "work",
      "--as",
      "worker-1",
      "--json",
    ]);
    expect(claimed.stderr).toBe("");
    expect(claimed.code).toBe(0);
    const claim = JSON.parse(claimed.stdout) as {
      task: { id: string; labels: Record<string, string> };
    };
    expect(claim.task.id).toBe(task.id);
    expect(claim.task.labels["board.task"]).toBe("claimed");
  });

  it("refuses to send the Primitive credential to another board", async () => {
    const run = await primitiveBoard([
      "read",
      "dev",
      "--url",
      "https://elsewhere.example/api/board",
    ]);
    expect(run.code).toBe(2);
    expect(run.stderr).toContain("does not take --url");
  });
});

describe("otherBoardFlag", () => {
  it("finds --url and --scope in either form, before --", () => {
    expect(otherBoardFlag(["read", "dev", "--url=https://x"])).toBe("--url");
    expect(otherBoardFlag(["read", "--scope", "team"])).toBe("--scope");
    expect(otherBoardFlag(["tasks", "run", "1", "--", "x", "--url"])).toBe(
      undefined,
    );
    expect(otherBoardFlag(["post", "dev", "hi", "--json"])).toBe(undefined);
  });
});
