import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgentInvitationRejectedError,
  agentConnectionStatus,
  connectAgent,
  parseAgentInvitation,
  readAgentInvitation,
} from "../../src/oclif/agent-connect.js";
import {
  createAuthenticatedCliApiClient,
  resolveCliApiRequestConfig,
} from "../../src/oclif/api-client.js";
import { resolveCliAuth } from "../../src/oclif/auth.js";
import {
  installClaudeWakeHook,
  recordHookMailCheck,
} from "../../src/oclif/claude-wake-install.js";
import {
  agentProfileDirectory,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { pickDefaultFromAddress } from "../../src/oclif/outbound-defaults.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const token = ["invitation", "a".repeat(48)].join("_");
const credential = ["pconn", "b".repeat(48)].join("_");
const apiBaseUrl = "https://api.primitive.dev/v1";
const setupUrl = `${apiBaseUrl}/agent-connections/setup#token=${token}`;
const orgId = "11111111-1111-4111-8111-111111111111";
const agentAddress = "agent@example.test";
const ownerAddress = "owner@example.test";
const claim = () => ({
  success: true,
  data: {
    org_id: orgId,
    api_base_url: apiBaseUrl,
    api_key: credential,
    owner_address: ownerAddress,
    connection: {
      address: agentAddress,
      owner_address: ownerAddress,
      status: "claimed",
    },
  },
});
const response = (value: unknown = claim(), status = 200) =>
  new Response(JSON.stringify(value), { status });

async function* chunks(...values: Array<string | Buffer>) {
  yield* values;
}

describe("connected-agent setup", () => {
  let configDir: string;
  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "agent-connect-test-"));
  });
  afterEach(() => {
    rmSync(configDir, { force: true, recursive: true });
    vi.unstubAllEnvs();
  });
  it("offline status reports only configured identity and never claims readiness or reveals secrets", async () => {
    expect(agentConnectionStatus(configDir, "work")).toEqual({
      status: "not_configured",
      profileName: "work",
    });
    expect(existsSync(agentProfilesDirectory(configDir))).toBe(false);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response());
    await connectAgent({
      configDir,
      profileName: "work",
      invitation: setupUrl,
      fetch,
    });
    const status = agentConnectionStatus(configDir, "work");
    expect(status.status).toBe("configured");
    expect(JSON.stringify(status)).toContain(agentAddress);
    expect(JSON.stringify(status)).not.toContain(credential);
    expect(JSON.stringify(status)).not.toContain(token);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(status.receiving).toMatchObject({
      state: "unknown",
      reason: "session_not_configured",
      liveness: "unknown",
    });
    writeMailJson(
      join(agentProfileDirectory(configDir, "work"), "setup.json"),
      { session: orgId, receiverMode: "native" },
    );
    expect(agentConnectionStatus(configDir, "work").receiving).toMatchObject({
      mode: "native",
      state: "unknown",
      reason: "absent",
      failureCode: null,
      detail: "No background receiver is recorded for this session.",
      liveness: "unknown",
      lastSuccessfulMailCheckAt: null,
    });
  });
  it("status reports a missing Claude receive hook as a failure, separate from unverified liveness", async () => {
    await connectAgent({
      configDir,
      profileName: "work",
      invitation: setupUrl,
      fetch: vi.fn<typeof globalThis.fetch>(async () => response()),
    });
    writeMailJson(
      join(agentProfileDirectory(configDir, "work"), "setup.json"),
      { session: orgId, receiverMode: "external" },
    );
    const claudeDir = join(configDir, "claude-home");
    const env = { CLAUDE_CONFIG_DIR: claudeDir };
    const missing = agentConnectionStatus(configDir, "work", env).receiving;
    expect(missing).toMatchObject({
      mode: "external",
      state: "down",
      reason: "hook_missing",
      liveness: "unknown",
    });
    const detail = JSON.stringify(missing);
    expect(detail).toContain("mail will not wake this session");
    expect(detail).toContain("primitive machine doctor --fix");

    const bin = join(configDir, "bin");
    mkdirSync(bin);
    for (const name of ["run.js", "claude-wake.mjs", "claude-pending-mail.mjs"])
      writeFileSync(join(bin, name), "");
    expect(
      installClaudeWakeHook({
        cliPath: join(bin, "run.js"),
        configDir,
        profileName: "work",
        agentAddress,
        sessionId: orgId,
        env,
      }),
    ).toBe("installed_unverified");
    expect(
      agentConnectionStatus(configDir, "work", env).receiving,
    ).toMatchObject({
      state: "unknown",
      reason: "hook_liveness_unverified",
      detail: null,
      lastFiredAt: null,
      liveness: "unknown",
      hook: { installed: true },
    });

    // The session's receive hook just ran, but a run alone is not receiving:
    // its mail check may have failed.
    const firedPath = join(
      agentProfileDirectory(configDir, "work"),
      `pending-mail-${orgId}.fired.json`,
    );
    const justNow = new Date().toISOString();
    writeMailJson(firedPath, { version: 1, at: justNow });
    const unconfirmed = agentConnectionStatus(configDir, "work", env).receiving;
    expect(unconfirmed).toMatchObject({
      state: "unknown",
      reason: "hook_mail_check_unconfirmed",
      lastFiredAt: justNow,
      lastSuccessfulMailCheckAt: null,
      liveness: "unknown",
    });
    expect(JSON.stringify(unconfirmed)).toContain(
      "no completed mail check has been recorded",
    );

    // A hook-run listener completed a mail check: receiving is running,
    // reported without claiming a verified wake.
    recordHookMailCheck({ configDir, profileName: "work", sessionId: orgId });
    const checked = agentConnectionStatus(configDir, "work", env).receiving;
    expect(checked).toMatchObject({
      state: "running",
      reason: "hook_mail_check_recent",
      lastFiredAt: justNow,
      lastSuccessfulMailCheckAt: expect.any(String),
      liveness: "checked_recently",
      hook: { installed: true, lastFiredAt: justNow },
    });
    expect(JSON.stringify(checked)).toContain(
      "A wake from idle is confirmed only when new mail arrives.",
    );

    // Records older than the window say nothing about the session now.
    const stale = Date.now() - 60 * 60_000;
    writeMailJson(firedPath, { version: 1, at: new Date(stale).toISOString() });
    recordHookMailCheck({
      configDir,
      profileName: "work",
      sessionId: orgId,
      at: stale,
    });
    expect(
      agentConnectionStatus(configDir, "work", env).receiving,
    ).toMatchObject({
      state: "unknown",
      reason: "hook_liveness_unverified",
      lastFiredAt: new Date(stale).toISOString(),
      liveness: "unknown",
    });
  });
  it("advertises presence only for session setup and persists its trusted fixed return profile", async () => {
    const result = claim();
    Object.assign(result.data, {
      presence_profile: {
        protocol: "primitive.presence",
        version: 1,
        authentication_profile: "primitive-issued-v1",
        return_address: ownerAddress,
      },
    });
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        token,
        capabilities: ["primitive.presence/1"],
      });
      return response(result);
    });
    await connectAgent({
      configDir,
      profileName: "work",
      invitation: setupUrl,
      fetch,
      presence: true,
    });
    expect(
      loadConnectedAgentProfile(configDir, "work")?.presence_profile
        ?.return_address,
    ).toBe(ownerAddress);
    expect(agentConnectionStatus(configDir, "work")).not.toHaveProperty(
      "presence",
    );
  });
  it("saves the owner's personal address apart from the control address", async () => {
    const result = claim();
    Object.assign(result.data, {
      owner_member_address: "Ada_123456789@example.test",
    });
    const outcome = await connectAgent({
      configDir,
      profileName: "work",
      invitation: setupUrl,
      fetch: vi.fn<typeof globalThis.fetch>(async () => response(result)),
    });
    expect(outcome.identity).toMatchObject({
      ownerAddress,
      ownerMemberAddress: "ada_123456789@example.test",
    });
    expect(loadConnectedAgentProfile(configDir, "work")).toMatchObject({
      owner_address: ownerAddress,
      owner_member_address: "ada_123456789@example.test",
    });
  });
  it("reports the connection name a claim returns, and drops an unusable one", async () => {
    const named = claim();
    Object.assign(named.data.connection, { name: "  Research agent  " });
    const outcome = await connectAgent({
      configDir,
      profileName: "work",
      invitation: setupUrl,
      fetch: vi.fn<typeof globalThis.fetch>(async () => response(named)),
    });
    expect(outcome.name).toBe("Research agent");
    const otherConfig = mkdtempSync(join(tmpdir(), "agent-connect-test-"));
    try {
      const unusable = claim();
      Object.assign(unusable.data.connection, { name: "line\nbreak" });
      const result = await connectAgent({
        configDir: otherConfig,
        profileName: "work",
        invitation: setupUrl,
        fetch: vi.fn<typeof globalThis.fetch>(async () => response(unusable)),
      });
      expect(result.status).toBe("claimed");
      expect(result).not.toHaveProperty("name");
    } finally {
      rmSync(otherConfig, { force: true, recursive: true });
    }
  });
  it("marks a finished claim so another profile learns where the invitation went", async () => {
    const request = vi.fn<typeof fetch>(async () => response(claim()));
    await connectAgent({
      configDir,
      profileName: "session-first",
      invitation: setupUrl,
      fetch: request,
    });
    const claims = join(agentProfilesDirectory(configDir), "claims");
    const [record] = readdirSync(claims);
    if (!record) throw new Error("Missing claim record");
    expect(JSON.parse(readFileSync(join(claims, record), "utf8"))).toEqual({
      version: 1,
      profile_name: "session-first",
      status: "claimed",
      agent_address: agentAddress,
    });
    const error = await connectAgent({
      configDir,
      profileName: "session-second",
      invitation: setupUrl,
      fetch: request,
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentInvitationRejectedError);
    expect((error as AgentInvitationRejectedError).reason).toBe(
      "invitation_used_here",
    );
    expect(String(error)).toContain(`to connect ${agentAddress}`);
    expect(String(error)).not.toContain("session-first");
    expect(request).toHaveBeenCalledTimes(1);
    expect(existsSync(agentProfileDirectory(configDir, "session-second"))).toBe(
      false,
    );
  });
  it("records an explicit null and never loses the credential to an unusable personal address", async () => {
    const none = claim();
    Object.assign(none.data, { owner_member_address: null });
    await connectAgent({
      configDir,
      profileName: "shared",
      invitation: setupUrl,
      fetch: vi.fn<typeof globalThis.fetch>(async () => response(none)),
    });
    expect(
      loadConnectedAgentProfile(configDir, "shared")?.owner_member_address,
    ).toBeNull();
    // A separate config: one invitation is claimed at most once per config.
    const otherConfig = mkdtempSync(join(tmpdir(), "agent-connect-test-"));
    try {
      const control = claim();
      Object.assign(control.data, { owner_member_address: ownerAddress });
      const outcome = await connectAgent({
        configDir: otherConfig,
        profileName: "work",
        invitation: setupUrl,
        fetch: vi.fn<typeof globalThis.fetch>(async () => response(control)),
      });
      expect(outcome.status).toBe("claimed");
      const saved = loadConnectedAgentProfile(otherConfig, "work");
      expect(saved?.api_key).toBe(credential);
      expect(saved).not.toHaveProperty("owner_member_address");
    } finally {
      rmSync(otherConfig, { force: true, recursive: true });
    }
  });
  const successfulFetch = () => vi.fn<typeof fetch>(async () => response());
  const params = (fetch: typeof globalThis.fetch) => ({
    configDir,
    profileName: "work",
    invitation: setupUrl,
    fetch,
  });

  it("claims once after a durable journal record and preserves an existing OAuth file", async () => {
    const oauthPath = join(configDir, "credentials.json");
    const existingLogin = JSON.stringify({
      auth_method: "oauth",
      org_id: "other-organization",
    });
    writeFileSync(oauthPath, existingLogin, { mode: 0o600 });
    const request = vi.fn<typeof fetch>(async (url, options) => {
      const journal = join(agentProfilesDirectory(configDir), "claims");
      const names = readdirSync(journal);
      expect(names).toHaveLength(1);
      const journalName = names[0];
      if (!journalName) throw new Error("Missing journal record");
      expect(readFileSync(join(journal, journalName), "utf8")).not.toContain(
        token,
      );
      expect(
        JSON.parse(readFileSync(join(journal, journalName), "utf8")),
      ).toMatchObject({ status: "attempted", profile_name: "work" });
      expect(url).toBe(`${apiBaseUrl}/agent-connections/claim`);
      expect(options?.redirect).toBe("error");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toEqual({
        "content-type": "application/json",
        accept: "application/json",
      });
      expect(options?.body).toBe(JSON.stringify({ token }));
      expect(options?.signal).toBeInstanceOf(AbortSignal);
      return response();
    });
    const result = await connectAgent(params(request));
    expect(result).toEqual({
      status: "claimed",
      identity: {
        profileName: "work",
        orgId,
        agentAddress,
        ownerAddress,
        // This fixture models a server that predates the field.
        ownerMemberAddress: null,
        apiBaseUrl,
      },
    });
    expect(JSON.stringify(result)).not.toContain(credential);
    expect(JSON.stringify(result)).not.toContain(token);
    expect(readFileSync(oauthPath, "utf8")).toBe(existingLogin);
    expect(loadConnectedAgentProfile(configDir, "work")).toMatchObject({
      api_key: credential,
      org_id: orgId,
      agent_address: agentAddress,
    });
    if (process.platform !== "win32") {
      expect(
        statSync(agentProfileDirectory(configDir, "work")).mode & 0o777,
      ).toBe(0o700);
      expect(
        statSync(
          join(agentProfileDirectory(configDir, "work"), "connection.json"),
        ).mode & 0o777,
      ).toBe(0o600);
    }
    expect((await connectAgent(params(request))).status).toBe(
      "already_configured",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not replace an existing identity using another invitation", async () => {
    const request = successfulFetch();
    await connectAgent(params(request));
    const original = loadConnectedAgentProfile(configDir, "work");
    await expect(
      connectAgent({
        ...params(request),
        invitation: setupUrl.replace(token, `${token}next`),
      }),
    ).rejects.toThrow(
      /already connected as .* with a different invitation\. No invitation was claimed[\s\S]*Do not create a separate profile on your own\. Ask the user whether to keep/,
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(loadConnectedAgentProfile(configDir, "work")).toEqual(original);
  });

  it("does not replay the invitation through another profile name", async () => {
    const request = successfulFetch();
    await connectAgent(params(request));
    await expect(
      connectAgent({ ...params(request), profileName: "other" }),
    ).rejects.toThrow(
      /already used on this machine to connect [^ ]+ under another profile[\s\S]*fresh setup instruction/,
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(loadConnectedAgentProfile(configDir, "other")).toBeNull();
  });

  it("serializes concurrent claims before either can submit another request", async () => {
    let resume: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const request = vi.fn<typeof fetch>(async () => {
      await gate;
      return response();
    });
    const first = connectAgent(params(request));
    await expect(
      connectAgent({ ...params(request), profileName: "other" }),
    ).rejects.toThrow(/already running/);
    resume?.();
    await first;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("names a spent invitation plainly and leaves no profile or attempt behind", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      response(
        {
          success: false,
          error: {
            code: "connection_invitation_unavailable",
            message: `${token} ${credential}`,
          },
        },
        409,
      ),
    );
    const error = await connectAgent(params(request)).catch((e) => e);
    expect(error).toBeInstanceOf(AgentInvitationRejectedError);
    expect(error.reason).toBe("invitation_unavailable");
    expect(String(error)).toContain("already used");
    expect(String(error)).toContain("fresh setup instruction");
    expect(String(error)).toContain("Nothing was changed on this machine");
    expect(String(error)).not.toContain(token);
    expect(String(error)).not.toContain(credential);
    expect(existsSync(agentProfileDirectory(configDir, "work"))).toBe(false);
    expect(
      readdirSync(join(agentProfilesDirectory(configDir), "claims")),
    ).toEqual([]);
    // Retrying asks the server again rather than reporting uncertainty.
    await expect(connectAgent(params(request))).rejects.toThrow(/already used/);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("lets a rate-limited claim retry the same invitation", async () => {
    let limited = true;
    const request = vi.fn<typeof fetch>(async () => {
      if (!limited) return response();
      limited = false;
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "rate_limit_exceeded", message: "slow down" },
        }),
        { status: 429, headers: { "retry-after": "30" } },
      );
    });
    await expect(connectAgent(params(request))).rejects.toThrow(
      /was not claimed; wait 30 seconds and rerun the same command/,
    );
    await expect(connectAgent(params(request))).resolves.toMatchObject({
      status: "claimed",
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("maps an invalid invitation to a plain message", async () => {
    const request = vi.fn<typeof fetch>(async () =>
      response(
        {
          success: false,
          error: { code: "validation_error", message: "bad token" },
        },
        400,
      ),
    );
    await expect(connectAgent(params(request))).rejects.toThrow(
      /rejected this invitation as invalid/,
    );
  });

  it.each([
    "transport",
    "http",
    "json",
    "oversized",
    "origin",
    "identity",
    "credential",
  ])("leaves %s outcomes non-replayable and redacts remote content", async (kind) => {
    const request = vi.fn<typeof fetch>(async () => {
      if (kind === "transport") throw new Error(`${token} ${credential}`);
      if (kind === "http")
        return response({ message: `${token} ${credential}` }, 409);
      if (kind === "json") return new Response(`${token} ${credential}`);
      if (kind === "oversized") return new Response("a".repeat(33_000));
      const body = claim();
      if (kind === "origin")
        body.data.api_base_url = "https://untrusted.example/v1";
      if (kind === "identity")
        body.data.connection.owner_address = "other@example.test";
      if (kind === "credential") body.data.api_key = "invalid";
      return response(body);
    });
    try {
      await connectAgent(params(request));
      expect.fail("must refuse");
    } catch (error) {
      expect(String(error)).toContain("fresh invitation");
      expect(String(error)).not.toContain(token);
      expect(String(error)).not.toContain(credential);
    }
    await expect(connectAgent(params(request))).rejects.toThrow(
      /did not finish, so it was not submitted again[\s\S]*fresh setup instruction/,
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(loadConnectedAgentProfile(configDir, "work")).toBeNull();
  });

  it("never claims with malformed input or a traversing profile name", async () => {
    const request = successfulFetch();
    await expect(
      connectAgent({ ...params(request), invitation: "not an invitation" }),
    ).rejects.toThrow();
    await expect(
      connectAgent({ ...params(request), profileName: "../other" }),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    expect(existsSync(agentProfilesDirectory(configDir))).toBe(false);
  });

  it("rejects symlinked private profile files", async () => {
    await connectAgent(params(successfulFetch()));
    const file = join(
      agentProfileDirectory(configDir, "work"),
      "connection.json",
    );
    const copy = join(configDir, "copy.json");
    writeFileSync(copy, readFileSync(file), { mode: 0o600 });
    rmSync(file);
    symlinkSync(copy, file);
    expect(() => loadConnectedAgentProfile(configDir, "work")).toThrow(
      /private agent profile/,
    );
  });

  it.skipIf(process.platform === "win32")(
    "rejects public-readable credential files",
    async () => {
      await connectAgent(params(successfulFetch()));
      chmodSync(
        join(agentProfileDirectory(configDir, "work"), "connection.json"),
        0o644,
      );
      expect(() => loadConnectedAgentProfile(configDir, "work")).toThrow(
        /private agent profile/,
      );
    },
  );

  it("selects the scoped key without reading or refreshing the existing OAuth login", async () => {
    await connectAgent(params(successfulFetch()));
    writeFileSync(
      join(configDir, "credentials.json"),
      "unrelated preserved login",
      { mode: 0o600 },
    );
    const request = vi.fn<typeof fetch>();
    const result = await createAuthenticatedCliApiClient({
      configDir,
      env: { PRIMITIVE_AGENT_PROFILE: "work" },
      fetch: request,
    });
    expect(result.auth).toMatchObject({
      source: "connected-profile",
      apiKey: credential,
      credentials: null,
      connectedAgent: { orgId, agentAddress, ownerAddress, apiBaseUrl },
    });
    expect(request).not.toHaveBeenCalled();
    expect(
      await pickDefaultFromAddress(result.apiClient, {
        auth: result.auth,
        configDir,
        baseUrlOverridden: false,
      }),
    ).toBe(agentAddress);
    expect(readFileSync(join(configDir, "credentials.json"), "utf8")).toBe(
      "unrelated preserved login",
    );
  });

  it("refuses credential/origin overrides and missing profiles instead of falling back", async () => {
    await connectAgent(params(successfulFetch()));
    const selected = { configDir, env: { PRIMITIVE_AGENT_PROFILE: "work" } };
    expect(() => resolveCliAuth({ ...selected, apiKey: "different" })).toThrow(
      /conflict/,
    );
    expect(() =>
      resolveCliAuth({
        ...selected,
        apiBaseUrl: "https://untrusted.example/v1",
      }),
    ).toThrow(/conflict/);
    expect(() =>
      resolveCliAuth({
        configDir,
        env: { PRIMITIVE_AGENT_PROFILE: "missing" },
        apiKey: "different",
      }),
    ).toThrow(/No fallback/);
    expect(
      resolveCliAuth({ ...selected, apiKey: credential, apiBaseUrl }),
    ).toMatchObject({ source: "connected-profile" });
  });

  it.each([
    undefined,
    "https://ambient.example/v1",
  ])("ignores ambient environment origin %s and invalid headers for a selected profile", async (ambientOrigin) => {
    await connectAgent(params(successfulFetch()));
    writeFileSync(
      join(configDir, "config.json"),
      JSON.stringify({
        version: 1,
        current_environment: "staging",
        environments: { staging: { api_base_url: ambientOrigin } },
      }),
    );
    const selected = {
      configDir,
      env: {
        PRIMITIVE_AGENT_PROFILE: "work",
        PRIMITIVE_API_HEADERS: "invalid ambient JSON",
      },
    };
    const expected = {
      apiBaseUrl,
      resolvedApiBaseUrl: apiBaseUrl,
      baseUrlOverridden: false,
      environmentName: null,
    };
    expect(resolveCliApiRequestConfig(selected)).toEqual(expected);
    const request = vi.fn<typeof fetch>();
    const result = await createAuthenticatedCliApiClient({
      ...selected,
      fetch: request,
    });
    expect(result.requestConfig).toEqual(expected);
    expect(result.auth).toMatchObject({
      source: "connected-profile",
      apiKey: credential,
      apiBaseUrl,
    });
    expect(request).not.toHaveBeenCalled();
    await expect(
      createAuthenticatedCliApiClient({ ...selected, apiKey: "different" }),
    ).rejects.toThrow(/conflict/);
    await expect(
      createAuthenticatedCliApiClient({
        ...selected,
        apiBaseUrl: "https://different.example/v1",
      }),
    ).rejects.toThrow(/conflict/);
  });
});

describe("invitation input", () => {
  it("accepts only bounded stdin and public setup representations", async () => {
    expect(
      await readAgentInvitation(chunks(Buffer.from(setupUrl), "\n"), false),
    ).toBe(`${setupUrl}\n`);
    expect(parseAgentInvitation(setupUrl)).toEqual({ token, apiBaseUrl });
    expect(parseAgentInvitation(JSON.stringify({ token }))).toEqual({
      token,
      apiBaseUrl,
    });
    expect(
      parseAgentInvitation(
        JSON.stringify({
          token,
          api_base_url: "https://api.primitive-staging-1.com/v1",
        }),
      ).apiBaseUrl,
    ).toContain("staging");
    await expect(readAgentInvitation(chunks(setupUrl), true)).rejects.toThrow(
      /stdin/,
    );
    await expect(
      readAgentInvitation(chunks("a".repeat(4097)), false),
    ).rejects.toThrow(/limit/);
  });
  it.each([
    "https://untrusted.example/v1/agent-connections/setup#token=",
    "http://api.primitive.dev/v1/agent-connections/setup#token=",
    "https://api.primitive.dev/v1/agent-connections/setup?extra=1#token=",
    "https://api.primitive.dev/v1/agent-connections/claim#token=",
    "https://api.primitive.dev/v1/agent-connections/setup#other=1&token=",
  ])("rejects untrusted or ambiguous setup input %s", (prefix) => {
    expect(() => parseAgentInvitation(`${prefix}${token}`)).toThrow(
      /Pipe the private/,
    );
  });
  it("rejects extra JSON fields, duplicate fragment tokens, and token control characters", () => {
    for (const input of [
      JSON.stringify({ token, extra: true }),
      `${setupUrl}&token=${token}`,
      JSON.stringify({ token: `${token}\n` }),
    ])
      expect(() => parseAgentInvitation(input)).toThrow();
  });
});
