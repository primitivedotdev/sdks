import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetHintLatchForTest,
  applyProxyAutoDetect,
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

describe("applyProxyAutoDetect", () => {
  beforeEach(() => {
    _resetHintLatchForTest();
  });

  it("leaves NODE_USE_ENV_PROXY untouched when no proxy env is set", () => {
    const env: NodeJS.ProcessEnv = {};
    const stderr = makeStderr();

    const result = applyProxyAutoDetect({ env, stderr });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no_proxy_env");
    expect(env.NODE_USE_ENV_PROXY).toBeUndefined();
    expect(stderr.writes).toEqual([]);
  });

  it("sets NODE_USE_ENV_PROXY=1 and writes a hint when HTTP_PROXY is set", () => {
    const env: NodeJS.ProcessEnv = { HTTP_PROXY: "http://corp-proxy:8080" };
    const stderr = makeStderr();

    const result = applyProxyAutoDetect({ env, stderr });

    expect(result.applied).toBe(true);
    expect(result.reason).toBe("applied");
    expect(result.detectedVars).toEqual(["HTTP_PROXY"]);
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
    expect(stderr.writes).toHaveLength(1);
    expect(stderr.writes[0]).toContain("HTTP_PROXY");
    expect(stderr.writes[0]).toContain("NODE_USE_ENV_PROXY=1");
  });

  it("also picks up HTTPS_PROXY and lowercase variants", () => {
    for (const name of ["HTTPS_PROXY", "http_proxy", "https_proxy"] as const) {
      _resetHintLatchForTest();
      const env: NodeJS.ProcessEnv = { [name]: "http://corp-proxy:8080" };
      const stderr = makeStderr();

      const result = applyProxyAutoDetect({ env, stderr });

      expect(result.applied).toBe(true);
      expect(env.NODE_USE_ENV_PROXY).toBe("1");
      expect(stderr.writes[0]).toContain(name);
    }
  });

  it("respects an explicit NODE_USE_ENV_PROXY=0 and does not override it", () => {
    // User opted out for this invocation. Auto-detection must not
    // silently undo that choice.
    const env: NodeJS.ProcessEnv = {
      HTTP_PROXY: "http://corp-proxy:8080",
      NODE_USE_ENV_PROXY: "0",
    };
    const stderr = makeStderr();

    const result = applyProxyAutoDetect({ env, stderr });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("node_use_env_proxy_already_set");
    expect(env.NODE_USE_ENV_PROXY).toBe("0");
    expect(stderr.writes).toEqual([]);
  });

  it("respects an explicit NODE_USE_ENV_PROXY=1 and does not duplicate the hint", () => {
    // User has already opted in manually. We should not print the
    // automatic-detection hint because nothing changed.
    const env: NodeJS.ProcessEnv = {
      HTTPS_PROXY: "http://corp-proxy:8080",
      NODE_USE_ENV_PROXY: "1",
    };
    const stderr = makeStderr();

    const result = applyProxyAutoDetect({ env, stderr });

    expect(result.applied).toBe(false);
    expect(result.reason).toBe("node_use_env_proxy_already_set");
    expect(env.NODE_USE_ENV_PROXY).toBe("1");
    expect(stderr.writes).toEqual([]);
  });

  it("prints the hint only once per process even on repeat calls", () => {
    const env: NodeJS.ProcessEnv = { HTTP_PROXY: "http://corp-proxy:8080" };
    const stderr = makeStderr();

    applyProxyAutoDetect({ env, stderr });
    // Second invocation: still detects, still has NODE_USE_ENV_PROXY=1
    // from the first call, so it follows the "already set" path and
    // writes nothing. This case validates the already-set guard, not
    // the hint latch itself. See the next test for the latch.
    applyProxyAutoDetect({ env, stderr });

    expect(stderr.writes).toHaveLength(1);
  });

  it("hint latch suppresses the second print when each call receives a fresh env", () => {
    // The previous test exercises the already-set guard because both
    // calls share an env object the first call mutated. The hint
    // latch is only exercised when both calls reach the "apply" path,
    // meaning each call sees a fresh env with the proxy var set and
    // NODE_USE_ENV_PROXY absent. This case validates that.
    const stderr = makeStderr();

    const env1: NodeJS.ProcessEnv = { HTTP_PROXY: "http://corp-proxy:8080" };
    const r1 = applyProxyAutoDetect({ env: env1, stderr });

    const env2: NodeJS.ProcessEnv = { HTTP_PROXY: "http://corp-proxy:8080" };
    const r2 = applyProxyAutoDetect({ env: env2, stderr });

    // Both invocations apply: each mutates its own env's NODE_USE_ENV_PROXY.
    expect(r1.applied).toBe(true);
    expect(env1.NODE_USE_ENV_PROXY).toBe("1");
    expect(r2.applied).toBe(true);
    expect(env2.NODE_USE_ENV_PROXY).toBe("1");

    // ...but the latch suppresses the second hint write.
    expect(stderr.writes).toHaveLength(1);
  });
});
