import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import {
  type EmailDetail,
  getAgentContactPolicy,
  getEmail,
  listAgentContacts,
  listSentEmails,
  PrimitiveApiClient,
  type SentEmailStatus,
  searchEmails,
  sendEmail,
} from "@primitivedotdev/api-core";
import {
  AgentInvitationRejectedError,
  agentInvitationHash,
  connectAgent,
  parseAgentInvitation,
  removeEmptyDirectory,
  savedConnectionName,
} from "./agent-connect.js";
import { archiveRevokedSetup, savedSetupRevoked } from "./agent-disconnect.js";
import { readSetupApi, type SetupReadBudget } from "./agent-setup-read.js";
import type { ClaudeWakeHookResult } from "./claude-wake-install.js";
import {
  AGENT_PROFILE_ENV,
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  type ConnectedAgentIdentity,
  type ConnectedAgentProfile,
  connectedAgentIdentity,
  loadConnectedAgentProfile,
  profileAlreadyConnectedMessage,
} from "./connected-agent-profile.js";
import { evaluateContactPolicy } from "./contact-policy.js";
import { runContactRequest } from "./contacts.js";
import { acquireListenLock } from "./listen-state.js";
import { createNotificationContactPolicy } from "./notification-contact-policy.js";
import { connectNativeSession, SESSION_UUID } from "./notify-session-native.js";
import { scopedChatSenderTrust } from "./scoped-chat.js";
import {
  mailId,
  mailObject,
  mailString,
  mailTime,
  privateMailDirectory,
  readMailJson,
  removeMailFile,
  writeMailJson,
} from "./shared-mail-files.js";

const SUBJECT = "Connect your agent to Primitive";
const MARKER =
  /\bprimitive-connection:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}):([1-9]\d*)\b/g;
const fail = (message: string) => new AgentConnectionSetupError(message);
/**
 * How later mail reaches the agent. `native` starts a background receiver for
 * a session socket, `external` installs Claude hooks for one exact session, and
 * `poll` installs nothing: the agent checks for new mail itself, for runtimes
 * with no local session ID or hooks (for example a cloud-hosted conversation
 * whose commands run in a separate sandbox).
 */
export type ReceiverMode = "native" | "external" | "poll";
export const RECEIVER_MODES: readonly ReceiverMode[] = [
  "native",
  "external",
  "poll",
];
type Challenge = { id: string; messageId: string; marker: string };
type SendReceipt = { id: string; status: string };
const RECEIPT_STATUSES = new Set<unknown>([
  "queued",
  "submitted_to_agent",
  "agent_failed",
  "gate_denied",
  "unknown",
  "delivered",
  "bounced",
  "deferred",
  "wait_timeout",
  "scheduled",
  "canceled",
] satisfies SentEmailStatus[]);
function parseReceipt(value: unknown): SendReceipt {
  const row = mailObject(value, ["id", "status"]);
  if (!RECEIPT_STATUSES.has(row.status))
    throw fail(
      "The verification send receipt is incomplete or invalid. Its outcome remains unknown; no verification was resent.",
    );
  return { id: mailId(row.id), status: mailString(row.status, 100) };
}
type SetupState = {
  version: 1;
  /** Null only for poll receiving, which binds no runtime session. */
  session: string | null;
  receiverMode?: ReceiverMode;
  invitationHash: string;
  since: string;
  contactRequests: boolean;
  challenge: Challenge | null;
  phase: "waiting" | "sending" | "sent";
  receipt: SendReceipt | null;
};
type Context = {
  identity: ConnectedAgentIdentity;
  profile: ConnectedAgentProfile;
  client: PrimitiveApiClient;
  fetch: typeof fetch;
  signal: AbortSignal;
  readBudget: SetupReadBudget;
};
export type AgentSetupDependencies = {
  preflight(session: string): Promise<void>;
  findChallenge(context: Context, since: string): Promise<Challenge | null>;
  sendVerification(
    context: Context,
    challenge: Challenge,
    key: string,
  ): Promise<SendReceipt>;
  reconcile(context: Context, key: string): Promise<SendReceipt | null>;
  /** Read this connection's own status within timeoutMs. Never throws. */
  checkVerification(
    context: Context,
    timeoutMs: number,
  ): Promise<VerificationCheck>;
  enableOwner(context: Context): Promise<"enabled" | "silenced">;
  startListener(
    profile: string,
    session: string,
    contactRequests: boolean,
    configDir: string,
  ): Promise<boolean>;
  now(): number;
  sleep(ms: number): Promise<void>;
};

