import {
  chmodSync,
  existsSync,
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
      liveness: "unknown",
      lastSuccessfulMailCheckAt: null,
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
    ).rejects.toThrow(/separate profile/);
    expect(request).toHaveBeenCalledTimes(1);
    expect(loadConnectedAgentProfile(configDir, "work")).toEqual(original);
  });

  it("does not replay the invitation through another profile name", async () => {
    const request = successfulFetch();
    await connectAgent(params(request));
    await expect(
      connectAgent({ ...params(request), profileName: "other" }),
    ).rejects.toThrow(/fresh invitation/);
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
      /fresh invitation/,
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
