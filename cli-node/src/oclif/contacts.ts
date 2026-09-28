import {
  deleteAgentContact,
  deleteContact,
  getContact,
  listAgentContacts,
  listContacts,
  type PrimitiveApiClient,
  putAgentContact,
  putContact,
} from "@primitivedotdev/api-core";

export type ContactAction = "list" | "get" | "add" | "update" | "remove";
export type ContactTarget = "directory" | "agent";
export type ContactRequest = {
  target: ContactTarget;
  action: ContactAction;
  address?: string;
  agent?: string;
  cursor?: string;
  limit?: number;
  name?: string;
  clearName?: boolean;
  purpose?: string;
  clearPurpose?: boolean;
  notify?: boolean;
  ifVersion?: string;
};

export class ContactsApiError extends Error {
  directoryAvailable = false;
  constructor(readonly payload: unknown) {
    super("Contact request failed.");
  }
}

export function contactAddress(value: string): string {
  const address = value.trim().toLowerCase();
  if (
    address.length > 254 ||
    !/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(
      address,
    )
  )
    throw new Error("Provide a bare contact email address.");
  return address;
}

export function contactAgentAddress(
  explicit?: string,
  connected?: string,
): string {
  if (!explicit && !connected)
    throw new Error("Pass --agent or select a connected agent profile.");
  const address = contactAddress(explicit ?? connected ?? "");
  if (connected && address !== contactAddress(connected))
    throw new Error(
      "This connected profile can manage only its own agent contacts.",
    );
  return address;
}

function version(value: string): string {
  if (!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value))
    throw new Error(
      "The contact version must be the UUID returned by the API.",
    );
  return value;
}

async function response<T extends { success: boolean; data?: unknown }>(
  pending: Promise<{ data?: T; error?: unknown }>,
): Promise<T & { data: NonNullable<T["data"]> }> {
  const result = await pending;
  if (result.error !== undefined) throw new ContactsApiError(result.error);
  if (result.data?.success !== true || result.data.data == null)
    throw new Error("The contacts API returned an incomplete response.");
  return result.data as T & { data: NonNullable<T["data"]> };
}

function pageCursor(value: {
  meta?: { cursor?: string | null };
}): string | null {
  const cursor = value.meta?.cursor;
  if (cursor === null) return null;
  if (typeof cursor !== "string")
    throw new Error(
      "The contacts API omitted pagination state; no write was attempted.",
    );
  return contactAddress(cursor);
}

type Client = PrimitiveApiClient["client"];

async function membershipVersion(
  client: Client,
  agent: string,
  address: string,
): Promise<string> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 1000; page++) {
    const result = await response(
      listAgentContacts({
        client,
        path: { agent_address: agent },
        query: { limit: 100, cursor },
        responseStyle: "fields",
      }),
    );
    if (!Array.isArray(result.data))
      throw new Error("The contacts API returned an invalid page.");
    const next = pageCursor(result);
    const found = result.data.find((row) => row.contact_address === address);
    if (found) {
      if (found.agent_address !== agent)
        throw new Error("The contacts API returned a different agent.");
      return version(found.version);
    }
    if (next === null)
      throw new Error(
        "Agent contact not found. Use agent contacts add to create it.",
      );
    if (seen.has(next))
      throw new Error(
        "Contact pagination repeated a cursor; no write was attempted.",
      );
    seen.add(next);
    cursor = next;
  }
  throw new Error(
    "Contact lookup exceeded its page limit; pass an explicit --if-version.",
  );
}