/**
 * One read of the connection's own status. "pending" means keep polling;
 * "unavailable" means stop polling and leave the reply reported as submitted.
 */
export type VerificationCheck =
  | { state: "verified"; verifiedAt: string | null }
  | { state: "pending" }
  | { state: "unavailable" };

/** Waits between status reads after the reply is submitted. The last value repeats. */
export const VERIFICATION_BACKOFF_MS = [
  1_000, 1_000, 2_000, 2_000, 3_000, 5_000,
];
export const DEFAULT_VERIFICATION_TIMEOUT_MS = 60_000;

/**
 * Setup's receiving state for an external receiver: setup itself installs no
 * hooks, so the caller installs them and restates the outcome with
 * {@link externalReceivingState}.
 */
export const EXTERNAL_HOOKS_PENDING = "hooks_pending";

/**
 * The printed receiving state for an external receiver, from the hook
 * install outcome. `hooks_installed` is a finished setup: idle wake is only
 * proven by real mail, which `externalHook: "installed_unverified"` says.
 */
export function externalReceivingState(
  hook: ClaudeWakeHookResult | null,
):
  | "hooks_installed"
  | "hook_unavailable"
  | "held_for_other_profile"
  | "pending_verification" {
  return hook === "installed_unverified"
    ? "hooks_installed"
    : hook === "unavailable"
      ? "hook_unavailable"
      : hook === "held_for_other_profile"
        ? "held_for_other_profile"
        : "pending_verification";
}

/** Both states mean the setup reply was accepted for sending. */
export function verificationReplySubmitted(state: string): boolean {
  return state === "reply_submitted" || state === "verified";
}

/** Parse GET /agent-connections/me for the expected address. Unknown shapes are unavailable. */
export function parseVerificationCheck(
  value: unknown,
  agentAddress: string,
): VerificationCheck {
  if (!value || typeof value !== "object") return { state: "unavailable" };
  const envelope = value as { success?: unknown; data?: unknown };
  if (envelope.success !== true || !envelope.data)
    return { state: "unavailable" };
  if (typeof envelope.data !== "object") return { state: "unavailable" };
  const connection = (envelope.data as { connection?: unknown }).connection;
  if (!connection || typeof connection !== "object")
    return { state: "unavailable" };
  const row = connection as {
    address?: unknown;
    status?: unknown;
    verified_at?: unknown;
  };
  if (
    typeof row.address !== "string" ||
    row.address.toLowerCase() !== agentAddress.toLowerCase()
  )
    return { state: "unavailable" };
  if (row.status === "connected")
    return {
      state: "verified",
      verifiedAt:
        typeof row.verified_at === "string" &&
        Number.isFinite(Date.parse(row.verified_at))
          ? row.verified_at
          : null,
    };
  if (row.status === "claimed") return { state: "pending" };
  return { state: "unavailable" };
}

async function checkVerification(
  context: Context,
  timeoutMs: number,
): Promise<VerificationCheck> {
  try {
    const response = await context.fetch(
      `${context.profile.api_base_url}/agent-connections/me`,
      {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          authorization: `Bearer ${context.profile.api_key}`,
          accept: "application/json",
        },
      },
    );
    if (response.status !== 200) {
      await response.body?.cancel();
      return { state: "unavailable" };
    }
    const text = await response.text();
    if (text.length > 65_536) return { state: "unavailable" };
    return parseVerificationCheck(
      JSON.parse(text),
      context.identity.agentAddress,
    );
  } catch {
    return { state: "unavailable" };
  }
}

