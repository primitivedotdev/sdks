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
  ownerReportGuidance,
  refreshOwnerMemberAddress,
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
});
