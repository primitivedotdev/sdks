import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  agentProfilesDirectory,
  type ConnectedAgentIdentity,
  type ConnectedAgentProfile,
  connectedAgentIdentity,
  connectedApiBaseUrl,
  loadConnectedAgentProfile,
  parseConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { backgroundListenStatus } from "./listen-background.js";
import { notificationScope } from "./notify-session.js";
import { SESSION_UUID } from "./notify-session-native.js";
import { readSharedMailOwner } from "./shared-mail-watch.js";
import {
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

const MAX_INVITATION_BYTES = 4096;
const MAX_RESPONSE_BYTES = 32_768;
const UNCERTAIN_CLAIM =
  "Setup did not complete safely. The invitation may have been consumed. Request a fresh invitation from the owner; do not retry this invitation.";

type Invitation = { token: string; apiBaseUrl: string };
export type AgentConnectResult = {
  status: "claimed" | "already_configured";
  identity: ConnectedAgentIdentity;
};

/** Offline metadata only; a saved profile is not proof of current API or listener readiness. */
export function agentConnectionStatus(configDir: string, profileName: string) {
  agentProfileName(profileName);
  const profile = loadConnectedAgentProfile(configDir, profileName);
  const setup = profile
    ? readMailJson(join(agentProfileDirectory(configDir, profileName), "setup.json"))
    : null;
  const saved =
    setup && typeof setup === "object" && !Array.isArray(setup)
      ? (setup as Record<string, unknown>)
      : null;
  const session =
    saved &&
    typeof saved.session === "string" &&
    SESSION_UUID.test(saved.session)
      ? saved.session
      : null;
  const mode =
    saved && saved.receiverMode === "external"
      ? "external"
      : "native";
  const receiving =
    profile && session && mode === "native"
      ? (() => {
          const scope = notificationScope(profile.api_base_url, profile.api_key);
          const listener = backgroundListenStatus({
            configDir,
            scope,
            threadId: session,
          });
          const sharedDirectory = join(
            configDir,
            "shared-mail",
            createHash("sha256").update(scope).digest("hex"),
          );
          const mailOwner = readSharedMailOwner({ directory: sharedDirectory });
          return {
            mode,
            sessionId: session,
            state: listener.healthy
              ? listener.phase === "receiving"
                ? "running"
                : "degraded"
              : listener.reason === "absent"
                ? "unknown"
                : "down",
            reason: listener.reason ?? listener.failureCode,
            lastSuccessfulMailCheckAt: mailOwner?.lastMailCheckAt ?? null,
            liveness:
              listener.healthy && listener.phase === "receiving"
                ? "live"
                : "unknown",
            listener,
          };
        })()
      : profile && session
        ? {
            mode,
            sessionId: session,
            state: "unknown",
            reason: "hook_liveness_unverified",
            lastSuccessfulMailCheckAt: null,
            liveness: "unknown",
          }
        : {
            mode: "unknown",
            sessionId: null,
            state: "unknown",
            reason: "session_not_configured",
            lastSuccessfulMailCheckAt: null,
            liveness: "unknown",
          };
  return profile
    ? {
        status: "configured" as const,
        identity: connectedAgentIdentity(profileName, profile),
        receiving,
      }
    : { status: "not_configured" as const, profileName };
}

export function parseAgentInvitation(input: string): Invitation {
  try {
    if (Buffer.byteLength(input) > MAX_INVITATION_BYTES) throw new Error();
    const text = input.trim();
    let token: unknown;
    let base: unknown;
    if (text.startsWith("{")) {
      const value: unknown = JSON.parse(text);
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new Error();
      const row = value as Record<string, unknown>;
      if (
        Object.keys(row).some(
          (key) => key !== "token" && key !== "api_base_url",
        )
      )
        throw new Error();
      token = row.token;
      base = row.api_base_url ?? "https://api.primitive.dev/v1";
    } else {
      const url = new URL(text);
      if (
        url.username ||
        url.password ||
        url.search ||
        url.pathname !== "/v1/agent-connections/setup"
      )
        throw new Error();
      const fragment = new URLSearchParams(url.hash.slice(1));
      if (
        Array.from(fragment.keys()).length !== 1 ||
        fragment.getAll("token").length !== 1
      )
        throw new Error();
      token = fragment.get("token");
      base = `${url.origin}/v1`;
    }
    if (
      typeof token !== "string" ||
      token.length < 32 ||
      token.length > 256 ||
      /\s/.test(token) ||
      Array.from(token).some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
      )
    )
      throw new Error();
    return { token, apiBaseUrl: connectedApiBaseUrl(base) };
  } catch {
    throw new AgentConnectionSetupError(
      "Pipe the private Primitive setup URL or a JSON object containing token and optional api_base_url to stdin. Invitation values are never accepted as command arguments.",
    );
  }
}