/**
 * Poll until the server reports the connection verified, the budget runs out,
 * or the status read is unavailable. Elapsed time is the larger of the clock
 * and the requested waits, so slow reads count against the budget and a
 * frozen clock in tests cannot loop forever. Each read is capped at the time
 * remaining (and at five seconds).
 */
async function awaitVerification(
  context: Context,
  dependencies: AgentSetupDependencies,
  timeoutMs: number,
): Promise<VerificationCheck> {
  const started = dependencies.now();
  let waited = 0;
  const remaining = () =>
    timeoutMs - Math.max(waited, dependencies.now() - started);
  for (let attempt = 0; ; attempt++) {
    const readBudget = Math.min(5_000, remaining());
    if (readBudget <= 0) return { state: "pending" };
    const check = await dependencies.checkVerification(context, readBudget);
    if (check.state !== "pending") return check;
    const step =
      VERIFICATION_BACKOFF_MS[
        Math.min(attempt, VERIFICATION_BACKOFF_MS.length - 1)
      ] ?? 5_000;
    const wait = Math.min(step, remaining());
    if (wait <= 0) return check;
    await dependencies.sleep(wait);
    waited += wait;
  }
}

function parseState(value: unknown): SetupState {
  const keys = [
    "version",
    "session",
    "invitationHash",
    "since",
    "contactRequests",
    "challenge",
    "phase",
    "receipt",
  ];
  const row = mailObject(
    value,
    value && typeof value === "object" && Object.hasOwn(value, "receiverMode")
      ? [...keys, "receiverMode"]
      : keys,
  );
  if (
    row.version !== 1 ||
    (row.receiverMode !== undefined &&
      !RECEIVER_MODES.includes(row.receiverMode as ReceiverMode)) ||
    typeof row.contactRequests !== "boolean" ||
    !["waiting", "sending", "sent"].includes(String(row.phase))
  )
    throw fail("Saved setup state is invalid. Preserve its private files.");
  const challenge =
    row.challenge === null
      ? null
      : mailObject(row.challenge, ["id", "messageId", "marker"]);
  const receipt = row.receipt === null ? null : parseReceipt(row.receipt);
  const invitationHash = mailString(row.invitationHash, 64);
  if (!/^[a-f0-9]{64}$/.test(invitationHash))
    throw fail("Saved setup identity is invalid.");
  const state: SetupState = {
    version: 1,
    session:
      row.session === null && row.receiverMode === "poll"
        ? null
        : mailId(row.session),
    receiverMode: (row.receiverMode ?? "native") as ReceiverMode,
    invitationHash,
    since: mailTime(row.since),
    contactRequests: row.contactRequests,
    phase: row.phase as SetupState["phase"],
    challenge: challenge
      ? {
          id: mailId(challenge.id),
          messageId: mailString(challenge.messageId, 1000),
          marker: mailString(challenge.marker, 100),
        }
      : null,
    receipt,
  };
  if (
    (state.phase !== "waiting" && !state.challenge) ||
    (state.phase === "sent" && !state.receipt)
  )
    throw fail(
      "Saved setup progress is inconsistent. Preserve its private files.",
    );
  return state;
}

/** Match only authenticated owner mail. Subject/search results alone grant no authority. */
export function setupChallenge(
  detail: EmailDetail,
  identity: ConnectedAgentIdentity,
  since: string,
): Challenge | null {
  if (
    detail.subject !== SUBJECT ||
    detail.recipient.toLowerCase() !== identity.agentAddress ||
    detail.to_email.toLowerCase() !== identity.agentAddress ||
    !["accepted", "completed"].includes(detail.status) ||
    !detail.message_id ||
    /[\r\n]/.test(detail.message_id) ||
    detail.parsed?.status !== "complete" ||
    Date.parse(detail.received_at) < Date.parse(since) ||
    !Number.isFinite(Date.parse(detail.received_at)) ||
    !scopedChatSenderTrust(detail, identity.ownerAddress).trusted
  )
    return null;
  const markers = [...new Set((detail.body_text ?? "").match(MARKER) ?? [])];
  if (markers.length !== 1) return null;
  return {
    id: mailId(detail.id),
    messageId: detail.message_id,
    marker: markers[0] ?? "",
  };
}

