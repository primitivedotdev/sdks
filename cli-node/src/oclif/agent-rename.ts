import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { contactAddress } from "./contacts.js";

type Client = PrimitiveApiClient["client"];

export const AGENT_NAME_MAX_LENGTH = 64;

export const RENAME_UNSUPPORTED_MESSAGE =
  "This Primitive API does not support renaming yet. The display name was not changed.";

export class AgentRenameApiError extends Error {
  constructor(
    readonly payload: unknown,
    readonly status?: number,
  ) {
    super("Agent rename request failed.");
  }
}

/** Raised when the API has no rename route (an older server). */
export class AgentRenameUnsupportedError extends Error {
  constructor() {
    super(RENAME_UNSUPPORTED_MESSAGE);
  }
}

export type RenamedConnection = {
  address: string;
  name: string;
  status: string;
} & Record<string, unknown>;

/**
 * C0 and C1 control characters, plus the Unicode line and paragraph
 * separators, which would split a name across lines.
 */
export function controlCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  return (
    code < 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0x2028 ||
    code === 0x2029
  );
}

/**
 * The same rules the server applies: trimmed, 1-64 characters, one line, no
 * control characters.
 */
export function agentDisplayName(value: string): string {
  const name = value.trim();
  if (name === "") throw new Error("The agent name must not be empty.");
  if (Array.from(name).some(controlCharacter))
    throw new Error(
      "The agent name must be one line without control characters.",
    );
  if (Array.from(name).length > AGENT_NAME_MAX_LENGTH)
    throw new Error(
      `The agent name must be at most ${AGENT_NAME_MAX_LENGTH} characters.`,
    );
  return name;
}

/**
 * The address to rename. A connected profile may rename only itself, so it
 * defaults to its own address; an owner login must name the address.
 */
export function renameTarget(
  explicit: string | undefined,
  connected: string | undefined,
): string {
  if (!explicit && !connected)
    throw new Error(
      "Pass --address, or select a connected agent profile to rename itself.",
    );
  const address = contactAddress(explicit ?? connected ?? "");
  if (connected && address !== contactAddress(connected))
    throw new Error("A connected profile can rename only its own address.");
  return address;
}

function errorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const inner = (payload as { error?: unknown }).error;
  const error =
    inner && typeof inner === "object"
      ? (inner as Record<string, unknown>)
      : null;
  return typeof error?.message === "string" ? error.message : "";
}

/**
 * A 404 for an unknown address says the agent connection was not found. Any
 * other 404, including one that echoes the request path or says the route is
 * not served, means this API has no rename route, as on a server that
 * predates renaming.
 */
function missingRoute(payload: unknown): boolean {
  const message = errorMessage(payload);
  if (/not served|\/name\b/i.test(message)) return true;
  return !/connection/i.test(message);
}

export async function renameAgentConnection(
  client: Client,
  params: { address: string; name: string },
): Promise<RenamedConnection> {
  const address = contactAddress(params.address);
  const name = agentDisplayName(params.name);
  const response = await client.patch({
    security: [{ scheme: "bearer", type: "http" }],
    url: "/agent-connections/{address}/name",
    path: { address },
    body: { name },
    headers: { "Content-Type": "application/json" },
    responseStyle: "fields",
  });
  if (response.error !== undefined) {
    const status = response.response?.status;
    if (status === 404 && missingRoute(response.error))
      throw new AgentRenameUnsupportedError();
    throw new AgentRenameApiError(response.error, status);
  }
  const body = response.data as Record<string, unknown> | undefined;
  const data =
    body?.success === true && body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : null;
  const connection =
    data?.connection && typeof data.connection === "object"
      ? (data.connection as Record<string, unknown>)
      : null;
  if (
    !connection ||
    typeof connection.address !== "string" ||
    connection.address.toLowerCase() !== address ||
    typeof connection.name !== "string" ||
    typeof connection.status !== "string"
  )
    throw new Error("The rename API returned an invalid connection.");
  return connection as RenamedConnection;
}
