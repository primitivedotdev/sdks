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
import { connectAgent, parseAgentInvitation } from "./agent-connect.js";
import { readSetupApi, type SetupReadBudget } from "./agent-setup-read.js";
import {
  AGENT_PROFILE_ENV,
  AgentConnectionSetupError,
  agentProfileDirectory,
  agentProfileName,
  type ConnectedAgentIdentity,
  type ConnectedAgentProfile,
  connectedAgentIdentity,
  loadConnectedAgentProfile,
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
  writeMailJson,
} from "./shared-mail-files.js";

const SUBJECT = "Connect your agent to Primitive";
const MARKER =
  /\bprimitive-connection:([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}):([1-9]\d*)\b/g;
const fail = (message: string) => new AgentConnectionSetupError(message);
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
  session: string;
  receiverMode?: "native" | "external";
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
      !["native", "external"].includes(String(row.receiverMode))) ||
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
    session: mailId(row.session),
    receiverMode: (row.receiverMode ?? "native") as "native" | "external",
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

function defaults(): AgentSetupDependencies {
  return {
    now: Date.now,
    sleep: async (ms) => {
      await delay(ms);
    },
    async preflight(session) {
      const connection = await connectNativeSession({
        threadId: session,
        expectedCwd: process.cwd(),
        signal: AbortSignal.timeout(10_000),
      });
      connection.close();
    },
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

/** One resumable operation owns setup plumbing; it never stores or replays the invitation. */
export async function setupAgent(params: {
  configDir: string;
  profileName: string;
  session: string;
  receiverMode?: "native" | "external";
  invitation?: string;
  resume?: boolean;
  contactRequests?: boolean;
  timeoutMs?: number;
  fetch?: typeof fetch;
  dependencies?: Partial<AgentSetupDependencies>;
}) {
  const profileName = agentProfileName(params.profileName);
  if (!SESSION_UUID.test(params.session))
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
  const dependencies = { ...defaults(), ...params.dependencies };
  if ((params.receiverMode ?? "native") === "native") {
    try {
      await dependencies.preflight(params.session);
    } catch {
      throw fail(
        "This exact session is not available for native receiving. No invitation was claimed. Open a supported session and retry setup.",
      );
    }
  }
  const directory = agentProfileDirectory(params.configDir, profileName);
  privateMailDirectory(directory, true);
  const release = acquireListenLock(directory, "setup");
  try {
    const path = join(directory, "setup.json");
    const value = readMailJson(path);
    let state = value === null ? null : parseState(value);
    if (
      state &&
      (state.session !== params.session ||
        state.receiverMode !== (params.receiverMode ?? "native") ||
        state.contactRequests !== Boolean(params.contactRequests))
    )
      throw fail(
        "This profile is already bound to a different setup configuration. Its session and notification preferences were not changed.",
      );
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
          "This setup belongs to another invitation. Use a separate profile.",
        );
      if (!state) {
        // Challenges precede claiming. A single recent authenticated challenge is
        // required; public claims do not expose a challenge ID or generation.
        state = {
          version: 1,
          session: params.session,
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
      await connectAgent({
        configDir: params.configDir,
        profileName,
        invitation: params.invitation ?? "",
        fetch: params.fetch,
      });
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
      signal: readBudget.signal,
      readBudget,
    };
    const result = (receiving: string, ownerNotifications?: string) => ({
      identity: context.identity,
      sessionId: params.session,
      verification: {
        state:
          state?.phase === "sent"
            ? ["agent_failed", "gate_denied", "bounced", "canceled"].includes(
                state.receipt?.status ?? "",
              )
              ? "reply_failed"
              : ["unknown", "wait_timeout"].includes(
                    state.receipt?.status ?? "",
                  )
                ? "delivery_unknown"
                : "reply_submitted"
            : state?.phase === "sending"
              ? "send_unknown"
              : "challenge_pending",
        ...(state?.receipt
          ? { sentId: state.receipt.id, deliveryStatus: state.receipt.status }
          : {}),
      },
      receiving: { state: receiving },
      ...(ownerNotifications ? { ownerNotifications } : {}),
      resumeCommand: `primitive agent connect --profile ${profileName} --session ${params.session}${state?.receiverMode === "external" ? " --receiver external" : ""} --resume${state?.contactRequests ? " --contact-requests" : ""} --json`,
      guidance:
        "Reply submission is not proof of delivery or app verification. Receiving health is reported separately. Keep this profile for all mail commands.",
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
    if (state.receiverMode !== "external") {
      try {
        healthy = await dependencies.startListener(
          profileName,
          params.session,
          state.contactRequests,
          params.configDir,
        );
      } catch {
        /* Saved setup resumes without claiming or sending again. */
      }
    }
    return result(
      state.receiverMode === "external"
        ? "external_setup_required"
        : healthy
          ? "healthy"
          : "not_ready",
      ownerNotifications,
    );
  } finally {
    release();
  }
}