export async function readAgentInvitation(
  input: AsyncIterable<string | Buffer>,
  isTTY: boolean | undefined,
): Promise<string> {
  if (isTTY)
    throw new AgentConnectionSetupError(
      "Pipe the private setup invitation to stdin.",
    );
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of input) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > MAX_INVITATION_BYTES)
      throw new AgentConnectionSetupError(
        "Setup invitation exceeds the input limit.",
      );
    chunks.push(bytes);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readClaimResponse(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error();
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

function profileFromClaim(
  value: unknown,
  invitation: Invitation,
  invitationHash: string,
  now: () => number,
): ConnectedAgentProfile {
  const response = value as {
    success?: unknown;
    data?: Record<string, unknown>;
  } | null;
  const data = response?.data;
  const connection = data?.connection as Record<string, unknown> | undefined;
  if (
    response?.success !== true ||
    !data ||
    !connection ||
    data.api_base_url !== invitation.apiBaseUrl ||
    data.owner_address !== connection.owner_address ||
    !["claimed", "connected"].includes(String(connection.status))
  )
    throw new Error();
  return parseConnectedAgentProfile({
    version: 1,
    auth_method: "agent_connection",
    api_key: data.api_key,
    api_base_url: data.api_base_url,
    org_id: data.org_id,
    agent_address: connection.address,
    owner_address: data.owner_address,
    invitation_hash: invitationHash,
    created_at: new Date(now()).toISOString(),
    ...(data.presence_profile === undefined
      ? {}
      : { presence_profile: data.presence_profile }),
  });
}

/** Claims once; saved identity is local configuration, not proof of email readiness. */
export async function connectAgent(params: {
  configDir: string;
  profileName: string;
  invitation: string;
  fetch?: typeof fetch;
  now?: () => number;
  presence?: boolean;
}): Promise<AgentConnectResult> {
  const profileName = agentProfileName(params.profileName);
  const invitation = parseAgentInvitation(params.invitation);
  const invitationHash = createHash("sha256")
    .update(invitation.apiBaseUrl)
    .update("\0")
    .update(invitation.token)
    .digest("hex");
  const directory = agentProfilesDirectory(params.configDir);
  let release: (() => void) | undefined;
  try {
    privateMailDirectory(directory, true);
    release = acquireListenLock(directory, "agent-connection-setup");
  } catch {
    throw new AgentConnectionSetupError(
      "Agent setup is already running, or its private directory is unavailable. No invitation was submitted.",
    );
  }
  try {
    const existing = loadConnectedAgentProfile(params.configDir, profileName);
    if (existing) {
      if (existing.invitation_hash !== invitationHash)
        throw new AgentConnectionSetupError(
          "This agent profile is already configured. Its identity and credentials were not changed. Use a separate profile for another invitation.",
        );
      return {
        status: "already_configured",
        identity: connectedAgentIdentity(profileName, existing),
      };
    }
    privateMailDirectory(join(directory, "profiles"), true);
    privateMailDirectory(
      agentProfileDirectory(params.configDir, profileName),
      true,
    );
    const journal = join(directory, "claims", `${invitationHash}.json`);
    privateMailDirectory(join(directory, "claims"), true);
    if (readMailJson(journal) !== null)
      throw new AgentConnectionSetupError(UNCERTAIN_CLAIM);
    // Durable before dispatch. A crash or lost response must not replay a one-use claim.
    writeMailJson(journal, {
      version: 1,
      profile_name: profileName,
      status: "attempted",
    });
    try {
      const response = await (params.fetch ?? fetch)(
        `${invitation.apiBaseUrl}/agent-connections/claim`,
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(25_000),
          headers: {
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            token: invitation.token,
            ...(params.presence
              ? { capabilities: ["primitive.presence/1"] }
              : {}),
          }),
        },
      );
      if (response.status !== 200) {
        await response.body?.cancel();
        throw new Error();
      }
      const profile = profileFromClaim(
        await readClaimResponse(response),
        invitation,
        invitationHash,
        params.now ?? Date.now,
      );
      saveConnectedAgentProfile(params.configDir, profileName, profile);
      return {
        status: "claimed",
        identity: connectedAgentIdentity(profileName, profile),
      };
    } catch {
      // Never attach transport errors or response bodies: either can contain credentials.
      throw new AgentConnectionSetupError(UNCERTAIN_CLAIM);
    }
  } finally {
    release();
  }
}
