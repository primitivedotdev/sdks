import { createHash, randomUUID } from "node:crypto";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  getAgentContactPolicy,
  listDomains,
  PrimitiveApiClient,
  putAgentContactPolicy,
} from "@primitivedotdev/api-core";
import { parseAgentInvitation } from "./agent-connect.js";
import {
  RECEIVER_MODES,
  type ReceiverMode,
  setupAgent,
  verificationReplySubmitted,
} from "./agent-setup.js";
import { refreshStoredCliCredentials } from "./api-client.js";
import { loadCliCredentials } from "./auth.js";
import {
  AGENT_PROFILE_ENV,
  AgentConnectionSetupError,
  agentProfileDirectory,
  connectedApiBaseUrl,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { parseAgentContactPolicy } from "./contact-policy.js";
import { acquireListenLock } from "./listen-state.js";
import { connectNativeSession, SESSION_UUID } from "./notify-session-native.js";
import {
  ownerReportGuidance,
  refreshOwnerMemberAddress,
} from "./owner-member-address.js";
import {
  mailAddress,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

const RESPONSE_LIMIT = 32_768;
const CONNECTION_LIST_LIMIT = 131_072;
// Server-side challenge reconciliation may run on a minute cadence when the
// owner's app is closed. Leave a full interval plus startup jitter for it.
const CONFIRMATION_BUDGET_MS = 120_000;
const CONFIRMATION_MAX_ATTEMPTS = 40;
const CONFIRMATION_PAGE_LIMIT = 20;
const refuse = (message: string) => new AgentConnectionSetupError(message);

type Enrollment = {
  version: 1 | 2;
  session: string;
  profile: string;
  name: string;
  address: string | null;
  createRequestId?: string;
  continueAttempted?: boolean;
  orgId: string;
  grantId: string;
  apiBaseUrl: string;
  receiverMode: ReceiverMode;
  contactRequests: boolean;
  startedAt: string;
  phase: "create_attempted" | "setup_attempted";
  invitationHash: string | null;
  ownerAddress: string | null;
};

type EnrollDependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  preflight?: (session: string, receiver: ReceiverMode) => Promise<void>;
  setup?: typeof setupAgent;
  env?: NodeJS.ProcessEnv;
};

export type AgentEnrollOptions = {
  configDir: string;
  session: string;
  name?: string;
  receiverMode?: ReceiverMode;
  contactRequests?: boolean;
  continueSetup?: boolean;
  /** Runs once the saved login and session preflight pass, before any request. */
  beforeCreate?: () => Promise<void>;
  confirmationSleep?: (milliseconds: number) => Promise<void>;
} & EnrollDependencies;

function plainRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function savedEnrollment(value: unknown): Enrollment {
  const row = plainRecord(value);
  const keys = [
    "version",
    "session",
    "profile",
    "name",
    "address",
    "orgId",
    "grantId",
    "apiBaseUrl",
    "receiverMode",
    "contactRequests",
    "startedAt",
    "phase",
    "invitationHash",
    "ownerAddress",
  ];
  if (row?.version === 2) keys.push("createRequestId", "continueAttempted");
  if (
    !row ||
    Object.keys(row).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(row, key)) ||
    (row.version !== 1 && row.version !== 2) ||
    (row.version === 2 &&
      (typeof row.createRequestId !== "string" ||
        !SESSION_UUID.test(row.createRequestId) ||
        typeof row.continueAttempted !== "boolean")) ||
    typeof row.session !== "string" ||
    !SESSION_UUID.test(row.session) ||
    row.profile !== `session-${row.session}` ||
    typeof row.name !== "string" ||
    !validName(row.name) ||
    !(
      (typeof row.address === "string" && validAddress(row.address)) ||
      (row.version === 2 &&
        row.address === null &&
        row.phase === "create_attempted")
    ) ||
    typeof row.orgId !== "string" ||
    !row.orgId ||
    typeof row.grantId !== "string" ||
    !row.grantId ||
    typeof row.apiBaseUrl !== "string" ||
    !RECEIVER_MODES.includes(row.receiverMode as ReceiverMode) ||
    typeof row.contactRequests !== "boolean" ||
    typeof row.startedAt !== "string" ||
    !Number.isFinite(Date.parse(row.startedAt)) ||
    !["create_attempted", "setup_attempted"].includes(String(row.phase)) ||
    (row.phase === "create_attempted" &&
      (row.invitationHash !== null || row.ownerAddress !== null)) ||
    (row.phase === "setup_attempted" &&
      (typeof row.address !== "string" ||
        typeof row.invitationHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.invitationHash) ||
        typeof row.ownerAddress !== "string" ||
        !row.ownerAddress.includes("@")))
  )
    throw refuse(
      "Saved enrollment state is invalid. Preserve its private files.",
    );
  connectedApiBaseUrl(row.apiBaseUrl);
  if (row.ownerAddress !== null) {
    try {
      if (mailAddress(row.ownerAddress) !== row.ownerAddress) throw new Error();
    } catch {
      throw refuse(
        "Saved enrollment owner is invalid. Preserve its private files.",
      );
    }
  }
  return row as Enrollment;
}