async function findChallenge(
  context: Context,
  since: string,
): Promise<Challenge | null> {
  const page = await readSetupApi(
    context.readBudget,
    "challenge search",
    (signal) =>
      searchEmails({
        client: context.client.client,
        query: {
          from: context.identity.ownerAddress,
          to: context.identity.agentAddress,
          subject: SUBJECT,
          date_from: since,
          limit: 10,
          snippet: "false",
          include_facets: "false",
        },
        signal,
        responseStyle: "fields",
      }),
  );
  if (
    page.error ||
    !Array.isArray(page.data?.data) ||
    page.data.meta?.cursor !== null
  )
    throw fail(
      "The setup challenge search is incomplete or ambiguous. No verification reply was sent.",
    );
  const matches: Challenge[] = [];
  for (const row of page.data.data) {
    const response = await readSetupApi(
      context.readBudget,
      "challenge detail",
      (signal) =>
        getEmail({
          client: context.client.client,
          path: { id: row.id },
          signal,
          responseStyle: "fields",
        }),
    );
    if (response.error || !response.data?.data)
      throw fail(
        "The setup challenge could not be read. Resume this profile; do not claim again.",
      );
    const match = setupChallenge(response.data.data, context.identity, since);
    if (match) matches.push(match);
  }
  if (matches.length > 1)
    throw fail(
      "Several recent setup challenges match. No challenge was guessed or answered. Ask the owner to confirm the current challenge.",
    );
  return matches[0] ?? null;
}

async function enableOwner(context: Context): Promise<"enabled" | "silenced"> {
  let lastReadError: unknown;
  const policy = createNotificationContactPolicy({
    now: context.readBudget.now,
    recipient: context.identity.agentAddress,
    async readPolicy() {
      const result = await readSetupApi(
        context.readBudget,
        "owner notification policy",
        (signal) =>
          getAgentContactPolicy({
            client: context.client.client,
            path: { agent_address: context.identity.agentAddress },
            signal,
            responseStyle: "fields",
          }),
      ).catch((error: unknown) => {
        lastReadError = error;
        throw error;
      });
      if (result.data?.success !== true || !result.data.data)
        throw fail(
          "The owner notification policy response is incomplete. Resume the saved profile; no preference was changed.",
        );
      return result.data.data;
    },
    async readPage(cursor) {
      const result = await readSetupApi(
        context.readBudget,
        "owner contact preferences",
        (signal) =>
          listAgentContacts({
            client: context.client.client,
            path: { agent_address: context.identity.agentAddress },
            query: { limit: 100, ...(cursor ? { cursor } : {}) },
            signal,
            responseStyle: "fields",
          }),
      ).catch((error: unknown) => {
        lastReadError = error;
        throw error;
      });
      if (result.data?.success !== true)
        throw fail(
          "The owner contact preferences response is incomplete. Resume the saved profile; no preference was changed.",
        );
      return { data: result.data.data, cursor: result.data.meta?.cursor };
    },
  });
  async function refresh() {
    for (let attempt = 0; ; attempt++) {
      lastReadError = undefined;
      const retries = context.readBudget.retries;
      try {
        return await policy.refresh(context.signal);
      } catch (error) {
        if (lastReadError) throw lastReadError;
        // A successful read after a long server backoff may leave the policy
        // snapshot older than its normal TTL. Read a fresh snapshot; never
        // relax freshness or reuse the pre-backoff policy to authorize a write.
        if (attempt >= 2 || context.readBudget.retries === retries) throw error;
      }
    }
  }
  const current = await refresh();
  const member = current.senders.get(context.identity.ownerAddress);
  const decision = evaluateContactPolicy({
    policy: current.policy,
    sender: context.identity.ownerAddress,
    receivedAt: new Date().toISOString(),
    membership: member,
    contactRequests: false,
  });
  if (
    member?.notify === false ||
    (decision.kind === "silent" && ["agent", "org"].includes(decision.source))
  )
    return "silenced";
  if (!member)
    await runContactRequest(context.client.client, {
      target: "agent",
      action: "add",
      agent: context.identity.agentAddress,
      address: context.identity.ownerAddress,
      notify: true,
      purpose: "Messages from this agent's owner",
      signal: context.signal,
    });
  await refresh();
  return (
    await policy.admit(
      context.identity.ownerAddress,
      new Date().toISOString(),
      context.signal,
    )
  )?.kind === "allowed"
    ? "enabled"
    : "silenced";
}

