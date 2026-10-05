import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  connectedAgentIdentity,
  loadConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import {
  OWNER_MEMBER_REFRESH_INTERVAL_MS,
  ownerReportGuidance,
  refreshOwnerMemberAddress,
  refreshOwnerMemberAddressPeriodically,
  withOwnerMemberAddress,
} from "../../src/oclif/owner-member-address.js";

const apiBaseUrl = "https://api.primitive.dev/v1";
const agentAddress = "agent@example.test";
const ownerAddress = "owner@example.test";
const personal = "ada_123456789@example.test";
const credential = ["pconn", "b".repeat(48)].join("_");

const me = (connection: Record<string, unknown>) =>
  new Response(
    JSON.stringify({
      success: true,
      data: {
        connection: {
          address: agentAddress,
          owner_address: ownerAddress,
          ...connection,
        },
      },
    }),
  );

describe("the owner's personal address", () => {
  let configDir: string;
  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "owner-member-test-"));
    saveConnectedAgentProfile(configDir, "work", {
      version: 1,
      auth_method: "agent_connection",
      api_key: credential,
      api_base_url: apiBaseUrl,
      org_id: "11111111-1111-4111-8111-111111111111",
      agent_address: agentAddress,
      owner_address: ownerAddress,
      invitation_hash: "c".repeat(64),
      created_at: "2026-10-01T00:00:00.000Z",
    });
  });
  afterEach(() => rmSync(configDir, { force: true, recursive: true }));

  const refresh = (fetch: typeof globalThis.fetch) =>
    refreshOwnerMemberAddress({ configDir, profileName: "work", fetch });

  it("learns it from the connection's own record and saves it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (url, init) => {
      expect(url).toBe(`${apiBaseUrl}/agent-connections/me`);
      expect(init?.headers).toEqual({ authorization: `Bearer ${credential}` });
      return me({ owner_member_address: personal });
    });
    expect(await refresh(fetch)).toBe(personal);
    const profile = loadConnectedAgentProfile(configDir, "work");
    if (!profile) throw new Error("profile missing");
    expect(profile.owner_member_address).toBe(personal);
    expect(connectedAgentIdentity("work", profile)).toMatchObject({
      ownerAddress,
      ownerMemberAddress: personal,
    });
  });

  it("follows the server to null, for a shared connection", async () => {
    await refresh(async () => me({ owner_member_address: personal }));
    expect(await refresh(async () => me({ owner_member_address: null }))).toBe(
      null,
    );
    expect(
      loadConnectedAgentProfile(configDir, "work")?.owner_member_address,
    ).toBeNull();
  });

  it("keeps the saved value when the server is older, unreachable or inconsistent", async () => {
    await refresh(async () => me({ owner_member_address: personal }));
    for (const fetch of [
      async () => me({}),
      async () => new Response("nope", { status: 503 }),
      async () => {
        throw new Error("offline");
      },
      async () =>
        me({ address: "other@example.test", owner_member_address: null }),
      async () => me({ owner_member_address: ownerAddress }),
      async () => me({ owner_member_address: agentAddress }),
    ] as Array<typeof globalThis.fetch>) {
      expect(await refresh(fetch)).toBe(personal);
    }
    expect(
      loadConnectedAgentProfile(configDir, "work")?.owner_member_address,
    ).toBe(personal);
  });

  it("stops reading an oversized response and keeps the saved value", async () => {
    await refresh(async () => me({ owner_member_address: personal }));
    let pulled = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(new Uint8Array(16 * 1024).fill(32));
      },
    });
    expect(await refresh(async () => new Response(endless))).toBe(personal);
    expect(pulled).toBeLessThan(10);
  });

  it("refreshes a rerun of an already configured claim-only profile", async () => {
    const result = {
      status: "already_configured" as const,
      identity: connectedAgentIdentity(
        "work",
        loadConnectedAgentProfile(configDir, "work") ??
          (() => {
            throw new Error("profile missing");
          })(),
      ),
    };
    expect(result.identity.ownerMemberAddress).toBeNull();
    const output = await withOwnerMemberAddress(result, {
      configDir,
      fetch: async () => me({ owner_member_address: personal }),
    });
    expect(output.status).toBe("already_configured");
    expect(output.identity.ownerMemberAddress).toBe(personal);
    expect(output.ownerReportGuidance).toContain(personal);
  });

  it("skips the extra read after a claim that already carried the value", async () => {
    await refresh(async () => me({ owner_member_address: personal }));
    const profile = loadConnectedAgentProfile(configDir, "work");
    if (!profile) throw new Error("profile missing");
    const fetch = vi.fn<typeof globalThis.fetch>();
    const output = await withOwnerMemberAddress(
      { status: "claimed", identity: connectedAgentIdentity("work", profile) },
      { configDir, fetch, onlyIfUnknown: true },
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(output.identity.ownerMemberAddress).toBe(personal);
  });

  it("reads again after a claim that reported no personal address", async () => {
    await refresh(async () => me({ owner_member_address: null }));
    const profile = loadConnectedAgentProfile(configDir, "work");
    if (!profile) throw new Error("profile missing");
    const output = await withOwnerMemberAddress(
      { status: "claimed", identity: connectedAgentIdentity("work", profile) },
      {
        configDir,
        fetch: async () => me({ owner_member_address: personal }),
        onlyIfUnknown: true,
      },
    );
    expect(output.identity.ownerMemberAddress).toBe(personal);
  });

  it("reports null without a saved value or a profile", async () => {
    expect(await refresh(async () => me({}))).toBeNull();
    expect(
      await refreshOwnerMemberAddress({
        configDir,
        profileName: "missing",
        fetch: vi.fn(),
      }),
    ).toBeNull();
  });

  it("tells the agent where reports go and that the control address is not read", () => {
    expect(
      ownerReportGuidance({ ownerAddress, ownerMemberAddress: personal }),
    ).toContain(`personal address ${personal}`);
    const none = ownerReportGuidance({
      ownerAddress,
      ownerMemberAddress: null,
    });
    expect(none).toContain("reply to the member who wrote to you");
    expect(none).toContain(`never send reports to ${ownerAddress}`);
  });

  it("replaces a stale saved null on a routine path, at most once per interval", async () => {
    // Paired before the owner had a personal address: the profile says null.
    await refresh(async () => me({ owner_member_address: null }));
    expect(
      loadConnectedAgentProfile(configDir, "work")?.owner_member_address,
    ).toBeNull();
    let now = Date.parse("2026-10-04T12:00:00.000Z");
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      me({ owner_member_address: personal }),
    );
    const periodic = () =>
      refreshOwnerMemberAddressPeriodically({
        configDir,
        profileName: "work",
        fetch,
        now: () => now,
      });
    // The owner has since set one up; the next routine call learns it.
    expect(await periodic()).toBe(personal);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(
      loadConnectedAgentProfile(configDir, "work")?.owner_member_address,
    ).toBe(personal);

    // Within the interval the saved value answers without a request.
    now += OWNER_MEMBER_REFRESH_INTERVAL_MS - 1;
    expect(await periodic()).toBe(personal);
    expect(fetch).toHaveBeenCalledTimes(1);

    // After it, the record is read again and follows the server.
    now += 1;
    fetch.mockImplementation(async () => me({ owner_member_address: null }));
    expect(await periodic()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not ask a failing server again on every routine call", async () => {
    await refresh(async () => me({ owner_member_address: personal }));
    const now = Date.parse("2026-10-04T12:00:00.000Z");
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () => new Response("down", { status: 503 }),
    );
    for (let i = 0; i < 3; i++)
      expect(
        await refreshOwnerMemberAddressPeriodically({
          configDir,
          profileName: "work",
          fetch,
          now: () => now,
        }),
      ).toBe(personal);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reads again when the saved attempt time is in the future", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      me({ owner_member_address: personal }),
    );
    const at = (now: number) =>
      refreshOwnerMemberAddressPeriodically({
        configDir,
        profileName: "work",
        fetch,
        now: () => now,
      });
    await at(Date.parse("2026-10-05T00:00:00.000Z"));
    // A clock that moved backwards must not suppress reads indefinitely.
    await at(Date.parse("2026-10-04T00:00:00.000Z"));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null for a missing profile without a request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    expect(
      await refreshOwnerMemberAddressPeriodically({
        configDir,
        profileName: "missing",
        fetch,
      }),
    ).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("saves onto the profile as it is after the request, not before it", async () => {
    // Another command rewrites the profile while the read is in flight.
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      const profile = loadConnectedAgentProfile(configDir, "work");
      if (!profile) throw new Error("profile missing");
      saveConnectedAgentProfile(configDir, "work", {
        ...profile,
        created_at: "2026-10-02T00:00:00.000Z",
      });
      return me({ owner_member_address: personal });
    });
    expect(await refresh(fetch)).toBe(personal);
    expect(loadConnectedAgentProfile(configDir, "work")).toMatchObject({
      created_at: "2026-10-02T00:00:00.000Z",
      owner_member_address: personal,
    });
  });

  it("leaves a profile that changed credential during the request alone", async () => {
    const replaced = ["pconn", "d".repeat(48)].join("_");
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      const profile = loadConnectedAgentProfile(configDir, "work");
      if (!profile) throw new Error("profile missing");
      saveConnectedAgentProfile(configDir, "work", {
        ...profile,
        api_key: replaced,
        owner_member_address: null,
      });
      return me({ owner_member_address: personal });
    });
    expect(await refresh(fetch)).toBeNull();
    expect(loadConnectedAgentProfile(configDir, "work")).toMatchObject({
      api_key: replaced,
      owner_member_address: null,
    });
  });

  it("runs one routine refresh per profile at a time", async () => {
    await refresh(async () => me({ owner_member_address: null }));
    let finish: (response: Response) => void = () => undefined;
    const fetch = vi.fn<typeof globalThis.fetch>(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const periodic = () =>
      refreshOwnerMemberAddressPeriodically({
        configDir,
        profileName: "work",
        fetch,
      });
    const first = periodic();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    // While the first read is in flight, a second answers from the saved
    // value instead of racing it.
    expect(await periodic()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    finish(me({ owner_member_address: personal }));
    expect(await first).toBe(personal);
  });
});
