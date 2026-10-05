import { join } from "node:path";
import {
  agentProfileDirectory,
  loadConnectedAgentProfile,
  parseOwnerMemberAddress,
  saveConnectedAgentProfile,
} from "./connected-agent-profile.js";
import {
  mailAddress,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

const REFRESH_TIMEOUT_MS = 5_000;
const MAX_RESPONSE_BYTES = 64 * 1024;

/** Reads at most MAX_RESPONSE_BYTES, stopping as soon as the body exceeds it. */
async function boundedText(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) return null;
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Reads the owner's personal mailbox from the connection's own record
 * (GET /agent-connections/me) and saves it in the profile, so an agent paired
 * before the server reported it, or before its owner set one up, learns where
 * to send reports. Best effort: any failure keeps the saved value. Returns the
 * address to report to, or null when there is none or it is unknown.
 */
export async function refreshOwnerMemberAddress(params: {
  configDir: string;
  profileName: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): Promise<string | null> {
  const profile = loadConnectedAgentProfile(
    params.configDir,
    params.profileName,
  );
  if (!profile) return null;
  const saved = profile.owner_member_address ?? null;
  try {
    const response = await (params.fetch ?? fetch)(
      `${profile.api_base_url}/agent-connections/me`,
      {
        headers: { authorization: `Bearer ${profile.api_key}` },
        redirect: "error",
        signal: AbortSignal.timeout(params.timeoutMs ?? REFRESH_TIMEOUT_MS),
      },
    );
    if (!response.ok) return saved;
    const text = await boundedText(response);
    if (text === null) return saved;
    const body = JSON.parse(text) as {
      success?: unknown;
      data?: { connection?: Record<string, unknown> };
    } | null;
    const connection = body?.data?.connection;
    if (
      body?.success !== true ||
      !connection ||
      !Object.hasOwn(connection, "owner_member_address") ||
      mailAddress(connection.address) !== profile.agent_address ||
      mailAddress(connection.owner_address) !== profile.owner_address
    )
      return saved;
    const current = parseOwnerMemberAddress(
      connection.owner_member_address,
      profile.owner_address,
      profile.agent_address,
    );
    if (profile.owner_member_address !== current)
      saveConnectedAgentProfile(params.configDir, params.profileName, {
        ...profile,
        owner_member_address: current,
      });
    return current;
  } catch {
    return saved;
  }
}

/** How often a routine command reads the owner's personal address again. */
export const OWNER_MEMBER_REFRESH_INTERVAL_MS = 10 * 60_000;
const REFRESH_STAMP_FILE = "owner-member-refresh.json";

function lastRefreshAttempt(path: string): number | null {
  try {
    const saved = readMailJson(path) as { version?: unknown; at?: unknown };
    if (saved?.version !== 1 || typeof saved.at !== "string") return null;
    const at = Date.parse(saved.at);
    return Number.isFinite(at) ? at : null;
  } catch {
    return null;
  }
}

/**
 * refreshOwnerMemberAddress for routine paths (each mail check, each start of
 * a wake receiver): reads the connection's record at most once per interval,
 * so an owner who sets up a personal address after pairing is learned without
 * a reconnect. Between reads it returns the saved value without a request.
 * The time of each attempt is saved with the profile, so a failing server is
 * not asked again on every turn. Never throws.
 */
export async function refreshOwnerMemberAddressPeriodically(params: {
  configDir: string;
  profileName: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
}): Promise<string | null> {
  try {
    const profile = loadConnectedAgentProfile(
      params.configDir,
      params.profileName,
    );
    if (!profile) return null;
    const now = (params.now ?? Date.now)();
    const stamp = join(
      agentProfileDirectory(params.configDir, params.profileName),
      REFRESH_STAMP_FILE,
    );
    const last = lastRefreshAttempt(stamp);
    if (
      last !== null &&
      last <= now &&
      now - last < (params.intervalMs ?? OWNER_MEMBER_REFRESH_INTERVAL_MS)
    )
      return profile.owner_member_address ?? null;
    try {
      writeMailJson(stamp, { version: 1, at: new Date(now).toISOString() });
    } catch {
      /* Without a stamp the next routine call reads again. */
    }
    return await refreshOwnerMemberAddress(params);
  } catch {
    return null;
  }
}

/** One sentence telling the agent where its reports go. */
export function ownerReportGuidance(identity: {
  ownerAddress: string;
  ownerMemberAddress?: string | null;
}): string {
  return identity.ownerMemberAddress
    ? `Send reports and questions to your owner's personal address ${identity.ownerMemberAddress}; ${identity.ownerAddress} is the setup and presence control address and nobody reads it.`
    : `No personal owner address is known, so reply to the member who wrote to you; never send reports to ${identity.ownerAddress}, the setup and presence control address.`;
}

/**
 * Adds the current personal address and report guidance to a result that
 * carries a connected identity, refreshing the saved profile first.
 */
export async function withOwnerMemberAddress<
  T extends {
    identity: {
      profileName: string;
      ownerAddress: string;
      ownerMemberAddress?: string | null;
    };
  },
>(
  result: T,
  params: { configDir: string; fetch?: typeof fetch; onlyIfUnknown?: boolean },
): Promise<T & { ownerReportGuidance: string }> {
  const saved = loadConnectedAgentProfile(
    params.configDir,
    result.identity.profileName,
  );
  // A claim that already named the personal address needs no extra read. A
  // null or missing value is read again: the owner may have just set one up.
  const ownerMemberAddress =
    params.onlyIfUnknown && typeof saved?.owner_member_address === "string"
      ? saved.owner_member_address
      : await refreshOwnerMemberAddress({
          configDir: params.configDir,
          profileName: result.identity.profileName,
          fetch: params.fetch,
        });
  const identity = { ...result.identity, ownerMemberAddress };
  return {
    ...result,
    identity,
    ownerReportGuidance: ownerReportGuidance(identity),
  };
}
