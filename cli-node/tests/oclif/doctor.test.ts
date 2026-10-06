import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import DoctorCommand, {
  checkApiKey,
  checkNode,
  checkProxy,
  renderRow,
} from "../../src/oclif/commands/doctor.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

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
    expect(outcome.message).toContain("NODE_USE_ENV_PROXY=set");
    expect(outcome.message).toContain("HTTPS_PROXY=set");
  });

  it("never reports proxy credentials, hosts, queries, or bypass lists", () => {
    const proxy = new URL("http://proxy.example.test");
    proxy.username = ["private", "user"].join("-");
    proxy.password = ["private", "password"].join("-");
    proxy.search = "token=private-query";
    const outcome = withProxyEnv(
      {
        HTTPS_PROXY: proxy.href,
        NO_PROXY: "private-bypass.example",
        NODE_USE_ENV_PROXY: "1",
      },
      () => checkProxy(),
    );
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toContain("HTTPS_PROXY=set");
    for (const value of [
      proxy.hostname,
      proxy.username,
      proxy.password,
      "private-query",
      "private-bypass",
    ])
      expect(JSON.stringify(outcome)).not.toContain(value);
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

  it("warns when only HTTP_PROXY is set and names HTTP_PROXY in the message", () => {
    // Sibling case to the HTTPS_PROXY warn. The diagnostic must name
    // the var the shell actually has; a hardcoded "HTTPS_PROXY set"
    // string contradicts the user's environment and was the exact
    // bug Greptile flagged on the doctor command.
    const outcome = withProxyEnv({ HTTP_PROXY: "http://corp-proxy:8080" }, () =>
      checkProxy(),
    );
    expect(outcome.status).toBe("warn");
    if (outcome.status !== "warn") return;
    expect(outcome.message).toContain("HTTP_PROXY");
    expect(outcome.message).not.toMatch(/HTTPS_PROXY set/);
    expect(outcome.hint).toMatch(/NODE_USE_ENV_PROXY=1/);
  });

  it("names both HTTPS_PROXY and HTTP_PROXY when both are set", () => {
    const outcome = withProxyEnv(
      {
        HTTPS_PROXY: "http://corp-proxy:8443",
        HTTP_PROXY: "http://corp-proxy:8080",
      },
      () => checkProxy(),
    );
    expect(outcome.status).toBe("warn");
    if (outcome.status !== "warn") return;
    expect(outcome.message).toMatch(/HTTPS_PROXY \/ HTTP_PROXY set/);
  });
});