/** Public generated operations only. Every mutation uses one explicit CAS condition. */
export async function runContactRequest(
  client: Client,
  request: ContactRequest,
): Promise<unknown> {
  const { action, target } = request;
  const address =
    action === "list" ? undefined : contactAddress(request.address ?? "");
  const agent =
    target === "agent" ? contactAgentAddress(request.agent) : undefined;
  const limit = request.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error("--limit must be between 1 and 100.");
  const cursor =
    request.cursor === undefined ? undefined : contactAddress(request.cursor);
  if (request.name !== undefined && request.clearName)
    throw new Error("Use either --name or --clear-name.");
  if (request.purpose !== undefined && request.clearPurpose)
    throw new Error("Use either --purpose or --clear-purpose.");
  if (request.name !== undefined && Array.from(request.name).length > 200)
    throw new Error("Contact names may contain at most 200 characters.");
  if (
    request.purpose !== undefined &&
    Array.from(request.purpose).length > 2000
  )
    throw new Error("Contact purposes may contain at most 2000 characters.");
  const expected =
    request.ifVersion === undefined ? undefined : version(request.ifVersion);
  if (action === "add" && expected)
    throw new Error(
      "Add never overwrites an existing contact. Use update with --if-version.",
    );

  if (action === "list") {
    const result =
      target === "directory"
        ? await response(
            listContacts({
              client,
              query: { cursor, limit },
              responseStyle: "fields",
            }),
          )
        : await response(
            listAgentContacts({
              client,
              path: { agent_address: agent ?? "" },
              query: { cursor, limit },
              responseStyle: "fields",
            }),
          );
    if (!Array.isArray(result.data))
      throw new Error("The contacts API returned an invalid page.");
    pageCursor(result);
    return result;
  }
  if (!address) throw new Error("Provide a contact email address.");
  if (target === "directory") {
    const name = request.clearName ? null : request.name;
    if (action === "update" && name === undefined)
      throw new Error("Pass --name or --clear-name to update the contact.");
    if (
      action === "get" ||
      ((action === "update" || action === "remove") && !expected)
    ) {
      const result = await response(
        getContact({ client, path: { address }, responseStyle: "fields" }),
      );
      if (result.data.address !== address)
        throw new Error("The contacts API returned a different contact.");
      if (action === "get") return result.data;
      request = { ...request, ifVersion: version(result.data.version) };
    }
    if (action === "remove")
      return (
        await response(
          deleteContact({
            client,
            path: { address },
            query: { if_version: version(request.ifVersion ?? "") },
            responseStyle: "fields",
          }),
        )
      ).data;
    const result = await response(
      putContact({
        client,
        path: { address },
        body: {
          ...(action === "add"
            ? { if_absent: true }
            : { if_version: version(request.ifVersion ?? "") }),
          ...(name === undefined ? {} : { display_name: name }),
        },
        responseStyle: "fields",
      }),
    );
    if (result.data.address !== address)
      throw new Error("The contacts API returned a different contact.");
    return result.data;
  }
  if (!agent) throw new Error("Provide an agent address.");
  if (action === "get")
    throw new Error("Use agent contacts list to inspect memberships.");
  const purpose = request.clearPurpose ? null : request.purpose;
  if (
    action === "update" &&
    purpose === undefined &&
    request.notify === undefined
  )
    throw new Error(
      "Pass --purpose, --clear-purpose, --notify or --no-notify.",
    );
  const path = { agent_address: agent, contact_address: address };
  if (action === "add") {
    const directory = await response(
      putContact({
        client,
        path: { address },
        body: { if_absent: true },
        responseStyle: "fields",
      }),
    );
    if (directory.data.address !== address)
      throw new Error("The contacts API returned a different contact.");
  }
  const ifVersion =
    action === "add"
      ? undefined
      : (expected ?? (await membershipVersion(client, agent, address)));
  if (action === "remove")
    return (
      await response(
        deleteAgentContact({
          client,
          path,
          query: { if_version: version(ifVersion ?? "") },
          responseStyle: "fields",
        }),
      )
    ).data;
  try {
    const result = await response(
      putAgentContact({
        client,
        path,
        body: {
          ...(action === "add"
            ? { if_absent: true }
            : { if_version: version(ifVersion ?? "") }),
          ...(purpose === undefined ? {} : { purpose }),
          ...(request.notify === undefined ? {} : { notify: request.notify }),
        },
        responseStyle: "fields",
      }),
    );
    if (
      result.data.agent_address !== agent ||
      result.data.contact_address !== address
    )
      throw new Error("The contacts API returned a different membership.");
    return result.data;
  } catch (error) {
    if (action === "add") {
      const failure =
        error instanceof ContactsApiError
          ? error
          : new ContactsApiError({
              code: "contact_membership_unsaved",
              message:
                error instanceof Error
                  ? error.message
                  : "Agent contact request failed.",
            });
      failure.directoryAvailable = true;
      throw failure;
    }
    throw error;
  }
}