function validName(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 80 &&
    value.trim() === value &&
    Array.from(value).every((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
  );
}

function validAddress(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[a-z0-9][a-z0-9-]{0,62}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(value)
  );
}

type ResolvedEnrollment = Enrollment & { address: string };
function resolvedEnrollment(state: Enrollment): ResolvedEnrollment {
  if (!state.address)
    throw refuse(
      "The server has not assigned this session an address yet. Preserve its setup request.",
    );
  return { ...state, address: state.address };
}

async function preflight(
  session: string,
  receiver: ReceiverMode,
  env: NodeJS.ProcessEnv,
): Promise<void> {
  // Poll receiving wakes nothing, so there is no session to probe.
  if (receiver === "poll") return;
  if (receiver === "external") {
    if (env.CLAUDE_CODE_SESSION_ID !== session)
      throw refuse(
        "External receiving requires this exact Claude session ID. No address was created.",
      );
    return;
  }
  assertNativeSessionIdentity(session, env);
  const connection = await connectNativeSession({
    threadId: session,
    expectedCwd: process.cwd(),
    signal: AbortSignal.timeout(10_000),
  });
  connection.close();
}

/** Refuse a different loaded Codex thread before creating an address. */
export function assertNativeSessionIdentity(
  session: string,
  env: { CODEX_THREAD_ID?: string; CODEX_SESSION_ID?: string },
): void {
  if (env.CODEX_THREAD_ID && env.CODEX_THREAD_ID !== session)
    throw refuse(
      "The requested session differs from this Codex thread. No address was created.",
    );
  // Codex can expose a process session ID that differs from the loaded thread.
  if (
    !env.CODEX_THREAD_ID &&
    env.CODEX_SESSION_ID &&
    env.CODEX_SESSION_ID !== session
  )
    throw refuse(
      "The requested session differs from this Codex session. No address was created.",
    );
}

async function managedDomains(
  client: PrimitiveApiClient,
  apiBaseUrl: string,
): Promise<string[]> {
  const response = await listDomains({
    client: client.client,
    responseStyle: "fields",
  });
  const rows = response.data?.data;
  if (response.error || !Array.isArray(rows))
    throw refuse(
      "Could not list the owner's managed domains. No address was created.",
    );
  const suffix =
    apiBaseUrl === "https://api.primitive-staging-1.com/v1"
      ? ".primitive-staging.email"
      : ".primitive.email";
  const domains = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.verified === true &&
            "is_active" in row &&
            row.is_active === true &&
            row.domain.toLowerCase().endsWith(suffix),
        )
        .map((row) => row.domain.toLowerCase())
        .filter((domain) => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])$/.test(domain)),
    ),
  ].sort();
  if (!domains[0])
    throw refuse(
      "This organization has no verified managed domain for agent enrollment.",
    );
  return domains;
}

