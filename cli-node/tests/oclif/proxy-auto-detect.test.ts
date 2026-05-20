import type { spawnSync } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetHintLatchForTest,
  restartWithProxyEnvIfNeeded,
} from "../../src/oclif/proxy-auto-detect.js";

// Captures stderr writes so we can assert on the hint without
// touching the real process stderr stream.
function makeStderr(): {
  writes: string[];
  write: (chunk: string) => boolean;
} {
  const writes: string[] = [];
  return {
    writes,
    write: (chunk: string) => {
      writes.push(chunk);
      return true;
    },
  };
}

describe("restartWithProxyEnvIfNeeded", () => {
  beforeEach(() => {
    _resetHintLatchForTest();
  });

  it("does nothing when no proxy env is set", () => {
    const spawn = vi.fn() as unknown as typeof spawnSync;
    const exit = vi.fn() as unknown as typeof process.exit;
    const stderr = makeStderr();

    const result = restartWithProxyEnvIfNeeded({
      argv: ["/usr/bin/node", "/app/bin/run.js", "whoami"],
      env: {},
      exit,
      spawn,
      stderr,
    });

    expect(result).toEqual({
      applied: false,
      detectedVars: [],
      reason: "no_proxy_env",
    });
    expect(spawn).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(stderr.writes).toEqual([]);
  });

  it("re-runs the CLI with NODE_USE_ENV_PROXY=1 at Node startup", () => {
    const env: NodeJS.ProcessEnv = {
      HTTPS_PROXY: "http://corp-proxy:8080",
      PRIMITIVE_API_KEY: "prim_test",
    };
    const stderr = makeStderr();
    const exitCalls: Array<string | number | null | undefined> = [];
    const exit = ((code?: string | number | null | undefined) => {
      exitCalls.push(code);
      throw new Error("process exit");
    }) as typeof process.exit;
    const spawn = vi.fn(() => ({
      output: [],
      pid: 123,
      signal: null,
      status: 7,
      stderr: null,
      stdout: null,
    })) as unknown as typeof spawnSync;

    expect(() =>
      restartWithProxyEnvIfNeeded({
        argv: ["/usr/bin/node", "/app/bin/run.js", "whoami", "--json"],
        env,
        execArgv: ["--enable-source-maps"],
        execPath: "/usr/local/bin/node",
        exit,
        spawn,
        stderr,
      }),
    ).toThrow("process exit");

    expect(spawn).toHaveBeenCalledWith(
      "/usr/local/bin/node",
      ["--enable-source-maps", "/app/bin/run.js", "whoami", "--json"],
      {
        env: {
          ...env,
          NODE_USE_ENV_PROXY: "1",
        },
        stdio: "inherit",
      },
    );
    expect(exitCalls).toEqual([7]);
    expect(stderr.writes).toHaveLength(1);
    expect(stderr.writes[0]).toContain("HTTPS_PROXY");
    expect(stderr.writes[0]).toContain("restarting with NODE_USE_ENV_PROXY=1");
  });

  it("detects uppercase and lowercase proxy env vars", () => {
    for (const name of [
      "HTTP_PROXY",
      "HTTPS_PROXY",
      "http_proxy",
      "https_proxy",
    ] as const) {
      _resetHintLatchForTest();
      const stderr = makeStderr();
      const exit = (() => {
        throw new Error("process exit");
      }) as typeof process.exit;
      const spawn = vi.fn(() => ({
        output: [],
        pid: 123,
        signal: null,
        status: 0,
        stderr: null,
        stdout: null,
      })) as unknown as typeof spawnSync;

      expect(() =>
        restartWithProxyEnvIfNeeded({
          argv: ["/usr/bin/node", "/app/bin/run.js", "whoami"],
          env: { [name]: "http://corp-proxy:8080" },
          exit,
          spawn,
          stderr,
        }),
      ).toThrow("process exit");

      expect(spawn).toHaveBeenCalledTimes(1);
      expect(stderr.writes[0]).toContain(name);
    }
  });

  it("respects explicit NODE_USE_ENV_PROXY values", () => {
    const spawn = vi.fn() as unknown as typeof spawnSync;
    const exit = vi.fn() as unknown as typeof process.exit;
    const stderr = makeStderr();

    const result = restartWithProxyEnvIfNeeded({
      argv: ["/usr/bin/node", "/app/bin/run.js", "whoami"],
      env: {
        HTTP_PROXY: "http://corp-proxy:8080",
        NODE_USE_ENV_PROXY: "0",
      },
      exit,
      spawn,
      stderr,
    });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("node_use_env_proxy_already_set");
    expect(spawn).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(stderr.writes).toEqual([]);
  });
});
