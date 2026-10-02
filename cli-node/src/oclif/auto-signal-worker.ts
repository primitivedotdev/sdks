import { homedir } from "node:os";
import { join } from "node:path";
import {
  getSentEmail,
  type PrimitiveApiClient,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "./api-client.js";
import {
  AUTO_SIGNAL_EMAIL_ENV,
  AUTO_SIGNAL_KIND_ENV,
  AUTO_WORKING_CAP_MS,
  AUTO_WORKING_EXPIRES_SECONDS,
  AUTO_WORKING_RENEW_MS,
  type AutoWorkingLease,
  autoSignalsDisabled,
  clearWorkingSending,
  markWorkingSending,
  readAutoClaim,
  readWorkingLease,
  recordRenewer,
  stopWorkingLease,
  writeWorkingLease,
} from "./auto-signals.js";
import type { ConnectedAgentIdentity } from "./connected-agent-profile.js";
import { acquireListenLock } from "./listen-state.js";
import { sendSignal } from "./signal-command.js";
import { readThreadContext } from "./wake-context.js";

type Env = Record<string, string | undefined>;
type SignalContext = {
  apiClient: PrimitiveApiClient;
  apiKey?: string;
  configDir: string;
  identity: ConnectedAgentIdentity;
};
export type AutoSignalWorkerDeps = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  context?: (configDir: string, profile: string) => Promise<SignalContext>;
  send?: typeof sendSignal;
  answered?: (
    context: SignalContext,
    lease: AutoWorkingLease,
    ownSignals: Set<string>,
  ) => Promise<boolean>;
  /** Called after each release of the renewer lock (tests use it). */
  released?: () => void;
};

function configDirectory(env: Env): string {
  if (env.PRIMITIVE_CONFIG_DIR) return env.PRIMITIVE_CONFIG_DIR;
  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "primitive");
}

async function defaultContext(
  configDir: string,
  profile: string,
): Promise<SignalContext> {
  const { apiClient, auth } = await createAuthenticatedCliApiClient({
    configDir,
  });
  if (!auth.connectedAgent || auth.connectedAgent.profileName !== profile)
    throw new Error("The automatic signal profile is unavailable.");
  return {
    apiClient,
    apiKey: auth.apiKey,
    configDir,
    identity: auth.connectedAgent,
  };
}

const INTERACTION_PART = "interaction.json";

/**
 * Whether the agent has sent a plain answer in the lease's thread since
 * working started. Outbound signals and interactions (including this
 * worker's own renewals) are not answers. Unknown state reads as unanswered,
 * so the cap and local stops still bound renewal.
 */
async function defaultAnswered(
  context: SignalContext,
  lease: AutoWorkingLease,
  ownSignals: Set<string>,
): Promise<boolean> {
  if (!lease.thread_id) return false;
  const signal = AbortSignal.timeout(10_000);
  const thread = await readThreadContext(
    context.apiClient.client,
    lease.thread_id,
    undefined,
    signal,
  );
  if (!thread) return false;
  for (const message of thread.messages) {
    if (message.direction !== "outbound" || ownSignals.has(message.id))
      continue;
    const at = Date.parse(message.timestamp ?? "");
    if (!Number.isFinite(at) || at < lease.started_at - 5_000) continue;
    const sent = await getSentEmail({
      client: context.apiClient.client,
      path: { id: message.id },
      signal,
      responseStyle: "fields",
    });
    const detail = sent.data?.data;
    if (sent.error || !detail) continue;
    if (
      (detail.attachments ?? []).some(
        (part) => part.filename?.toLowerCase() === INTERACTION_PART,
      )
    ) {
      ownSignals.add(message.id);
      continue;
    }
    if (detail.to_address?.trim().toLowerCase() === lease.sender) return true;
  }
  return false;
}

/**
 * Detached worker entry. `read` sends one read signal; `working` holds the
 * per-email renewer lock and keeps working fresh until the agent answers, a
 * local reply or decline stops it, or the cap passes. Never throws.
 */