/** Probe that this exact session is loaded and reachable for native receiving. */
export async function nativeSessionPreflight(session: string): Promise<void> {
  const connection = await connectNativeSession({
    threadId: session,
    expectedCwd: process.cwd(),
    signal: AbortSignal.timeout(10_000),
  });
  connection.close();
}

function defaults(): AgentSetupDependencies {
  return {
    checkVerification,
    now: Date.now,
    sleep: async (ms) => {
      await delay(ms);
    },
    preflight: nativeSessionPreflight,
    findChallenge,
    async sendVerification(context, challenge, key) {
      const result = await sendEmail({
        client: context.client.client,
        headers: { "Idempotency-Key": key },
        body: {
          from: context.identity.agentAddress,
          to: context.identity.ownerAddress,
          subject: `Re: ${SUBJECT}`,
          body_text: challenge.marker,
          in_reply_to: challenge.messageId,
          references: [challenge.messageId],
        },
        signal: context.signal,
        responseStyle: "fields",
      });
      if (result.error || !result.data?.data)
        throw fail(
          "The verification send outcome is unknown. Resume this saved profile; do not resend or claim again.",
        );
      return {
        id: mailId(result.data.data.id),
        status: result.data.data.status,
      };
    },
    async reconcile(context, key) {
      const response = await readSetupApi(
        context.readBudget,
        "verification send lookup",
        (signal) =>
          listSentEmails({
            client: context.client.client,
            query: { idempotency_key: key, limit: 2 },
            signal,
            responseStyle: "fields",
          }),
      );
      const page = response.data;
      if (
        !Array.isArray(page?.data) ||
        page.meta?.cursor !== null ||
        page.data.length > 1
      )
        throw fail(
          "The verification send lookup is incomplete or ambiguous. Its outcome remains unknown; no verification was resent.",
        );
      const result = page.data[0];
      if (!result) return null;
      if (
        result.client_idempotency_key !== key ||
        result.from_address !== context.identity.agentAddress ||
        result.to_address !== context.identity.ownerAddress
      )
        throw fail(
          "The verification send lookup returned conflicting identity metadata. Its outcome remains unknown; no verification was resent.",
        );
      return { id: mailId(result.id), status: result.status };
    },
    enableOwner,
    async startListener(profile, session, contactRequests, configDir) {
      const entry = process.argv[1];
      if (!entry)
        throw fail(
          "CLI entrypoint unavailable. Resume setup using the installed CLI.",
        );
      const { stdout } = await promisify(execFile)(
        process.execPath,
        [
          entry,
          "listen",
          "--background",
          "--notify-session",
          session,
          "--contacts",
          ...(contactRequests ? ["--contact-requests"] : []),
        ],
        {
          env: {
            ...process.env,
            [AGENT_PROFILE_ENV]: profile,
            PRIMITIVE_CONFIG_DIR: configDir,
          },
          timeout: 35_000,
          maxBuffer: 65_536,
        },
      );
      const result: unknown = JSON.parse(stdout);
      if (!result || typeof result !== "object") return false;
      const status = (
        result as { status?: { phase?: string; healthy?: boolean } }
      ).status;
      return status?.healthy === true && status.phase === "receiving";
    },
  };
}

/**
 * Saved choices are reused when an option is omitted. Only an explicit option
 * that disagrees with the saved setup is refused, and the message names it so
 * the caller can drop or correct that one option.
 */
