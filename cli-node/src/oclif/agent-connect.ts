import { createHash } from "node:crypto";
import { rmdirSync } from "node:fs";
import { join } from "node:path";
import { cliInvocation } from "./agent-identity-suggestions.js";
import { claudeWakeHookStatus } from "./claude-wake-install.js";
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
  parseOwnerMemberAddress,
  profileAlreadyConnectedMessage,
  saveConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { backgroundListenStatus } from "./listen-background.js";
import { acquireListenLock } from "./listen-state.js";
import { notificationScope } from "./notify-session.js";
import { SESSION_UUID } from "./notify-session-native.js";
import {
  mailAddress,
  privateMailDirectory,
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";
import { readSharedMailOwner } from "./shared-mail-watch.js";

const MAX_INVITATION_BYTES = 4096;
const MAX_RESPONSE_BYTES = 32_768;
const UNCERTAIN_CLAIM =
  "Setup did not complete safely. The invitation may have been consumed. Request a fresh invitation from the owner; do not retry this invitation.";
const INVITATION_UNAVAILABLE =
  "This invitation was already used, has expired, or was revoked, so it cannot connect this agent. Ask the owner to copy a fresh setup instruction from the app. Nothing was changed on this machine.";
const INVITATION_ATTEMPTED_HERE =
  "An earlier setup on this machine already submitted this invitation and did not finish, so it was not submitted again; it may already be used. Ask the owner to copy a fresh setup instruction from the app. Nothing was changed on this machine.";
const INVITATION_INVALID =
  "Primitive rejected this invitation as invalid. Ask the owner to copy a fresh setup instruction from the app. Nothing was changed on this machine.";

/**
 * The server answered the claim with a definite refusal, so nothing was
 * claimed and no credential exists. Unlike a lost or malformed response, it
 * is safe to discard every local trace of the attempt.
 */
export class AgentInvitationRejectedError extends AgentConnectionSetupError {
  constructor(
    message: string,
    readonly reason:
      | "invitation_unavailable"
      | "invitation_used_here"
      | "invitation_attempted_here"
      | "invitation_invalid"
      | "rate_limited",
  ) {
    super(message);
  }
}

const NOTHING_CHANGED = "Nothing was changed on this machine.";

/**
 * Restates a refusal that followed a replacement: the agent being replaced
 * was disconnected before the claim, so "nothing was changed" is not true.
 */
export function refusalAfterReplacement(
  error: unknown,
  replaced: readonly { address: string }[],
): unknown {
  if (!(error instanceof AgentInvitationRejectedError) || !replaced.length)
    return error;
  const names = replaced.map((row) => row.address).join(", ");
  return new AgentInvitationRejectedError(
    error.message.replace(
      NOTHING_CHANGED,
      `The agent this was replacing (${names}) was already disconnected before the claim and stays disconnected.`,
    ),
    error.reason,
  );
}

/** The error code of a refused claim, read without keeping the body. */
async function claimErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await readClaimResponse(response)) as {
      success?: unknown;
      error?: { code?: unknown };
    } | null;
    return body?.success === false && typeof body.error?.code === "string"
      ? body.error.code
      : null;
  } catch {
    return null;
  }
}

/** A definite refusal of the claim, or null when the outcome is uncertain. */
async function definiteClaimRefusal(
  response: Response,
): Promise<AgentInvitationRejectedError | null> {
  if (![400, 409, 429].includes(response.status)) return null;
  const code = await claimErrorCode(response);
  if (response.status === 409 && code === "connection_invitation_unavailable")
    return new AgentInvitationRejectedError(
      INVITATION_UNAVAILABLE,
      "invitation_unavailable",
    );
  if (response.status === 400 && code === "validation_error")
    return new AgentInvitationRejectedError(
      INVITATION_INVALID,
      "invitation_invalid",
    );
  if (response.status === 429 && code === "rate_limit_exceeded") {
    const seconds = Number(response.headers.get("retry-after"));
    const wait =
      Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 3600
        ? `${seconds} seconds`
        : "a minute";
    return new AgentInvitationRejectedError(
      `Primitive is limiting connection attempts from this network. The invitation was not claimed; wait ${wait} and rerun the same command with the same invitation. Nothing was changed on this machine.`,
      "rate_limited",
    );
  }
  return null;
}

type Invitation = { token: string; apiBaseUrl: string };

