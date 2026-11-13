import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import DoctorCommand, {
  ASKED_PAGES,
  checkApiKey,
  checkAskedOfYou,
  checkNode,
  checkProxy,
  RECENT_COVERAGE_DAYS,
  renderRow,
} from "../../src/oclif/commands/doctor.js";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { COMMANDS } from "../../src/oclif/index.js";
import { startBackgroundListen } from "../../src/oclif/listen-background.js";
import { notificationScope } from "../../src/oclif/notify-session.js";
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
    const logged: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line) => {
      logged.push(String(line));
    });
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
      // A warning is not a failure: `ok` agrees with the zero exit code.
      const summary = JSON.parse(logged.join("\n"));
      expect(summary.ok).toBe(true);
      expect(summary.warnings).toBeGreaterThanOrEqual(1);
      expect(process.exitCode ?? 0).toBe(0);
      // --json is accepted; stdout is the same JSON summary.
      logged.length = 0;
      await DoctorCommand.run(["--json"], {
        root: resolve(import.meta.dirname, "../.."),
      });
      expect(JSON.parse(logged.join("\n")).ok).toBe(true);
    } finally {
      write.mockRestore();
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("reports a native receiver's failed background start offline", async () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-doctor-native-"));
    const session = "22222222-2222-4222-8222-222222222222";
    const stderr: string[] = [];
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
      });
    const logged: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line) => {
      logged.push(String(line));
    });
    try {
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "native");
      vi.stubEnv("PRIMITIVE_API_KEY", undefined);
      const apiKey = ["pconn", "c".repeat(48)].join("_");
      saveConnectedAgentProfile(directory, "native", {
        version: 1,
        auth_method: "agent_connection",
        api_key: apiKey,
        api_base_url: "https://api.primitive.dev/v1",
        org_id: session,
        agent_address: "native@example.com",
        owner_address: "owner@example.com",
        invitation_hash: "d".repeat(64),
        created_at: new Date().toISOString(),
      });
      writeMailJson(
        join(agentProfileDirectory(directory, "native"), "setup.json"),
        { session, receiverMode: "native" },
      );
      const root = resolve(import.meta.dirname, "../..");
      // A healthy or never-started receiver adds no row.
      await DoctorCommand.run([], { root });
      expect(JSON.parse(logged.join("\n")).checks).not.toContainEqual(
        expect.objectContaining({ label: "Receiver" }),
      );
      // A start whose supervisor exits before the receiver is ready.
      const exits = join(directory, "exits.mjs");
      writeFileSync(exits, "process.exit(0);");
      await expect(
        startBackgroundListen({
          configDir: directory,
          scope: notificationScope("https://api.primitive.dev/v1", apiKey),
          threadId: session,
          argv: [exits],
          startupTimeoutMs: 5000,
        }),
      ).rejects.toThrow("did not become ready");
      logged.length = 0;
      stderr.length = 0;
      await DoctorCommand.run([], { root });
      const receiver = JSON.parse(logged.join("\n")).checks.find(
        (check: { label: string }) => check.label === "Receiver",
      );
      expect(receiver).toMatchObject({ status: "warn" });
      expect(receiver.message).toMatch(
        /^This profile's receiver is not receiving, and its last background start failed at \d{4}-\d\d-\d\dT[\d:.]+Z \(supervisor-exited\)$/,
      );
      expect(receiver.hint).toContain(
        "its supervisor exited before the receiver was ready",
      );
      expect(receiver.hint).toContain(
        `listen --status --notify-session ${session}`,
      );
      expect(stderr.join("")).toContain("[WARN] Receiver:");
      // A warning only: doctor still exits 0.
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      write.mockRestore();
      log.mockRestore();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  }, 15_000);
});

