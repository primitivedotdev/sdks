import { describe, expect, it, vi } from "vitest";
import { runNetworkRequest } from "../../src/oclif/network.js";

function client() {
  const get = vi.fn(async () => ({
    data: { success: true, data: [], meta: { cursor: null } },
  }));
  return { get };
}

describe("network owner filter", () => {
  it("forwards a trimmed owner to peer discovery and keeps pagination", async () => {
    const api = client();
    await runNetworkRequest(api as never, {
      action: "peers",
      owner: "  Ben  ",
      limit: 12,
    });
    expect(api.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/agent-networks/default/agents",
        query: { cursor: undefined, limit: 12, owner: "Ben" },
      }),
    );
  });

  it("does not send an owner filter for an unfiltered browse", async () => {
    const api = client();
    await runNetworkRequest(api as never, { action: "peers" });
    expect(api.get).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { cursor: undefined, limit: 50 },
      }),
    );
  });

  it.each([
    " ",
    "x".repeat(101),
  ])("rejects an invalid owner before an API request", async (owner) => {
    const api = client();
    await expect(
      runNetworkRequest(api as never, { action: "peers", owner }),
    ).rejects.toThrow("--owner");
    expect(api.get).not.toHaveBeenCalled();
  });

  it("refuses a legacy unfiltered response instead of presenting a wrong owner", async () => {
    const api = {
      get: vi.fn(async () => ({
        data: {
          success: true,
          data: [{ address: "agent@example.com", owner: null }],
          meta: { cursor: null },
        },
      })),
    };
    await expect(
      runNetworkRequest(api as never, { action: "peers", owner: "Ben" }),
    ).rejects.toThrow("did not honor the owner filter");
  });

  it("accepts only peers whose owner ID or name matches the requested person", async () => {
    const api = {
      get: vi.fn(async () => ({
        data: {
          success: true,
          data: [
            { owner: { user_id: "ben-id", name: "Benjamin" } },
            { owner: { user_id: "other-id", name: "Ben Byrd" } },
          ],
          meta: { cursor: null },
        },
      })),
    };
    const result = await runNetworkRequest(api as never, {
      action: "peers",
      owner: "Ben",
    });
    expect((result as { data: unknown[] }).data).toHaveLength(2);
    await expect(
      runNetworkRequest(api as never, { action: "peers", owner: "ben-id" }),
    ).rejects.toThrow("did not honor the owner filter");
  });
});

describe("member network controls", () => {
  it("uses the server-scoped roster rather than filtering a full roster locally", async () => {
    const row = {
      address: "mine@example.com",
      can_view: true,
      is_listed: false,
      can_manage: true,
    };
    const api = {
      get: vi.fn(async () => ({
        data: { success: true, data: [row], meta: { cursor: null } },
      })),
    };
    const result = await runNetworkRequest(api as never, {
      action: "members",
      limit: 10,
    });
    expect(api.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/agent-networks/default/members",
        query: { cursor: undefined, limit: 10 },
      }),
    );
    expect(result).toMatchObject({ data: [row], meta: { cursor: null } });
  });

  it("preserves the server-derived network management scope in list output", async () => {
    const api = {
      get: vi.fn(async () => ({
        data: {
          success: true,
          data: [{ id: "default", can_manage_all: false }],
        },
      })),
    };
    const result = await runNetworkRequest(api as never, { action: "list" });
    expect(result).toEqual([{ id: "default", can_manage_all: false }]);
  });

  it("patches independent visibility flags on the exact address", async () => {
    const api = {
      patch: vi.fn(async () => ({
        data: {
          success: true,
          data: {
            address: "mine@example.com",
            can_view: false,
            is_listed: true,
          },
        },
      })),
    };
    await runNetworkRequest(api as never, {
      action: "set",
      address: "mine@example.com",
      see: "off",
      beSeen: "on",
    });
    expect(api.patch).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "/agent-networks/default/members/{address}",
        path: { address: "mine@example.com" },
        body: { can_view: false, is_listed: true },
      }),
    );
  });
});
