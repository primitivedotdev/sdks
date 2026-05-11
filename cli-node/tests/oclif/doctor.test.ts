import { describe, expect, it } from "vitest";
import {
  checkApiKey,
  checkNode,
  checkProxy,
  renderRow,
} from "../../src/oclif/commands/doctor.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("doctor command registration", () => {
  it("registers in the COMMANDS map", () => {
    expect(COMMANDS.doctor).toBeDefined();
  });
});

describe("renderRow", () => {
  it("prefixes OK rows with [OK]  and the label", () => {
    expect(
      renderRow({
        label: "Node version",
        outcome: { status: "ok", message: "v22.10.2" },
      }),
    ).toBe("[OK]   Node version: v22.10.2");
  });

  it("prefixes WARN rows with [WARN]", () => {
    expect(
      renderRow({
        label: "Proxy env",
        outcome: { status: "warn", message: "HTTPS_PROXY set" },
      }),
    ).toBe("[WARN] Proxy env: HTTPS_PROXY set");
  });

  it("prefixes FAIL rows with [FAIL]", () => {
    expect(
      renderRow({
        label: "API key",
        outcome: { status: "fail", message: "missing" },
      }),
    ).toBe("[FAIL] API key: missing");
  });
});

describe("checkNode", () => {
  it("returns ok for a current Node version", () => {
    // The test process must satisfy the same min as production (Node
    // 22+); CI runs on 22 and 24 per .github/workflows/sdk-checks.yml,
    // so this is always green there.
    const outcome = checkNode();
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toMatch(/^v\d+/);
  });
});

describe("checkProxy", () => {
  const PROXY_VARS = [
    "NODE_USE_ENV_PROXY",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
  ] as const;

  function withProxyEnv<T>(
    overrides: Partial<Record<(typeof PROXY_VARS)[number], string | undefined>>,
    fn: () => T,
  ): T {
    const previous: Record<string, string | undefined> = {};
    for (const key of PROXY_VARS) previous[key] = process.env[key];
    for (const key of PROXY_VARS) delete process.env[key];
    for (const [key, value] of Object.entries(overrides)) {
      if (value !== undefined) process.env[key] = value;
    }
    try {
      return fn();
    } finally {
      for (const key of PROXY_VARS) {
        const prior = previous[key];
        if (prior === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = prior;
        }
      }
    }
  }

  it("returns ok with the 'no proxy env' message when nothing is set", () => {
    const outcome = withProxyEnv({}, () => checkProxy());
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toContain("no proxy env vars set");
  });

  it("returns ok when NODE_USE_ENV_PROXY=1 and HTTPS_PROXY are both set together", () => {
    const outcome = withProxyEnv(
      {
        NODE_USE_ENV_PROXY: "1",
        HTTPS_PROXY: "http://corp-proxy:8080",
      },
      () => checkProxy(),
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toContain("NODE_USE_ENV_PROXY=1");
    expect(outcome.message).toContain("HTTPS_PROXY=http://corp-proxy:8080");
  });

  it("warns when HTTPS_PROXY is set but NODE_USE_ENV_PROXY is not", () => {
    // Node 22+ ignores HTTP(S)_PROXY by default. The classic AGX
    // failure mode: agent's container has HTTPS_PROXY exported but
    // fetch ignores it and returns ENETUNREACH.
    const outcome = withProxyEnv(
      { HTTPS_PROXY: "http://corp-proxy:8080" },
      () => checkProxy(),
    );
    expect(outcome.status).toBe("warn");
    if (outcome.status !== "warn") return;
    expect(outcome.message).toContain("HTTPS_PROXY");
    expect(outcome.hint).toMatch(/NODE_USE_ENV_PROXY=1/);
  });
});

describe("checkApiKey", () => {
  it("returns ok when a prim_-prefixed key is provided", () => {
    const outcome = checkApiKey({
      apiKey: "prim_abc123",
      configDir: "/tmp/nonexistent-config",
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toMatch(/prim_/);
  });

  it("warns when a key is provided but does not start with prim_", () => {
    const outcome = checkApiKey({
      apiKey: "sk_live_wrong",
      configDir: "/tmp/nonexistent-config",
    });
    expect(outcome.status).toBe("warn");
    if (outcome.status !== "warn") return;
    expect(outcome.hint).toMatch(/Primitive API key/);
  });

  it("fails when no key is provided and no credentials file exists", () => {
    const outcome = checkApiKey({
      apiKey: undefined,
      configDir: "/tmp/definitely-does-not-exist-2026",
    });
    expect(outcome.status).toBe("fail");
    if (outcome.status !== "fail") return;
    expect(outcome.hint).toMatch(/primitive login/);
    expect(outcome.hint).toMatch(/PRIMITIVE_API_KEY/);
  });
});