function refuseSetupConflicts(
  state: SetupState,
  params: {
    session?: string;
    receiverMode?: ReceiverMode;
    contactRequests?: boolean;
    resume?: boolean;
  },
): void {
  // Poll receiving binds no session, so its resume may omit --session.
  const sessionConflict =
    params.session === undefined
      ? state.receiverMode !== "poll"
      : state.session !== params.session;
  const conflicts = [
    ...(sessionConflict
      ? [
          state.session
            ? `--session (this profile is bound to session ${state.session})`
            : "--session (this profile's setup binds no session)",
        ]
      : []),
    ...(params.receiverMode !== undefined &&
    state.receiverMode !== params.receiverMode
      ? [`--receiver ${params.receiverMode} (saved: ${state.receiverMode})`]
      : []),
    ...(params.contactRequests !== undefined &&
    state.contactRequests !== params.contactRequests
      ? [
          state.contactRequests
            ? "contact requests off (saved setup has --contact-requests)"
            : "--contact-requests (saved setup did not enable it)",
        ]
      : []),
  ];
  if (conflicts.length)
    throw fail(
      `This profile's saved setup conflicts with ${conflicts.join(" and ")}. Omit the option to reuse the saved setup. Its session and notification preferences were not changed.${params.resume ? "" : " Do not create a separate profile on your own: if this session should get a different address, ask the user whether to keep the existing one or disconnect it first."}`,
    );
}

function invitationHashOrNull(invitation: string | undefined): string | null {
  if (invitation === undefined) return null;
  try {
    return agentInvitationHash(invitation);
  } catch {
    return null;
  }
}

