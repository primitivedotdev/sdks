import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { contactAddress } from "./contacts.js";

type Client = PrimitiveApiClient["client"];
type Action = "list" | "get" | "set" | "delete";

export type AddressNotesRequest = {
  action: Action;
  address: string;
  name?: string;
  prefix?: string;
  cursor?: string;
  limit?: number;
  value?: unknown;
  visibility?: "private" | "public";
  ifAbsent?: boolean;
  ifVersion?: string;
};

export class AddressNotesApiError extends Error {
  constructor(
    readonly payload: unknown,
    readonly status?: number,
  ) {
    super("Address note request failed.");
  }
}

type Note = {
  address: string;
  name: string;
  value: unknown;
  visibility: "private" | "public";
  version: string;
  created_at: string;
  updated_at: string;
};

const security = [{ scheme: "bearer" as const, type: "http" as const }];

export function addressNoteName(value: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(value))
    throw new Error(
      "Note name must start with a letter or digit and contain at most 128 letters, digits, underscores, dots, or hyphens.",
    );
  return value;
}

export function addressNoteVersion(value: string): string {
  if (!/^[0-9]{1,19}$/.test(value))
    throw new Error(
      "Note version must be the decimal version returned by the API.",
    );
  return value;
}

export function addressNoteTarget(
  explicit: string | undefined,
  connected: string | undefined,
  write: boolean,
): string {
  if (!explicit && !connected)
    throw new Error("Pass --address or select a connected agent profile.");
  const address = contactAddress(explicit ?? connected ?? "");
  if (write && connected && address !== contactAddress(connected))
    throw new Error(
      "This connected profile can write only its own address notes.",
    );
  return address;
}

function note(value: unknown, address: string, name?: string): Note {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The address notes API returned an invalid note.");
  const row = value as Record<string, unknown>;
  if (
    row.address !== address ||
    typeof row.name !== "string" ||
    (name !== undefined && row.name !== name) ||
    (row.visibility !== "private" && row.visibility !== "public") ||
    typeof row.version !== "string" ||
    !/^[0-9]{1,19}$/.test(row.version) ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string" ||
    !("value" in row)
  )
    throw new Error("The address notes API returned an invalid note.");
  return row as Note;
}

function envelope(value: unknown): { data: unknown; meta?: unknown } {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("The address notes API returned an invalid response.");
  const row = value as Record<string, unknown>;
  if (row.success !== true || !("data" in row))
    throw new Error("The address notes API returned an incomplete response.");
  return row as { data: unknown; meta?: unknown };
}

async function result<T>(
  pending: Promise<{ data?: unknown; error?: unknown; response?: Response }>,
): Promise<T> {
  const response = await pending;
  if (response.error !== undefined)
    throw new AddressNotesApiError(response.error, response.response?.status);
  return envelope(response.data).data as T;
}

async function getNote(
  client: Client,
  address: string,
  name: string,
): Promise<Note> {
  const data = await result<unknown>(
    client.get({
      security,
      url: "/address-notes/{address}/{name}",
      path: { address, name },
      responseStyle: "fields",
    }),
  );
  return note(data, address, name);
}

export async function runAddressNotesRequest(
  client: Client,
  request: AddressNotesRequest,
): Promise<unknown> {
  const address = contactAddress(request.address);
  if (request.action === "list") {
    const limit = request.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("--limit must be between 1 and 100.");
    const prefix = request.prefix;
    if (prefix !== undefined && !/^[A-Za-z0-9_.-]{0,128}$/.test(prefix))
      throw new Error(
        "--prefix may contain at most 128 letters, digits, underscores, dots, or hyphens.",
      );
    const cursor =
      request.cursor === undefined
        ? undefined
        : addressNoteName(request.cursor);
    const response = await client.get({
      security,
      url: "/address-notes",
      query: { address, prefix, cursor, limit },
      responseStyle: "fields",
    });
    if (response.error !== undefined)
      throw new AddressNotesApiError(response.error, response.response?.status);
    const body = envelope(response.data);
    if (
      !Array.isArray(body.data) ||
      !body.meta ||
      typeof body.meta !== "object" ||
      Array.isArray(body.meta)
    )
      throw new Error("The address notes API returned an invalid page.");
    const next = (body.meta as Record<string, unknown>).cursor;
    if (
      next !== null &&
      (typeof next !== "string" || addressNoteName(next) !== next)
    )
      throw new Error("The address notes API omitted valid pagination state.");
    return { ...body, data: body.data.map((row) => note(row, address)) };
  }

  const name = addressNoteName(request.name ?? "");
  if (request.action === "get") return getNote(client, address, name);

  if (request.ifAbsent && request.ifVersion !== undefined)
    throw new Error("Use either --if-absent or --if-version.");
  const ifVersion =
    request.ifVersion === undefined
      ? undefined
      : addressNoteVersion(request.ifVersion);
  if (request.action === "set") {
    if (request.value === undefined) throw new Error("Provide a note value.");
    let condition: { if_absent: true } | { if_version: string };
    if (request.ifAbsent) condition = { if_absent: true };
    else if (ifVersion) condition = { if_version: ifVersion };
    else {
      try {
        const current = await getNote(client, address, name);
        condition = { if_version: current.version };
      } catch (error) {
        if (!(error instanceof AddressNotesApiError) || error.status !== 404)
          throw error;
        condition = { if_absent: true };
      }
    }
    const data = await result<unknown>(
      client.put({
        security,
        url: "/address-notes/{address}/{name}",
        path: { address, name },
        body: {
          value: request.value,
          ...condition,
          ...(request.visibility ? { visibility: request.visibility } : {}),
        },
        headers: { "Content-Type": "application/json" },
        responseStyle: "fields",
      }),
    );
    return note(data, address, name);
  }

  const version = ifVersion ?? (await getNote(client, address, name)).version;
  const data = await result<unknown>(
    client.delete({
      security,
      url: "/address-notes/{address}/{name}",
      path: { address, name },
      query: { if_version: version },
      responseStyle: "fields",
    }),
  );
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof (data as { deleted?: unknown }).deleted !== "boolean"
  )
    throw new Error(
      "The address notes API returned an invalid deletion response.",
    );
  return data;
}
