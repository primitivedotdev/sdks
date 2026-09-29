import {
  addDefaultNetworkMember,
  getDefaultNetworkAgent,
  listAgentNetworks,
  listDefaultNetworkAgents,
  listDefaultNetworkMembers,
  type PrimitiveApiClient,
  removeDefaultNetworkMember,
  updateDefaultNetworkMember,
} from "@primitivedotdev/api-core";
import { contactAddress } from "./contacts.js";

export type NetworkRequest =
  | { action: "list" }
  | {
      action: "members" | "peers";
      cursor?: string;
      limit?: number;
      owner?: string;
    }
  | { action: "get" | "add" | "remove"; address: string }
  | {
      action: "set";
      address: string;
      see?: "on" | "off";
      beSeen?: "on" | "off";
    };

export class NetworkApiError extends Error {
  constructor(readonly payload: unknown) {
    super("Network request failed.");
  }
}

type Client = PrimitiveApiClient["client"];

async function response<T extends { success: boolean; data?: unknown }>(
  pending: Promise<{ data?: T; error?: unknown }>,
): Promise<T & { data: NonNullable<T["data"]> }> {
  const result = await pending;
  if (result.error !== undefined) throw new NetworkApiError(result.error);
  if (result.data?.success !== true || result.data.data == null)
    throw new Error("The network API returned an incomplete response.");
  return result.data as T & { data: NonNullable<T["data"]> };
}

export async function runNetworkRequest(
  client: Client,
  request: NetworkRequest,
): Promise<unknown> {
  if (request.action === "list") {
    const result = await response(
      listAgentNetworks({ client, responseStyle: "fields" }),
    );
    if (!Array.isArray(result.data))
      throw new Error("The network API returned an invalid list.");
    return result.data;
  }
  if (request.action === "members" || request.action === "peers") {
    const cursor =
      request.cursor === undefined ? undefined : contactAddress(request.cursor);
    const limit = request.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200)
      throw new Error("--limit must be between 1 and 200.");
    const owner = request.owner?.trim();
    if (request.owner !== undefined && (!owner || owner.length > 100))
      throw new Error("--owner must be a name or user ID of 1-100 characters.");
    const query = { cursor, limit, ...(owner ? { owner } : {}) };
    const result = await response(
      request.action === "members"
        ? listDefaultNetworkMembers({ client, query, responseStyle: "fields" })
        : listDefaultNetworkAgents({ client, query, responseStyle: "fields" }),
    );
    if (
      !Array.isArray(result.data) ||
      (result.meta?.cursor !== null && typeof result.meta?.cursor !== "string")
    )
      throw new Error("The network API returned an invalid page.");
    // Older servers silently ignore unknown query fields. Never present an
    // unfiltered roster as a match for a named person during staged upgrades.
    if (request.action === "peers" && owner) {
      const needle = owner.toLowerCase();
      const matches = result.data.every((row) => {
        if (row === null || typeof row !== "object") return false;
        const peer = row as { owner?: unknown };
        if (peer.owner === null || typeof peer.owner !== "object") return false;
        const human = peer.owner as { user_id?: unknown; name?: unknown };
        return (
          human.user_id === owner ||
          (typeof human.name === "string" &&
            human.name.toLowerCase().includes(needle))
        );
      });
      if (!matches)
        throw new Error("The network API did not honor the owner filter.");
    }
    return result;
  }
  if (!("address" in request))
    throw new Error("A network address is required.");
  const address = contactAddress(request.address);
  const path = { address };
  if (request.action === "get")
    return (
      await response(
        getDefaultNetworkAgent({ client, path, responseStyle: "fields" }),
      )
    ).data;
  if (request.action === "add")
    return (
      await response(
        addDefaultNetworkMember({ client, path, responseStyle: "fields" }),
      )
    ).data;
  if (request.action === "remove")
    return (
      await response(
        removeDefaultNetworkMember({ client, path, responseStyle: "fields" }),
      )
    ).data;
  if (request.action !== "set") throw new Error("Unknown network operation.");
  if (request.see === undefined && request.beSeen === undefined)
    throw new Error("Pass --see on|off, --be-seen on|off, or both.");
  const body = {
    ...(request.see === undefined ? {} : { can_view: request.see === "on" }),
    ...(request.beSeen === undefined
      ? {}
      : { is_listed: request.beSeen === "on" }),
  };
  return (
    await response(
      updateDefaultNetworkMember({
        client,
        path,
        body,
        responseStyle: "fields",
      }),
    )
  ).data;
}
