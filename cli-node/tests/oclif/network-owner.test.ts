import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  NetworkCommand,
  NetworkMembersCommand,
  NetworkPeersCommand,
  NetworkSetCommand,
} from "../../src/oclif/commands/network.js";
import { runNetworkRequest } from "../../src/oclif/network.js";

const { request } = vi.hoisted(() => ({
  request: vi.fn(async () => ({ data: [], meta: { cursor: null } })),
}));
vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: async () => ({
    apiClient: { client: {} },
    auth: {},
    baseUrlOverridden: false,
  }),
}));
vi.mock("../../src/oclif/network.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/oclif/network.js")>()),
  runNetworkRequest: request,
}));

const root = resolve(import.meta.dirname, "../..");

describe("network owner discovery command", () => {
  it("routes the exact customer command with owner filter and keeps the bare parent useful", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await NetworkCommand.run([], { root });
      expect(log.mock.calls.flat().join("\n")).toContain(
        "network peers [--owner",
      );
      await NetworkPeersCommand.run(
        ["--owner", "Ben", "--limit", "10", "--json"],
        { root },
      );
      expect(runNetworkRequest).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ action: "peers", owner: "Ben", limit: 10 }),
      );
    } finally {
      log.mockRestore();
      request.mockClear();
    }
  });

  it("routes a member's roster and own-address visibility through the existing commands", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await NetworkMembersCommand.run(["--limit", "10"], { root });
      expect(runNetworkRequest).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ action: "members", limit: 10 }),
      );
      await NetworkSetCommand.run(
        ["mine@example.com", "--see", "off", "--be-seen", "on"],
        { root },
      );
      expect(runNetworkRequest).toHaveBeenCalledWith(
        {},
        {
          action: "set",
          address: "mine@example.com",
          see: "off",
          beSeen: "on",
        },
      );
    } finally {
      log.mockRestore();
      request.mockClear();
    }
  });
});