describe("checkAskedOfYou", () => {
  const NOW = Date.parse("2026-11-13T00:00:00.000Z");
  const DAYS = RECENT_COVERAGE_DAYS;
  type Item = { kind: string; state: string; created_at: string };
  const entry = (
    kind: string,
    state: string,
    created_at = "2026-11-12T23:50:03.000Z",
  ): Item => ({ kind, state, created_at });
  const page = (items: Item[], extra: Record<string, unknown> = {}) => ({
    covers: "you",
    items,
    withheld: [],
    next_cursor: null,
    ...extra,
  });
  type Answer = {
    data?: unknown;
    status?: number;
    throws?: boolean;
    /** Later pages, by the cursor that asks for them. */
    pages?: Record<string, Answer>;
  };
  /** The answers a person's asked and concerning lists give, by relation and cursor. */
  function client(asked: Answer, concerning: Answer = { data: page([]) }) {
    const urls: URL[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const url = new URL(new Request(input, init).url);
      urls.push(url);
      const list =
        url.searchParams.get("relation") === "asked" ? asked : concerning;
      const cursor = url.searchParams.get("cursor");
      const answer = cursor ? list.pages?.[cursor] : list;
      if (!answer) throw new Error(`unexpected page ${cursor}`);
      if (answer.throws) throw new TypeError("fetch failed");
      const status = answer.status ?? 200;
      return new Response(
        JSON.stringify(
          status === 200
            ? { success: true, data: answer.data }
            : { success: false, error: { code: "refused", message: "no" } },
        ),
        { status, headers: { "content-type": "application/json" } },
      );
    });
    return {
      urls,
      api: new PrimitiveApiClient({
        apiKey: "test-key",
        apiBaseUrl: "https://api.example.test/v1",
        fetch,
      }),
    };
  }

  it("warns with what is waiting, what covers your mail with no notice yet, and recent notices", async () => {
    const { api, urls } = client(
      {
        data: page([
          entry("email_rule_request", "pending"),
          entry("email_rule_objection", "pending"),
        ]),
      },
      {
        data: page([
          entry("email_rule_coverage", "pending"),
          entry("email_rule_coverage", "started"),
          entry("email_rule_coverage", "new_version"),
          entry("email_rule_coverage", "baseline"),
          entry("email_rule_coverage", "started", "2026-10-01T00:00:00.000Z"),
        ]),
      },
    );
    expect(await checkAskedOfYou(api, NOW)).toEqual({
      status: "warn",
      message: `1 rule request and 1 objection waiting for you; 1 rule covers your mail with no notice written yet; 2 coverage notices in the last ${DAYS} days`,
      hint: "Run `primitive activity asked --state live` and `primitive activity concerning`.",
    });
    expect(Object.fromEntries(urls[0]?.searchParams ?? [])).toEqual({
      relation: "asked",
      state: "live",
      limit: "50",
    });
    expect(Object.fromEntries(urls[1]?.searchParams ?? [])).toEqual({
      relation: "concerning",
      state: "all",
      limit: "50",
    });
  });

  it("is OK when nothing is waiting, saying how far the notices go, or that they lag when the API does not say", async () => {
    const asOf = { data: page([], { as_of: "2026-11-12T23:50:03.315Z" }) };
    expect(
      await checkAskedOfYou(client({ data: page([]) }, asOf).api, NOW),
    ).toEqual({
      status: "ok",
      message:
        "nothing waiting for you; coverage notices as of 2026-11-12 23:50 UTC",
    });
    expect(await checkAskedOfYou(client({ data: page([]) }).api, NOW)).toEqual({
      status: "ok",
      message:
        "nothing waiting for you; coverage notices can take a few minutes to appear",
    });
  });

  it("reads later pages, counting exactly, and says at least only past its page limit", async () => {
    const request = entry("email_rule_request", "pending");
    const { api, urls } = client(
      {
        data: page([], { next_cursor: "a2" }),
        pages: { a2: { data: page([request, request]) } },
      },
      {
        data: page([], { next_cursor: "c2" }),
        pages: {
          c2: { data: page([entry("email_rule_coverage", "started")]) },
        },
      },
    );
    expect((await checkAskedOfYou(api, NOW))?.message).toBe(
      `2 rule requests waiting for you; 1 coverage notice in the last ${DAYS} days`,
    );
    expect(urls.map((url) => url.searchParams.get("cursor"))).toEqual([
      null,
      "a2",
      null,
      "c2",
    ]);
    // Every page has another after it: the row reads its limit and no more.
    const pages = Object.fromEntries(
      Array.from({ length: ASKED_PAGES + 1 }, (_, n) => [
        `p${n + 2}`,
        { data: page([request], { next_cursor: `p${n + 3}` }) },
      ]),
    );
    const endless = client({
      data: page([request], { next_cursor: "p2" }),
      pages,
    });
    expect((await checkAskedOfYou(endless.api, NOW))?.message).toBe(
      `at least ${ASKED_PAGES} rule requests and objections waiting for you`,
    );
    expect(
      endless.urls.filter(
        (url) => url.searchParams.get("relation") === "asked",
      ),
    ).toHaveLength(ASKED_PAGES);
  });

  it("stops reading notices at the first page that ends before the window", async () => {
    const old = entry(
      "email_rule_coverage",
      "started",
      "2026-10-01T00:00:00.000Z",
    );
    const { api, urls } = client(
      { data: page([]) },
      {
        data: page([entry("email_rule_coverage", "started"), old], {
          next_cursor: "c2",
        }),
      },
    );
    expect((await checkAskedOfYou(api, NOW))?.message).toBe(
      `1 coverage notice in the last ${DAYS} days`,
    );
    expect(urls).toHaveLength(2);
  });

  it("never says nothing is waiting for what it could not see", async () => {
    for (const concerning of [
      { data: page([], { pending_complete: false }) },
      { data: page([], { next_cursor: "c2" }), pages: { c2: { status: 500 } } },
    ]) {
      expect(
        await checkAskedOfYou(client({ data: page([]) }, concerning).api, NOW),
      ).toEqual({
        status: "warn",
        message: "the check of the rules over your mail did not finish",
        hint: "Run `primitive activity concerning`.",
      });
    }
    const unreadable = await checkAskedOfYou(
      client({ data: page([]) }, { status: 500 }).api,
      NOW,
    );
    expect(unreadable).toEqual({
      status: "warn",
      message: "could not check the rules over your mail",
      hint: "Run `primitive activity concerning`.",
    });
    const thrown = await checkAskedOfYou(
      client({ data: page([]) }, { throws: true }).api,
      NOW,
    );
    expect(thrown?.message).toBe("could not check the rules over your mail");
    const objections = await checkAskedOfYou(
      client({
        data: page([], {
          withheld: [
            {
              kind: "email_rule_objection",
              reason: "not_for_this_credential",
              permission: null,
            },
          ],
        }),
      }).api,
      NOW,
    );
    expect(objections).toMatchObject({
      status: "warn",
      message: "objections not shown to this credential",
    });
    const coverage = await checkAskedOfYou(
      client(
        { data: page([]) },
        {
          data: page([], {
            withheld: [
              {
                kind: "email_rule_coverage",
                reason: "not_for_this_credential",
                permission: null,
              },
            ],
          }),
        },
      ).api,
      NOW,
    );
    expect(coverage).toMatchObject({
      status: "warn",
      message: "rules over your mail not shown to this credential",
    });
    for (const asked of [{ status: 500 }, { throws: true }]) {
      expect(await checkAskedOfYou(client(asked).api, NOW)).toMatchObject({
        status: "warn",
        message: "could not check what is waiting for you",
      });
    }
  });

  it("has no row for a credential that is asked nothing", async () => {
    const withheldAll = page([], {
      withheld: ["email_rule_request", "email_rule_objection"].map((kind) => ({
        kind,
        reason: "not_for_this_credential",
        permission: null,
      })),
    });
    for (const asked of [
      { data: page([], { covers: "this_credential" }) },
      { data: withheldAll },
      { status: 403 },
      { status: 401 },
    ]) {
      expect(await checkAskedOfYou(client(asked).api, NOW)).toBeNull();
    }
  });

  it("shows in doctor after Domains, as a warning that leaves the run ok", async () => {
    const directory = mkdtempSync(join(tmpdir(), "primitive-doctor-asked-"));
    const stderr: string[] = [];
    const write = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        stderr.push(String(chunk));
        return true;
      });
    const logged: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((line) => {
      logged.push(String(line));
    });
    const json = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data }), {
        headers: { "content-type": "application/json" },
      });
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>(async (input, init) => {
        const url = new URL(new Request(input, init).url);
        if (url.pathname.endsWith("/account"))
          return json({ id: "acct", email: "me@example.test", plan: "free" });
        if (url.pathname.endsWith("/domains"))
          return json([{ domain: "example.test", is_active: true }]);
        return json(
          url.searchParams.get("relation") === "asked"
            ? page([entry("email_rule_request", "pending")])
            : page([]),
        );
      }),
    );
    try {
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", directory);
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", undefined);
      await DoctorCommand.run(
        [
          "--api-key",
          "prim_test_key",
          "--api-base-url",
          "https://api.example.test/v1",
        ],
        { root: resolve(import.meta.dirname, "../..") },
      );
      const text = stderr.join("");
      expect(text).toMatch(
        /\[OK\]\s+Domains: .*\n\[WARN\] Asked of you: 1 rule request waiting for you\n/,
      );
      const summary = JSON.parse(logged.join("\n"));
      expect(summary.ok).toBe(true);
      expect(summary.checks.at(-1)).toMatchObject({
        label: "Asked of you",
        status: "warn",
        message: "1 rule request waiting for you",
      });
      expect(process.exitCode ?? 0).toBe(0);
    } finally {
      write.mockRestore();
      log.mockRestore();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