async function boundedJson(
  response: Response,
  label = "connection creation",
  limit = RESPONSE_LIMIT,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw refuse(`The ${label} response is incomplete.`);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw refuse(`The ${label} response is too large.`);
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw refuse(`The ${label} response is incomplete or invalid.`);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

async function rejectedUnsuitableDomain(response: Response): Promise<boolean> {
  if (response.status !== 400) return false;
  try {
    const envelope = plainRecord(
      await boundedJson(response, "connection rejection"),
    );
    return (
      envelope?.success === false &&
      plainRecord(envelope.error)?.code === "connection_domain_unavailable"
    );
  } catch {
    return false;
  }
}

function invitationFrom(
  value: unknown,
  expected: Enrollment,
  now: number,
): { url: string; hash: string; ownerAddress: string } {
  const envelope = plainRecord(value);
  const data = plainRecord(envelope?.data);
  const connection = plainRecord(data?.connection);
  const invitation = plainRecord(data?.invitation);
  if (
    envelope?.success !== true ||
    connection?.address !== expected.address ||
    typeof connection?.name !== "string" ||
    connection?.status !== "pending" ||
    typeof connection.owner_address !== "string" ||
    typeof invitation?.claim_url !== "string" ||
    typeof invitation.expires_at !== "string" ||
    !Number.isFinite(Date.parse(invitation.expires_at)) ||
    Date.parse(invitation.expires_at) <= now + 30_000
  )
    throw refuse(
      "The connection creation result was incomplete or did not match this session. No invitation was claimed.",
    );
  const parsed = parseAgentInvitation(invitation.claim_url);
  if (parsed.apiBaseUrl !== expected.apiBaseUrl)
    throw refuse(
      "The connection invitation origin differs from the owner's login. No invitation was claimed.",
    );
  let ownerAddress: string;
  try {
    ownerAddress = mailAddress(connection.owner_address);
  } catch {
    throw refuse(
      "The connection owner address was invalid. No invitation was claimed.",
    );
  }
  return {
    url: invitation.claim_url,
    hash: createHash("sha256")
      .update(parsed.apiBaseUrl)
      .update("\0")
      .update(parsed.token)
      .digest("hex"),
    ownerAddress,
  };
}

function policyRuleInputs(
  rules: ReadonlyArray<{ pattern: string; effect: "allow" | "silence" }>,
) {
  return rules
    .map(({ pattern, effect }) => ({ pattern, effect }))
    .sort((left, right) => {
      const a = `${left.pattern}:${left.effect}`;
      const b = `${right.pattern}:${right.effect}`;
      return a < b ? -1 : a > b ? 1 : 0;
    });
}

async function enableAgentContactRequests(options: {
  configDir: string;
  address: string;
  orgId: string;
  grantId: string;
  apiBaseUrl: string;
  fetch?: typeof fetch;
  now?: () => number;
}): Promise<"enabled" | "owner_disabled" | "unavailable"> {
  const saved = loadCliCredentials(options.configDir);
  if (
    !saved ||
    saved.org_id !== options.orgId ||
    saved.oauth_grant_id !== options.grantId ||
    saved.api_base_url !== options.apiBaseUrl
  )
    throw refuse(
      "The saved member login changed before contact requests were enabled. This agent remains connected; sign in to its organization and resume this exact enrollment.",
    );
  const credentials = await refreshStoredCliCredentials({
    apiBaseUrl: options.apiBaseUrl,
    configDir: options.configDir,
    credentials: saved,
    fetch: options.fetch,
    now: options.now,
  });
  if (
    credentials.org_id !== options.orgId ||
    credentials.oauth_grant_id !== options.grantId ||
    credentials.api_base_url !== options.apiBaseUrl
  )
    throw refuse(
      "The saved member login changed before contact requests were enabled. This agent remains connected; sign in to its organization and resume this exact enrollment.",
    );
  const client = new PrimitiveApiClient({
    apiKey: credentials.access_token,
    apiBaseUrl: options.apiBaseUrl,
    fetch: options.fetch,
  });
  async function readPolicy() {
    try {
      const response = await getAgentContactPolicy({
        client: client.client,
        path: { agent_address: options.address },
        signal: AbortSignal.timeout(10_000),
        responseStyle: "fields",
      });
      if (
        response.error ||
        response.data?.success !== true ||
        !response.data.data
      )
        throw new Error();
      return parseAgentContactPolicy(response.data.data, options.address);
    } catch {
      return null;
    }
  }
  const before = await readPolicy();
  if (!before) return "unavailable";
  if (before.agent_policy.allow_contact_requests === false)
    return "owner_disabled";
  const rules = policyRuleInputs(before.agent_policy.rules);
  if (before.agent_policy.allow_contact_requests !== true) {
    try {
      const response = await putAgentContactPolicy({
        client: client.client,
        path: { agent_address: options.address },
        body: {
          rules,
          allow_contact_requests: true,
          ...(before.agent_policy.version
            ? { if_version: before.agent_policy.version }
            : { if_absent: true as const }),
        },
        signal: AbortSignal.timeout(10_000),
        responseStyle: "fields",
      });
      if (
        response.error ||
        response.data?.success !== true ||
        !response.data.data
      )
        throw new Error();
      const updated = parseAgentContactPolicy(
        response.data.data,
        options.address,
      );
      if (
        updated.agent_policy.allow_contact_requests !== true ||
        JSON.stringify(policyRuleInputs(updated.agent_policy.rules)) !==
          JSON.stringify(rules)
      )
        throw new Error();
    } catch {
      return "unavailable";
    }
  }
  const after = await readPolicy();
  if (
    !after ||
    after.agent_policy.allow_contact_requests !== true ||
    after.allow_contact_requests !== true ||
    !after.contact_request_since ||
    !after.contact_request_generation ||
    JSON.stringify(policyRuleInputs(after.agent_policy.rules)) !==
      JSON.stringify(rules)
  )
    return "unavailable";
  return "enabled";
}

type ConnectionConfirmation =
  | "connected"
  | "pending"
  | "revoked"
  | "owner_inactive"
  | "unavailable";

async function readOwnerConnection(
  enrollment: Enrollment,
  params: AgentEnrollOptions,
  deadline: number,
): Promise<ConnectionConfirmation> {
  const saved = loadCliCredentials(params.configDir);
  if (
    !saved ||
    saved.org_id !== enrollment.orgId ||
    saved.oauth_grant_id !== enrollment.grantId ||
    saved.api_base_url !== enrollment.apiBaseUrl
  )
    throw refuse(
      "The saved member login changed before connection confirmation. Preserve this session's profile and resume with the original member login.",
    );
  const credentials = await refreshStoredCliCredentials({
    apiBaseUrl: enrollment.apiBaseUrl,
    configDir: params.configDir,
    credentials: saved,
    fetch: params.fetch,
    now: params.now,
  });
  if (
    credentials.org_id !== enrollment.orgId ||
    credentials.oauth_grant_id !== enrollment.grantId ||
    credentials.api_base_url !== enrollment.apiBaseUrl
  )
    throw refuse(
      "The saved member login changed before connection confirmation. Preserve this session's profile and resume with the original member login.",
    );
  let cursor: string | undefined;
  // This bounded scan confirms small rosters quickly. Missing the row is not
  // proof that server-side challenge verification failed.
  for (let page = 0; page < CONFIRMATION_PAGE_LIMIT; page++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return "unavailable";
    const url = new URL(`${enrollment.apiBaseUrl}/agent-connections`);
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("cursor", cursor);
    let value: unknown;
    try {
      const response = await (params.fetch ?? fetch)(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(Math.min(5_000, remaining)),
        headers: {
          authorization: `Bearer ${credentials.access_token}`,
          accept: "application/json",
        },
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        return "unavailable";
      }
      value = await boundedJson(
        response,
        "connection list",
        CONNECTION_LIST_LIMIT,
      );
    } catch {
      return "unavailable";
    }
    const envelope = plainRecord(value);
    if (envelope?.success !== true || !Array.isArray(envelope.data))
      return "unavailable";
    for (const candidate of envelope.data) {
      const connection = plainRecord(candidate);
      if (connection?.address !== enrollment.address) continue;
      if (
        connection.name !== enrollment.name ||
        connection.owner_address !== enrollment.ownerAddress
      )
        throw refuse(
          "The owner connection list did not match this session's saved identity. Preserve the profile and inspect the connection in the app.",
        );
      if (connection.owner_active === false) return "owner_inactive";
      if (connection.status === "revoked") return "revoked";
      if (
        connection.status === "connected" &&
        typeof connection.verified_at === "string" &&
        Number.isFinite(Date.parse(connection.verified_at))
      )
        return "connected";
      return "pending";
    }
    const next = plainRecord(envelope.meta)?.cursor;
    if (next === null) return "unavailable";
    if (typeof next !== "string" || !SESSION_UUID.test(next) || next === cursor)
      return "unavailable";
    cursor = next;
  }
  return "unavailable";
}

async function confirmOwnerConnection(
  enrollment: Enrollment,
  params: AgentEnrollOptions,
): Promise<ConnectionConfirmation> {
  const deadline = Date.now() + CONFIRMATION_BUDGET_MS;
  let last: ConnectionConfirmation = "unavailable";
  for (let attempt = 0; attempt < CONFIRMATION_MAX_ATTEMPTS; attempt++) {
    last = await readOwnerConnection(enrollment, params, deadline);
    if (last === "connected" || last === "revoked" || last === "owner_inactive")
      return last;
    const remaining = deadline - Date.now();
    if (remaining <= 0 || attempt === CONFIRMATION_MAX_ATTEMPTS - 1) break;
    await (params.confirmationSleep ?? ((milliseconds) => sleep(milliseconds)))(
      Math.min(3_000, remaining),
    );
  }
  return last;
}

/**
 * True when `session-<session>` holds this session's own enrollment, saved
 * state and credential agreeing, so rerunning enroll resumes it rather than
 * adding a second address. Offline and read-only.
 */
export function enrollmentResumes(configDir: string, session: string): boolean {
  const profile = `session-${session}`;
  try {
    const raw = readMailJson(
      join(
        agentProfileDirectory(configDir, profile),
        "enrollment",
        "state.json",
      ),
    );
    if (raw === null) return false;
    const state = savedEnrollment(raw);
    if (state.profile !== profile) return false;
    const existing = loadConnectedAgentProfile(configDir, profile);
    return (
      !existing ||
      (existing.agent_address === state.address &&
        existing.org_id === state.orgId &&
        existing.api_base_url === state.apiBaseUrl &&
        (state.phase !== "setup_attempted" ||
          (existing.invitation_hash === state.invitationHash &&
            existing.owner_address === state.ownerAddress)))
    );
  } catch {
    return false;
  }
}

/** Trusted-machine enrollment using only saved member OAuth and the public API. */
export async function enrollAgent(params: AgentEnrollOptions) {
  if (!SESSION_UUID.test(params.session))
    throw refuse("Enrollment requires the exact current session UUID.");
  let name = params.name ?? "Coding agent";
  if (!validName(name))
    throw refuse(
      "Agent name must be 1-80 characters without control characters.",
    );
  const receiverMode = params.receiverMode ?? "native";
  const contactRequests = Boolean(params.contactRequests);
  const env = params.env ?? process.env;
  if (
    env[AGENT_PROFILE_ENV]?.trim() ||
    env.PRIMITIVE_API_KEY?.trim() ||
    env.PRIMITIVE_KEY?.trim()
  )
    throw refuse(
      "Enrollment requires the saved member OAuth login. Unset agent-profile and API-key environment overrides.",
    );
  const saved = loadCliCredentials(params.configDir);
  if (!saved)
    throw refuse(
      "Sign in with `primitive signin` as a member of this organization first.",
    );
  const apiBaseUrl = connectedApiBaseUrl(saved.api_base_url);
  const profile = `session-${params.session}`;
  const directory = join(
    agentProfileDirectory(params.configDir, profile),
    "enrollment",
  );
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "agent-enrollment");
  try {
    await (
      params.preflight ??
      ((session, receiver) => preflight(session, receiver, env))
    )(params.session, receiverMode);
    // Every local check above has passed; a hook that changes state (such as
    // disconnecting the agent this enrollment replaces) runs only now.
    await params.beforeCreate?.();
    const path = join(directory, "state.json");
    const old = readMailJson(path);
    let state = old === null ? null : savedEnrollment(old);
    if (state && params.name === undefined) name = state.name;
    if (
      state &&
      (state.session !== params.session ||
        state.profile !== profile ||
        state.name !== name ||
        state.orgId !== saved.org_id ||
        state.grantId !== saved.oauth_grant_id ||
        state.apiBaseUrl !== apiBaseUrl ||
        state.receiverMode !== receiverMode ||
        state.contactRequests !== contactRequests)
    )
      throw refuse(
        "This session's enrollment belongs to another owner, address, or setup choice. Nothing was changed.",
      );
    if (
      state &&
      Date.parse(state.startedAt) > (params.now ?? Date.now)() + 60_000
    )
      throw refuse(
        "Saved enrollment time is inconsistent. Preserve its private files.",
      );
    const existing = loadConnectedAgentProfile(params.configDir, profile);
    if (
      existing &&
      (!state ||
        existing.agent_address !== state.address ||
        existing.org_id !== state.orgId ||
        existing.api_base_url !== state.apiBaseUrl ||
        (state.phase === "setup_attempted" &&
          (existing.invitation_hash !== state.invitationHash ||
            existing.owner_address !== state.ownerAddress)))
    )
      throw refuse(
        "This session profile already belongs to another connection. Nothing was changed.",
      );
    const finish = async (
      enrollment: ResolvedEnrollment,
      resume: boolean,
      invitation?: string,
    ) => {
      const setup = await (params.setup ?? setupAgent)({
        configDir: params.configDir,
        profileName: profile,
        session: params.session,
        receiverMode,
        ...(resume ? { resume: true } : { invitation }),
        contactRequests,
        fetch: params.fetch,
      });
      const ownerMemberAddress = await refreshOwnerMemberAddress({
        configDir: params.configDir,
        profileName: profile,
        fetch: params.fetch,
      });
      const identity = { ...setup.identity, ownerMemberAddress };
      const report = ownerReportGuidance(identity);
      const result = { ...setup, identity };
      if (!verificationReplySubmitted(result.verification.state))
        return {
          ...result,
          guidance: `${result.guidance} ${report}`,
          contactRequestPolicy: contactRequests
            ? ("pending_verification" as const)
            : ("not_requested" as const),
          connection: { status: "pending" as const },
        };
      const contactRequestPolicy = contactRequests
        ? await enableAgentContactRequests({
            configDir: params.configDir,
            address: enrollment.address,
            orgId: enrollment.orgId,
            grantId: enrollment.grantId,
            apiBaseUrl: enrollment.apiBaseUrl,
            fetch: params.fetch,
            now: params.now,
          })
        : ("not_requested" as const);
      const listed = await confirmOwnerConnection(enrollment, params);
      // Setup already read a verified connection from the agent's own status.
      // An inconclusive owner-list read must not undo that; only a definite
      // revoked or departed-owner answer overrides it.
      const verifiedBySetup =
        result.verification.state === "verified" &&
        (listed === "pending" || listed === "unavailable");
      const status: ConnectionConfirmation = verifiedBySetup
        ? "connected"
        : listed;
      return {
        ...result,
        ...(status === "owner_inactive"
          ? { receiving: { state: "not_ready" as const } }
          : {}),
        guidance: `${
          verifiedBySetup
            ? "This agent's connection status reports pairing verified. Receiving is separate; configure and verify this session's external hook if external mode was selected."
            : status === "connected"
              ? "The owner connection list confirms pairing. Receiving is separate; configure and verify this session's external hook if external mode was selected."
              : status === "revoked"
                ? "The owner connection list reports this pairing revoked. Stop using this profile and ask the owner to review it."
                : status === "owner_inactive"
                  ? "The original human owner is no longer an active member. This profile must not be treated as receiving; ask an organization manager to review or remove it."
                  : "The challenge reply was submitted, but pairing is not confirmed. Resume this exact enrollment with the same options; do not create another address or resend the reply."
        }${
          // A revoked pairing or a departed owner has no one to report to.
          status === "revoked" || status === "owner_inactive"
            ? ""
            : ` ${report}`
        }`,
        contactRequestPolicy,
        connection: { status },
      };
    };
    if (state?.phase === "setup_attempted") {
      if (!existing)
        throw refuse(
          "The invitation claim may have been consumed. Keep this pending agent and inspect it in the app; do not create or claim another address.",
        );
      return finish(resolvedEnrollment(state), true);
    }
    if (existing)
      throw refuse(
        "This profile is already connected without a matching enrollment. Nothing was changed.",
      );
    if (state?.version === 1)
      throw refuse(
        "Connection creation may already have happened. Inspect this session's pending address in the app and issue a fresh invitation there if needed. Use `primitive agent connect` with that invitation and this session's profile; do not rerun enrollment or create another address.",
      );

    const credentials = await refreshStoredCliCredentials({
      apiBaseUrl,
      configDir: params.configDir,
      credentials: saved,
      fetch: params.fetch,
      now: params.now,
    });
    if (
      credentials.org_id !== saved.org_id ||
      credentials.oauth_grant_id !== saved.oauth_grant_id ||
      credentials.api_base_url !== apiBaseUrl
    )
      throw refuse(
        "The saved member login changed during enrollment. No address was created. Sign in to the intended organization and retry this exact session.",
      );
    const fetchImpl = params.fetch ?? fetch;
    const firstAttempt = state === null;
    if (state?.continueAttempted)
      throw refuse(
        "Continue setup already ran and its result may be uncertain. Inspect the saved agent in the app; do not issue another invitation automatically.",
      );
    if (!state) {
      if (params.continueSetup)
        throw refuse(
          "There is no saved enrollment to continue. Start enrollment normally first.",
        );
      const domains = await managedDomains(
        new PrimitiveApiClient({
          apiKey: credentials.access_token,
          apiBaseUrl,
          fetch: params.fetch,
        }),
        apiBaseUrl,
      );
      if (!domains.length)
        throw refuse("No managed domain is available for enrollment.");
      state = {
        version: 2,
        session: params.session,
        profile,
        name,
        address: null,
        createRequestId: randomUUID(),
        continueAttempted: false,
        orgId: saved.org_id,
        grantId: saved.oauth_grant_id,
        apiBaseUrl,
        receiverMode,
        contactRequests,
        startedAt: new Date((params.now ?? Date.now)()).toISOString(),
        phase: "create_attempted",
        invitationHash: null,
        ownerAddress: null,
      };
      // The request identity must be durable before dispatch. The server owns
      // friendly address allocation; an uncertain response cannot pick another.
      writeMailJson(path, state);
    }
    let payload: unknown;
    try {
      const response = await fetchImpl(`${apiBaseUrl}/agent-connections`, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(25_000),
        headers: {
          authorization: `Bearer ${credentials.access_token}`,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: state.name,
          create_request_id: state.createRequestId,
        }),
      });
      if (await rejectedUnsuitableDomain(response)) {
        if (firstAttempt) unlinkSync(path);
        throw refuse(
          "No verified managed domain is currently sendable for agent enrollment. No address was created by this request.",
        );
      }
      if ([400, 401, 403].includes(response.status)) {
        await response.body?.cancel().catch(() => undefined);
        if (firstAttempt) unlinkSync(path);
        throw refuse(
          "Connection creation was rejected before an address was created. Check the selected organization, managed domain, and member access, then retry this exact session.",
        );
      }
      if (response.status !== 200) {
        const failed = plainRecord(
          await boundedJson(response, "connection recovery"),
        );
        const code = plainRecord(failed?.error)?.code;
        if (code === "connection_removed")
          throw refuse(
            "This saved setup belongs to a removed agent. It cannot create another identity. Review the removed agent in the app.",
          );
        if (code === "connection_create_request_conflict")
          throw refuse(
            "This saved setup belongs to different choices or membership. Preserve its request and inspect the original agent in the app.",
          );
        throw new Error();
      }
      payload = await boundedJson(response);
    } catch (error) {
      if (error instanceof AgentConnectionSetupError) throw error;
      throw refuse(
        "Connection creation has an unknown outcome. Rerun this exact enrollment to recover the same saved request; no second identity or invitation will be created automatically.",
      );
    }
    const envelope = plainRecord(payload);
    const data = plainRecord(envelope?.data);
    const connection = plainRecord(data?.connection);
    if (
      envelope?.success !== true ||
      typeof connection?.address !== "string" ||
      !validAddress(connection.address) ||
      typeof connection.name !== "string" ||
      !validName(connection.name) ||
      !["pending", "claimed", "connected", "revoked"].includes(
        String(connection.status),
      ) ||
      (state.address !== null && state.address !== connection.address)
    )
      throw refuse(
        "The connection result was incomplete or changed the saved identity. Preserve this setup request; no invitation was claimed.",
      );
    state = { ...state, address: connection.address };
    writeMailJson(path, state);
    if (data?.recovered === true) {
      if (data.invitation !== null)
        throw refuse(
          "Recovered setup unexpectedly included an invitation. Preserve the saved identity; no invitation was claimed.",
        );
      if (connection.status !== "pending")
        throw refuse(
          "The saved agent is already claimed, connected or disconnected. Its credential was not changed. Inspect it in the app; do not automatically reconnect it.",
        );
      if (!params.continueSetup)
        throw refuse(
          `Recovered ${state.address}. Run this exact command with --continue-setup to explicitly obtain one pending-only invitation.`,
        );
      state = { ...state, continueAttempted: true };
      writeMailJson(path, state);
      try {
        const response = await fetchImpl(
          `${apiBaseUrl}/agent-connections/${encodeURIComponent(connection.address)}/invitation`,
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(25_000),
            headers: {
              authorization: `Bearer ${credentials.access_token}`,
              "content-type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify({ pending_only: true }),
          },
        );
        if (response.status !== 200) {
          const rejected = plainRecord(
            await boundedJson(response, "pending setup continuation"),
          );
          if (
            plainRecord(rejected?.error)?.code === "connection_already_claimed"
          )
            throw refuse(
              "This agent was claimed before Continue setup. Its credential was not changed. Inspect it in the app.",
            );
          throw new Error();
        }
        payload = await boundedJson(response);
      } catch (error) {
        if (error instanceof AgentConnectionSetupError) throw error;
        throw refuse(
          "Continue setup has an uncertain outcome. Inspect the saved agent in the app; do not repeat it and invalidate another invitation.",
        );
      }
    }
    const invitation = invitationFrom(
      payload,
      state,
      (params.now ?? Date.now)(),
    );
    state = {
      ...state,
      phase: "setup_attempted",
      invitationHash: invitation.hash,
      ownerAddress: invitation.ownerAddress,
    };
    writeMailJson(path, state);
    return finish(resolvedEnrollment(state), false, invitation.url);
  } finally {
    release();
  }
}