/** The message for an invitation another profile on this machine already claimed. */
export function invitationUsedHereMessage(address: string | null): string {
  return `This invitation was already used on this machine${address ? ` to connect ${address}` : ""} under another profile, so it cannot connect this agent. Ask the owner to copy a fresh setup instruction from the app. Nothing was changed on this machine.`;
}

/**
 * A local record says this invitation was submitted before. It is never
 * submitted again: the claim is one-use, and a second submission could not
 * recover a credential lost with an earlier response. The refusal names the
 * address when the earlier attempt finished, and is a definite local refusal
 * either way, so a caller may discard whatever it created for this run.
 */
function earlierAttemptRefusal(
  configDir: string,
  journal: unknown,
  invitationHash: string,
): AgentInvitationRejectedError {
  const record = journal as {
    profile_name?: unknown;
    status?: unknown;
    agent_address?: unknown;
  } | null;
  let address: string | null = null;
  if (record?.status === "claimed" && typeof record.agent_address === "string")
    address = record.agent_address;
  else if (typeof record?.profile_name === "string") {
    try {
      const earlier = loadConnectedAgentProfile(configDir, record.profile_name);
      // Records written before claims were marked complete stay "attempted"
      // even after success; the saved profile shows the claim finished.
      if (earlier?.invitation_hash === invitationHash)
        address = earlier.agent_address;
    } catch {
      /* Unreadable: report the attempt as unfinished. */
    }
  }
  return address !== null || record?.status === "claimed"
    ? new AgentInvitationRejectedError(
        invitationUsedHereMessage(address),
        "invitation_used_here",
      )
    : new AgentInvitationRejectedError(
        INVITATION_ATTEMPTED_HERE,
        "invitation_attempted_here",
      );
}

/** Removes a directory only when it is empty. Best effort. */
export function removeEmptyDirectory(path: string): void {
  try {
    rmdirSync(path);
  } catch {
    /* Not empty, already gone, or unavailable: leave it. */
  }
}
export type AgentConnectResult = {
  status: "claimed" | "already_configured";
  identity: ConnectedAgentIdentity;
  /** The connection's display name, when this run's claim reported one. */
  name?: string;
};

const CONNECTION_NAME_FILE = "connection-name.json";

/**
 * The display name this profile's claim reported, saved beside the profile
 * so a resumed setup can report it too. Undefined when none was saved.
 */