describe("checkApiKey", () => {
  it("returns ok when a prim_-prefixed key is provided", () => {
    const outcome = checkApiKey({
      apiKey: "prim_abc123",
      configDir: "/tmp/nonexistent-config",
      env: {},
    });
    expect(outcome.status).toBe("ok");
    expect(outcome.message).toMatch(/prim_/);
  });

  it("warns when a key is provided but does not start with prim_", () => {
    const outcome = checkApiKey({
      apiKey: "sk_live_wrong",
      configDir: "/tmp/nonexistent-config",
      env: {},
    });
    expect(outcome.status).toBe("warn");
    if (outcome.status !== "warn") return;
    expect(outcome.hint).toMatch(/Primitive API key/);
  });

  it("fails when no key is provided and no credentials file exists", () => {
    const outcome = checkApiKey({
      apiKey: undefined,
      configDir: "/tmp/definitely-does-not-exist-2026",
      env: {},
    });
    expect(outcome.status).toBe("fail");
    if (outcome.status !== "fail") return;
    expect(outcome.hint).toMatch(/primitive signin/);
    expect(outcome.hint).toMatch(/PRIMITIVE_API_KEY/);
  });

  it("distinguishes a valid-JSON-but-missing-token credentials file from a malformed one", () => {
    // Greptile flagged that the original implementation labeled both
    // "credentials.json parses but has no api_key" and "credentials.json
    // fails to parse" as "unreadable or malformed", which contradicts
    // the user's actual file state. The split below is the fix.
    const tmp = mkdtempSync(join(tmpdir(), "primitive-doctor-test-"));
    try {
      writeFileSync(join(tmp, "credentials.json"), JSON.stringify({}));
      const outcome = checkApiKey({
        apiKey: undefined,
        configDir: tmp,
        env: {},
      });
      expect(outcome.status).toBe("fail");
      if (outcome.status !== "fail") return;
      expect(outcome.message).toMatch(/contains no OAuth access_token/);
      expect(outcome.message).not.toMatch(/unreadable or malformed/);
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("fails with a sign-in hint for legacy saved API-key credentials", () => {
    const tmp = mkdtempSync(join(tmpdir(), "primitive-doctor-test-"));
    try {
      writeFileSync(
        join(tmp, "credentials.json"),
        JSON.stringify({ api_key: "prim_legacy_saved" }),
      );
      const outcome = checkApiKey({
        apiKey: undefined,
        configDir: tmp,
        env: {},
      });
      expect(outcome.status).toBe("fail");
      if (outcome.status !== "fail") return;
      expect(outcome.message).toMatch(/legacy API-key login state/);
      expect(outcome.hint).toMatch(/primitive signin/);
      expect(outcome.hint).toMatch(/--api-key/);
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("returns ok for saved OAuth credentials", () => {
    const tmp = mkdtempSync(join(tmpdir(), "primitive-doctor-test-"));
    try {
      writeFileSync(
        join(tmp, "credentials.json"),
        JSON.stringify({
          access_token: "prim_oat_saved",
          auth_method: "oauth",
        }),
      );
      const outcome = checkApiKey({
        apiKey: undefined,
        configDir: tmp,
        env: {},
      });
      expect(outcome.status).toBe("ok");
      expect(outcome.message).toMatch(/OAuth session/);
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("labels a credentials file that fails JSON.parse as unreadable or malformed", () => {
    const tmp = mkdtempSync(join(tmpdir(), "primitive-doctor-test-"));
    try {
      writeFileSync(join(tmp, "credentials.json"), "{not valid json");
      const outcome = checkApiKey({
        apiKey: undefined,
        configDir: tmp,
        env: {},
      });
      expect(outcome.status).toBe("fail");
      if (outcome.status !== "fail") return;
      expect(outcome.message).toMatch(/unreadable or malformed/);
    } finally {
      rmSync(tmp, { force: true, recursive: true });
    }
  });

  it("fails with a rename hint when PRIMITIVE_KEY is set but PRIMITIVE_API_KEY is not", () => {
    // AGX feedback: users on stale docs (or coming from other tools)
    // set PRIMITIVE_KEY and then can't figure out why the CLI says "no
    // API key found". The CLI reads PRIMITIVE_API_KEY only. Doctor must
    // detect the mistake and name the fix.
    const outcome = checkApiKey({
      apiKey: undefined,
      configDir: "/tmp/definitely-does-not-exist-2026",
      env: { PRIMITIVE_KEY: "prim_legacy_var" },
    });
    expect(outcome.status).toBe("fail");
    if (outcome.status !== "fail") return;
    expect(outcome.message).toMatch(/PRIMITIVE_KEY/);
    expect(outcome.message).toMatch(/PRIMITIVE_API_KEY/);
    expect(outcome.hint).toMatch(/PRIMITIVE_API_KEY=\$PRIMITIVE_KEY/);
  });

  it("does not surface the PRIMITIVE_KEY rename hint when PRIMITIVE_API_KEY is also set", () => {
    // If the user has both vars set, PRIMITIVE_API_KEY wins (that's
    // what the CLI reads) and the rename hint is noise. The other
    // checks downstream still apply via the resolveCliAuth path; this
    // helper only fires when the API key was not passed in.
    const outcome = checkApiKey({
      apiKey: undefined,
      configDir: "/tmp/definitely-does-not-exist-2026",
      env: {
        PRIMITIVE_KEY: "prim_legacy_var",
        PRIMITIVE_API_KEY: "prim_canonical_var",
      },
    });
    // No credentials file, no flag, but PRIMITIVE_API_KEY is set in the
    // env. The caller (oclif Flags.string with env: PRIMITIVE_API_KEY)
    // would normally surface that as opts.apiKey, but this helper is
    // pure: it should ignore env-resolved values it didn't see on its
    // input and only fail with the generic missing-auth message.
    expect(outcome.status).toBe("fail");
    if (outcome.status !== "fail") return;
    expect(outcome.message).not.toMatch(/PRIMITIVE_KEY is set/);
  });
});

describe("checkApiKey on a machine with only connected agent profiles", () => {
  it("names the saved profiles and how to select one instead of failing with signin", () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-doctor-agents-"));
    try {
      for (const name of ["session-b", "session-a"])
        saveConnectedAgentProfile(directory, name, {
          version: 1,
          auth_method: "agent_connection",
          api_key: ["pconn", "c".repeat(48)].join("_"),
          api_base_url: "https://api.primitive.dev/v1",
          org_id: "22222222-2222-4222-8222-222222222222",
          agent_address: `${name}@example.com`,
          owner_address: "owner@example.com",
          invitation_hash: "d".repeat(64),
          created_at: new Date().toISOString(),
        });
      const outcome = checkApiKey({
        apiKey: undefined,
        configDir: directory,
        env: {},
      });
      expect(outcome.status).toBe("warn");
      if (outcome.status === "ok") return;
      expect(outcome.message).toContain("session-a, session-b");
      expect(outcome.hint).toBe(
        "Select one to check it: PRIMITIVE_AGENT_PROFILE=session-a primitive doctor",
      );
      expect(outcome.hint).not.toMatch(/signin/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("doctor with a saved connected profile", () => {
  it("points a Claude hook receiver at agent connect --status, not listen --status", async () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-doctor-hook-"));
    const session = "11111111-1111-4111-8111-111111111111";
    const stderr: string[] = [];
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
      });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "hooked");
      vi.stubEnv("PRIMITIVE_API_KEY", undefined);
      saveConnectedAgentProfile(directory, "hooked", {
        version: 1,
        auth_method: "agent_connection",
        api_key: ["pconn", "a".repeat(48)].join("_"),
        api_base_url: "https://api.primitive.dev/v1",
        org_id: session,
        agent_address: "hooked@example.com",
        owner_address: "owner@example.com",
        invitation_hash: "b".repeat(64),
        created_at: new Date().toISOString(),
      });
      writeMailJson(
        join(agentProfileDirectory(directory, "hooked"), "setup.json"),
        { session, receiverMode: "external" },
      );
      await DoctorCommand.run([], {
        root: resolve(import.meta.dirname, "../.."),
      });
      const text = stderr.join("");
      expect(text).toContain(
        "`primitive agent connect --profile hooked --status --json` for this profile's receiver",
      );
      expect(text).not.toContain("listen --status");
      // Whoami names the profile too, so the hint runs as this identity.
      expect(text).toContain(
        "`PRIMITIVE_AGENT_PROFILE=hooked primitive whoami --json` for saved identity",
      );
    } finally {
      write.mockRestore();
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