export async function runAutoSignalWorker(
  env: Env = process.env,
  deps: AutoSignalWorkerDeps = {},
): Promise<void> {
  const now = deps.now ?? Date.now;
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const send = deps.send ?? sendSignal;
  const answered = deps.answered ?? defaultAnswered;
  try {
    if (autoSignalsDisabled(env)) return;
    const configDir = configDirectory(env);
    const emailId = env[AUTO_SIGNAL_EMAIL_ENV] ?? "";
    const kind = env[AUTO_SIGNAL_KIND_ENV];
    const claim = readAutoClaim(configDir, emailId);
    if (!claim || env.PRIMITIVE_AGENT_PROFILE !== claim.profile) return;
    const context = await (deps.context ?? defaultContext)(
      configDir,
      claim.profile,
    );
    if (kind === "read") {
      await send(context, { id: claim.email_id, kind: "read" });
      return;
    }
    if (kind !== "working") return;
    const ownSignals = new Set<string>();
    const renew = async (): Promise<void> => {
      for (;;) {
        const lease = readWorkingLease(configDir, claim.email_id);
        if (!lease || lease.stopped_at !== null) return;
        for (const id of lease.signal_sent_ids) ownSignals.add(id);
        recordRenewer(configDir, claim.email_id);
        const elapsed = now() - lease.started_at;
        if (elapsed >= AUTO_WORKING_CAP_MS) {
          stopWorkingLease(configDir, claim.email_id, "cap", now);
          return;
        }
        if (autoSignalsDisabled(env)) return;
        let done = false;
        try {
          done = await answered(context, lease, ownSignals);
        } catch {
          done = false;
        }
        if (done) {
          stopWorkingLease(configDir, claim.email_id, "answered", now);
          return;
        }
        const active = () => {
          const current = readWorkingLease(configDir, claim.email_id);
          return Boolean(current && current.stopped_at === null);
        };
        // Each renewal window is one durable intent, so a restarted worker
        // in the same window reconciles instead of sending a duplicate.
        const slot = Math.floor(elapsed / AUTO_WORKING_RENEW_MS);
        markWorkingSending(configDir, claim.email_id);
        let outcome: unknown;
        let sentId: string | null = null;
        try {
          if (!active()) return;
          const result = await send(context, {
            id: claim.email_id,
            kind: "working",
            expiresIn: AUTO_WORKING_EXPIRES_SECONDS,
            slot: `auto-working-${slot}`,
            shouldSend: active,
          });
          outcome = result.data.outcome;
          sentId =
            typeof result.data.sent_id === "string"
              ? result.data.sent_id
              : null;
        } catch {
          outcome = "failed";
        } finally {
          clearWorkingSending(configDir, claim.email_id);
        }
        if (sentId) {
          ownSignals.add(sentId);
          const current = readWorkingLease(configDir, claim.email_id);
          if (
            current &&
            current.stopped_at === null &&
            !current.signal_sent_ids.includes(sentId)
          )
            writeWorkingLease(configDir, {
              ...current,
              signal_sent_ids: [...current.signal_sent_ids, sentId].slice(-200),
            });
        }
        // A refused parent will be refused again; stop rather than retry.
        if (outcome === "not_sent") {
          stopWorkingLease(configDir, claim.email_id, "not_sent", now);
          return;
        }
        const next = lease.started_at + (slot + 1) * AUTO_WORKING_RENEW_MS;
        while (now() < next) {
          if (!active()) return;
          await sleep(Math.min(1_000, next - now()));
        }
      }
    };
    // A refused answer can restore the lease just after this renewer saw it
    // stopped. A replacement started then would find the lock still held and
    // exit, so a renewer re-checks after releasing and carries on instead.
    for (let round = 0; round < 10; round++) {
      let release: () => void;
      try {
        release = acquireListenLock(
          join(configDir, "auto-signals", claim.email_id),
          "auto-signal-working",
        );
      } catch {
        return; // Another renewer owns this email.
      }
      try {
        await renew();
      } finally {
        release();
      }
      deps.released?.();
      if (autoSignalsDisabled(env)) return;
      const lease = readWorkingLease(configDir, claim.email_id);
      if (!lease || lease.stopped_at !== null) return;
      if (now() - lease.started_at >= AUTO_WORKING_CAP_MS) return;
    }
  } catch {
    /* Automatic signals are best effort. */
  }
}