/** One resumable operation owns setup plumbing; it never stores or replays the invitation. */
export async function setupAgent(params: {
  configDir: string;
  profileName: string;
  /** Required for native and external receiving; optional for poll. */
  session?: string;
  receiverMode?: ReceiverMode;
  invitation?: string;
  resume?: boolean;
  contactRequests?: boolean;
  timeoutMs?: number;
  /** How long to wait for the server to confirm the reply. Zero skips the wait. */
  verificationTimeoutMs?: number;
  fetch?: typeof fetch;
  dependencies?: Partial<AgentSetupDependencies>;
}) {
  const profileName = agentProfileName(params.profileName);
  if (params.session !== undefined && !SESSION_UUID.test(params.session))
    throw fail("--session requires the exact loaded session UUID.");
  if (
    params.resume
      ? params.invitation !== undefined
      : params.invitation === undefined
  )
    throw fail(
      "Use an invitation on stdin for setup, or --resume without an invitation.",
    );
  const timeoutMs = params.timeoutMs ?? 30_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 0 || timeoutMs > 120_000)
    throw fail("Setup timeout must be between zero and two minutes.");
  const verificationTimeoutMs =
    params.verificationTimeoutMs ?? DEFAULT_VERIFICATION_TIMEOUT_MS;
  if (
    !Number.isSafeInteger(verificationTimeoutMs) ||
    verificationTimeoutMs < 0 ||
    verificationTimeoutMs > 120_000
  )
    throw fail("Verification wait must be between zero and two minutes.");
  const dependencies = { ...defaults(), ...params.dependencies };
  const directory = agentProfileDirectory(params.configDir, profileName);
  // Name a conflicting option before any preflight can fail for it, and let a
  // resume without --receiver preflight the saved receiver.
  let saved: SetupState | null = null;
  try {
    const value = readMailJson(join(directory, "setup.json"));
    saved = value === null ? null : parseState(value);
  } catch {
    /* The locked read below reports an invalid saved setup. */
  }
  // A new invitation replaces a setup whose credential is confirmed revoked,
  // so that setup's choices are not held against it.
  const newHash = params.resume
    ? null
    : invitationHashOrNull(params.invitation);
  const replacesRevoked = (state: SetupState) =>
    newHash !== null &&
    state.invitationHash !== newHash &&
    savedSetupRevoked(params.configDir, profileName, state.invitationHash);
  if (saved && !replacesRevoked(saved)) refuseSetupConflicts(saved, params);
  const receiverMode =
    params.receiverMode ?? (params.resume ? saved?.receiverMode : undefined);
  if (params.session === undefined && (receiverMode ?? "native") !== "poll")
    throw fail(
      "--session requires the exact loaded session UUID. Without one, use --receiver poll. No invitation was claimed.",
    );
  if ((receiverMode ?? "native") === "native" && params.session) {
    try {
      await dependencies.preflight(params.session);
    } catch {
      throw fail(
        "This exact session is not available for native receiving. No invitation was claimed. Open a supported session and retry setup, or rerun with --receiver poll, which needs no session socket.",
      );
    }
  }
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "setup");
  // Set when the server definitely refused the claim: this run's setup
  // record is removed and, once the lock is released, an empty directory.
  let discardStub = false;
  // The connection's display name, known only when this run claimed it.
  let claimedName: string | undefined;
  try {
    const path = join(directory, "setup.json");
    const value = readMailJson(path);
    let state = value === null ? null : parseState(value);
    // The owner reconnected an agent whose credential was revoked (in the
    // app, from another machine, or by a disconnect here). Its setup is moved
    // aside, as a replacement would, and the new invitation is claimed into
    // the same profile and session.
    if (state && replacesRevoked(state)) {
      archiveRevokedSetup(
        params.configDir,
        profileName,
        new Date(dependencies.now()),
      );
      state = null;
    }
    if (state) refuseSetupConflicts(state, params);
    if (!state && loadConnectedAgentProfile(params.configDir, profileName))
      throw fail(
        "This profile was configured without a setup binding. Use its existing session setup; do not adopt it into another session.",
      );
    if (params.resume && !state)
      throw fail(
        "No resumable setup exists for this profile. Do not adopt another session's identity.",
      );
    if (!params.resume) {
      const invitation = parseAgentInvitation(params.invitation ?? "");
      const hash = createHash("sha256")
        .update(invitation.apiBaseUrl)
        .update("\0")
        .update(invitation.token)
        .digest("hex");
      if (state && state.invitationHash !== hash)
        throw fail(
          profileAlreadyConnectedMessage(
            profileName,
            loadConnectedAgentProfile(params.configDir, profileName)
              ?.agent_address ?? null,
          ),
        );
      const created = !state;
      if (!state) {
        // Challenges precede claiming. A single recent authenticated challenge is
        // required; public claims do not expose a challenge ID or generation.
        state = {
          version: 1,
          session: params.session ?? null,
          receiverMode: params.receiverMode ?? "native",
          invitationHash: hash,
          since: new Date(dependencies.now() - 15 * 60_000).toISOString(),
          contactRequests: Boolean(params.contactRequests),
          phase: "waiting",
          challenge: null,
          receipt: null,
        };
        writeMailJson(path, state);
      }
      try {
        claimedName = (
          await connectAgent({
            configDir: params.configDir,
            profileName,
            invitation: params.invitation ?? "",
            fetch: params.fetch,
            presence: true,
          })
        ).name;
      } catch (error) {
        if (error instanceof AgentInvitationRejectedError && created) {
          discardStub = true;
          try {
            removeMailFile(path);
          } catch {
            discardStub = false;
          }
        }
        throw error;
      }
    }
    const profile = loadConnectedAgentProfile(params.configDir, profileName);
    if (!profile || !state || profile.invitation_hash !== state.invitationHash)
      throw fail(
        "The claim has no matching saved credential. Preserve private state and request a fresh invitation; do not replay this one.",
      );
    // Preserve the supported challenge wait plus bounded completion headroom.
    const setupBudgetMs = Math.max(90_000, timeoutMs + 30_000);
    const readBudget: SetupReadBudget = {
      deadline: dependencies.now() + setupBudgetMs,
      now: dependencies.now,
      sleep: dependencies.sleep,
      signal: AbortSignal.timeout(setupBudgetMs),
      retries: 0,
    };
    const context: Context = {
      identity: connectedAgentIdentity(profileName, profile),
      profile,
      client: new PrimitiveApiClient({
        apiKey: profile.api_key,
        apiBaseUrl: profile.api_base_url,
        fetch: params.fetch,
      }),
      fetch: params.fetch ?? fetch,
      signal: readBudget.signal,
      readBudget,
    };
    let confirmed: { verifiedAt: string | null } | null = null;
    const submittedState = () =>
      state?.phase === "sent"
        ? ["agent_failed", "gate_denied", "bounced", "canceled"].includes(
            state.receipt?.status ?? "",
          )
          ? "reply_failed"
          : ["unknown", "wait_timeout"].includes(state.receipt?.status ?? "")
            ? "delivery_unknown"
            : "reply_submitted"
        : state?.phase === "sending"
          ? "send_unknown"
          : "challenge_pending";
    // A resume did not claim; the name its claim saved still applies.
    claimedName ??= savedConnectionName(params.configDir, profileName);
    const result = (receiving: string, ownerNotifications?: string) => ({
      identity: context.identity,
      ...(claimedName === undefined ? {} : { connectionName: claimedName }),
      sessionId: params.session ?? state?.session ?? null,
      verification: {
        state:
          confirmed && submittedState() === "reply_submitted"
            ? "verified"
            : submittedState(),
        ...(confirmed ? { verifiedAt: confirmed.verifiedAt } : {}),
        ...(state?.receipt
          ? { sentId: state.receipt.id, deliveryStatus: state.receipt.status }
          : {}),
      },
      receiving: { state: receiving },
      ...(ownerNotifications ? { ownerNotifications } : {}),
      resumeCommand: `primitive agent connect --profile ${profileName}${state?.session ? ` --session ${state.session}` : ""}${state?.receiverMode === "external" || state?.receiverMode === "poll" ? ` --receiver ${state.receiverMode}` : ""} --resume${state?.contactRequests ? " --contact-requests" : ""} --json`,
      guidance: confirmed
        ? "Primitive verified this connection. Receiving health is reported separately. Keep this profile for all mail commands."
        : submittedState() === "reply_submitted"
          ? "The verification reply was submitted and Primitive has not confirmed it yet. Verification usually completes within seconds; check it later with GET /agent-connections/me. Receiving health is reported separately. Keep this profile for all mail commands."
          : "Reply submission is not proof of delivery or app verification. Receiving health is reported separately. Keep this profile for all mail commands.",
    });
    const key = `connection-verification-${state.invitationHash}`;
    if (state.phase === "sending") {
      const receipt = await dependencies.reconcile(context, key);
      if (!receipt) return result("not_started");
      state.receipt = parseReceipt(receipt);
      state.phase = "sent";
      writeMailJson(path, state);
    }
    if (state.phase === "waiting") {
      const deadline = dependencies.now() + timeoutMs;
      do {
        state.challenge = await dependencies.findChallenge(
          context,
          state.since,
        );
        if (state.challenge || dependencies.now() >= deadline) break;
        await dependencies.sleep(Math.min(1500, deadline - dependencies.now()));
      } while (dependencies.now() <= deadline);
      if (!state.challenge) return result("not_started");
      state.phase = "sending";
      writeMailJson(path, state);
      try {
        state.receipt = parseReceipt(
          await dependencies.sendVerification(
            {
              ...context,
              signal: AbortSignal.any([
                context.signal,
                AbortSignal.timeout(30_000),
              ]),
            },
            state.challenge,
            key,
          ),
        );
        state.phase = "sent";
        writeMailJson(path, state);
      } catch {
        return result("not_started");
      }
    }
    const ownerNotifications = await dependencies.enableOwner(context);
    let healthy = false;
    if ((state.receiverMode ?? "native") === "native" && state.session) {
      try {
        healthy = await dependencies.startListener(
          profileName,
          state.session,
          state.contactRequests,
          params.configDir,
        );
      } catch {
        /* Saved setup resumes without claiming or sending again. */
      }
    }
    if (verificationTimeoutMs > 0 && submittedState() === "reply_submitted") {
      const check = await awaitVerification(
        context,
        dependencies,
        verificationTimeoutMs,
      );
      if (check.state === "verified")
        confirmed = { verifiedAt: check.verifiedAt };
    }
    return result(
      state.receiverMode === "external"
        ? EXTERNAL_HOOKS_PENDING
        : state.receiverMode === "poll"
          ? "poll"
          : healthy
            ? "healthy"
            : "not_ready",
      ownerNotifications,
    );
  } finally {
    release();
    if (discardStub) removeEmptyDirectory(directory);
  }
}