export function savedConnectionName(
  configDir: string,
  profileName: string,
): string | undefined {
  try {
    const saved = readMailJson(
      join(agentProfileDirectory(configDir, profileName), CONNECTION_NAME_FILE),
    ) as { version?: unknown; name?: unknown } | null;
    return saved?.version === 1
      ? claimedConnectionName({ data: { connection: { name: saved.name } } })
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Saves the connection's current display name beside its profile: from the
 * claim, and again after `agent rename`. Best effort: without it a resume
 * omits the name, as for a claim made by an older version.
 */
export function saveConnectionName(
  configDir: string,
  profileName: string,
  name: string,
): void {
  try {
    writeMailJson(
      join(agentProfileDirectory(configDir, profileName), CONNECTION_NAME_FILE),
      { version: 1, name },
    );
  } catch {
    /* Reported as unknown on a later resume. */
  }
}

/** The display name a claim response reports, or undefined when unusable. */
function claimedConnectionName(value: unknown): string | undefined {
  const name = (value as { data?: { connection?: { name?: unknown } } } | null)
    ?.data?.connection?.name;
  if (typeof name !== "string") return undefined;
  const trimmed = name.trim();
  const printable = Array.from(trimmed).every((character) => {
    const code = character.charCodeAt(0);
    return (
      code >= 32 &&
      !(code >= 127 && code <= 159) &&
      code !== 0x2028 &&
      code !== 0x2029
    );
  });
  return trimmed.length > 0 && trimmed.length <= 80 && printable
    ? trimmed
    : undefined;
}

/** The receiver a saved profile's setup record names. Offline. */
export function savedReceiver(
  configDir: string,
  profileName: string,
): { mode: "native" | "external" | "poll"; session: string | null } | null {
  try {
    const setup = readMailJson(
      join(agentProfileDirectory(configDir, profileName), "setup.json"),
    );
    if (!setup || typeof setup !== "object" || Array.isArray(setup))
      return null;
    const saved = setup as Record<string, unknown>;
    return {
      mode:
        saved.receiverMode === "external" || saved.receiverMode === "poll"
          ? saved.receiverMode
          : "native",
      session:
        typeof saved.session === "string" && SESSION_UUID.test(saved.session)
          ? saved.session
          : null,
    };
  } catch {
    return null;
  }
}

/**
 * Where to inspect a saved profile's receiver, by how it receives. Hook and
 * poll receivers run no background listener, so `listen --status` would
 * report one absent; they are inspected with `agent connect --status`.
 */
export function receiverStatusCommand(
  configDir: string,
  profileName: string,
  entry: string | undefined = process.argv[1],
): { mode: "native" | "external" | "poll" | null; command: string } {
  const receiver = savedReceiver(configDir, profileName);
  if (receiver?.mode === "native" && receiver.session)
    return {
      mode: "native",
      command: `PRIMITIVE_AGENT_PROFILE=${profileName} ${cliInvocation(entry)} listen --status --notify-session ${receiver.session}`,
    };
  return {
    mode: receiver?.mode ?? null,
    command: `${cliInvocation(entry)} agent connect --profile ${profileName} --status --json`,
  };
}

/** Offline metadata only; a saved profile is not proof of current API or listener readiness. */
export function agentConnectionStatus(
  configDir: string,
  profileName: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  agentProfileName(profileName);
  const profile = loadConnectedAgentProfile(configDir, profileName);
  const setup = profile
    ? readMailJson(
        join(agentProfileDirectory(configDir, profileName), "setup.json"),
      )
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
    saved?.receiverMode === "external" || saved?.receiverMode === "poll"
      ? saved.receiverMode
      : "native";
  const receiving =
    profile && saved && mode === "poll"
      ? {
          // Nothing local receives: the agent checks with `agent check-mail`.
          mode,
          sessionId: session,
          state: "poll",
          reason: "agent_checks_mail",
          lastSuccessfulMailCheckAt: null,
          liveness: "unknown",
        }
      : profile && session && mode === "native"
        ? (() => {
            const scope = notificationScope(
              profile.api_base_url,
              profile.api_key,
            );
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
            const mailOwner = readSharedMailOwner({
              directory: sharedDirectory,
            });
            return {
              mode,
              sessionId: session,
              state: listener.healthy
                ? listener.phase === "receiving"
                  ? "running"
                  : "degraded"
                : listener.reason === "restarting"
                  ? "degraded"
                  : listener.reason === "absent"
                    ? "unknown"
                    : "down",
              reason: listener.reason ?? listener.failureCode,
              failureCode: listener.failureCode,
              detail: listener.detail ?? null,
              lastSuccessfulMailCheckAt: mailOwner?.lastMailCheckAt ?? null,
              liveness:
                listener.healthy && listener.phase === "receiving"
                  ? "live"
                  : "unknown",
              listener,
            };
          })()
        : profile && session
          ? (() => {
              const hook = claudeWakeHookStatus({
                configDir,
                profileName,
                agentAddress: profile.agent_address,
                sessionId: session,
                env,
              });
              // A missing hook is a known failure. A present hook runs only
              // when the session is active, and running alone proves nothing:
              // receiving counts as running only after a hook-run listener
              // completed a mail check recently. Even then only arriving
              // mail proves a wake from idle.
              const checked = hook.liveness === "checked_recently";
              const unconfirmed = !checked && hook.firedRecently;
              return {
                mode,
                sessionId: session,
                state: !hook.installed
                  ? "down"
                  : checked
                    ? "running"
                    : "unknown",
                reason: !hook.installed
                  ? "hook_missing"
                  : checked
                    ? "hook_mail_check_recent"
                    : unconfirmed
                      ? "hook_mail_check_unconfirmed"
                      : "hook_liveness_unverified",
                detail: !hook.installed
                  ? "The receive hook for this session is missing, so mail will not wake this session. Run `primitive machine doctor --fix` to reinstall it."
                  : checked
                    ? "A listener run by this session's receive hook completed a mail check recently. A wake from idle is confirmed only when new mail arrives."
                    : unconfirmed
                      ? "The receive hook ran recently, but no completed mail check has been recorded in that time. Mail may not be arriving; check this session's Primitive connection."
                      : null,
                lastSuccessfulMailCheckAt: hook.lastMailCheckAt,
                lastFiredAt: hook.lastFiredAt,
                liveness: hook.liveness,
                hook,
              };
            })()
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

/** The saved binding of an invitation: a one-way hash of its origin and token. */
export function agentInvitationHash(input: string): string {
  const invitation = parseAgentInvitation(input);
  return createHash("sha256")
    .update(invitation.apiBaseUrl)
    .update("\0")
    .update(invitation.token)
    .digest("hex");
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
  // Servers that predate the field omit it; the saved profile then omits it
  // too and a later refresh from the connection's own record fills it in. An
  // unusable value is dropped the same way: it must never cost the one-time
  // credential this response carries.
  let ownerMember: string | null | undefined;
  try {
    ownerMember = Object.hasOwn(data, "owner_member_address")
      ? parseOwnerMemberAddress(
          data.owner_member_address,
          mailAddress(data.owner_address),
          mailAddress(connection.address),
        )
      : undefined;
  } catch {
    ownerMember = undefined;
  }
  return parseConnectedAgentProfile({
    version: 1,
    auth_method: "agent_connection",
    api_key: data.api_key,
    api_base_url: data.api_base_url,
    org_id: data.org_id,
    agent_address: connection.address,
    owner_address: data.owner_address,
    ...(ownerMember === undefined ? {} : { owner_member_address: ownerMember }),
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
  /** The caller already holds the agent-connection-setup lock. */
  claimLockHeld?: boolean;
}): Promise<AgentConnectResult> {
  const profileName = agentProfileName(params.profileName);
  const invitation = parseAgentInvitation(params.invitation);
  const invitationHash = agentInvitationHash(params.invitation);
  const directory = agentProfilesDirectory(params.configDir);
  let release: (() => void) | undefined;
  try {
    privateMailDirectory(directory, true);
    release = params.claimLockHeld
      ? () => {}
      : acquireListenLock(directory, "agent-connection-setup");
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
          profileAlreadyConnectedMessage(profileName, existing.agent_address),
        );
      return {
        status: "already_configured",
        identity: connectedAgentIdentity(profileName, existing),
      };
    }
    const journal = join(directory, "claims", `${invitationHash}.json`);
    privateMailDirectory(join(directory, "claims"), true);
    // Checked before this run creates a profile directory, so a refusal
    // leaves nothing behind.
    let earlier: unknown;
    try {
      earlier = readMailJson(journal);
    } catch {
      throw new AgentConnectionSetupError(UNCERTAIN_CLAIM);
    }
    if (earlier !== null)
      throw earlierAttemptRefusal(params.configDir, earlier, invitationHash);
    privateMailDirectory(join(directory, "profiles"), true);
    const profileDirectory = agentProfileDirectory(
      params.configDir,
      profileName,
    );
    privateMailDirectory(profileDirectory, true);
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
        const refusal = await definiteClaimRefusal(response);
        if (!refusal) {
          await response.body?.cancel().catch(() => undefined);
          throw new Error();
        }
        // Nothing was claimed: drop the attempt so a rate-limited invitation
        // can be retried, and leave no empty profile behind.
        try {
          removeMailFile(journal);
        } catch {
          /* A stale attempt record only makes a retry report uncertainty. */
        }
        removeEmptyDirectory(profileDirectory);
        throw refusal;
      }
      const body = await readClaimResponse(response);
      const profile = profileFromClaim(
        body,
        invitation,
        invitationHash,
        params.now ?? Date.now,
      );
      const name = claimedConnectionName(body);
      saveConnectedAgentProfile(params.configDir, profileName, profile);
      // Lets a later run with the same invitation say plainly where it went.
      try {
        writeMailJson(journal, {
          version: 1,
          profile_name: profileName,
          status: "claimed",
          agent_address: profile.agent_address,
        });
      } catch {
        /* The saved profile still identifies the finished claim. */
      }
      // A resumed setup reports the name the claim returned.
      if (name !== undefined)
        saveConnectionName(params.configDir, profileName, name);
      return {
        status: "claimed",
        identity: connectedAgentIdentity(profileName, profile),
        ...(name === undefined ? {} : { name }),
      };
    } catch (error) {
      if (error instanceof AgentInvitationRejectedError) throw error;
      // Never attach transport errors or response bodies: either can contain credentials.
      throw new AgentConnectionSetupError(UNCERTAIN_CLAIM);
    }
  } finally {
    release();
  }
}
