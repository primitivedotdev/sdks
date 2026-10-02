import { type SpawnOptions, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { isPlainChatReply, scopedChatSenderTrust } from "./scoped-chat.js";
import {
  mailAddress,
  mailId,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

/**
 * Automatic communication signals. When mail from the verified owner or a
 * verified same-organization peer is surfaced to an agent session, the CLI
 * reports `read` once; when the session opens it with `emails get --brief`, the
 * CLI reports `working` and renews it until the agent answers. Every step is
 * best effort: nothing here may block, delay or fail the wake or the read.
 */
export const AUTO_SIGNALS_OPT_OUT_ENV = "PRIMITIVE_NO_AUTO_SIGNALS";
export const AUTO_SIGNAL_WORKER_ENV = "PRIMITIVE_AUTO_SIGNAL_WORKER";
export const AUTO_SIGNAL_EMAIL_ENV = "PRIMITIVE_AUTO_SIGNAL_EMAIL";
export const AUTO_SIGNAL_KIND_ENV = "PRIMITIVE_AUTO_SIGNAL_KIND";
/**
 * Receivers accept a working signal only when it expires at most 60 seconds
 * after the server accepted it. A little under 60 tolerates clock skew.
 */
export const AUTO_WORKING_EXPIRES_SECONDS = 55;
/** Renew well before expiry so the indicator does not flicker off. */
export const AUTO_WORKING_RENEW_MS = 40_000;
/** Stop renewing after this long even if no answer was seen. */
export const AUTO_WORKING_CAP_MS = 15 * 60_000;
/**
 * A renewal in flight is never older than this: the signal send and its
 * reconciliation each abort after 5 seconds. Past it the marker is stale.
 */
const SENDING_STALE_MS = 15_000;

export type AutoSignalKind = "read" | "working";
export type AutoSignalAdmission = {
  kind: "allowed" | "request" | "response";
  source?: "network";
};
export type AutoSignalClaim = {
  version: 1;
  email_id: string;
  profile: string;
  sender: string;
  thread_id: string | null;
  claimed_at: string;
};
export type AutoWorkingLease = {
  version: 1;
  email_id: string;
  profile: string;
  sender: string;
  thread_id: string | null;
  started_at: number;
  stopped_at: number | null;
  stop_reason: string | null;
  signal_sent_ids: string[];
};

export function autoSignalsDisabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const value = env[AUTO_SIGNALS_OPT_OUT_ENV]?.trim().toLowerCase();
  return (
    value !== undefined &&
    value !== "" &&
    value !== "0" &&
    value !== "false" &&
    value !== "no"
  );
}

const profilePattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/;
const lower = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/**
 * Whether one admitted email may carry automatic signals. The sender must be
 * authenticated (aligned DMARC) and either be this agent's pinned owner or
 * have been admitted by the organization network policy (an active member or
 * a same-organization agent). The email must be a fully parsed plain email
 * addressed only to this agent, which did not send it. Signals, fyi
 * acknowledgements, interactions, presence checks, contact requests and
 * unverified or external senders never qualify.
 */
export function autoSignalEligible(
  detail: EmailDetail,
  identity: { agentAddress: string; ownerAddress?: string | null },
  admission: AutoSignalAdmission | null | undefined,
): boolean {
  try {
    if (!admission || admission.kind === "request") return false;
    const agent = lower(identity.agentAddress);
    const owner = lower(identity.ownerAddress);
    const sender = lower(detail.from_email);
    if (!agent || !sender || sender === agent) return false;
    if (admission.source !== "network" && !(owner && sender === owner))
      return false;
    if (!scopedChatSenderTrust(detail, sender).trusted) return false;
    if (lower(detail.recipient) !== agent || lower(detail.to_email) !== agent)
      return false;
    if (!["accepted", "completed"].includes(detail.status)) return false;
    if (!detail.message_id) return false;
    const parsed = detail.parsed;
    // Receivers verify a signal only for a parent with exactly one recipient.
    const to = parsed?.to_addresses;
    if (
      !Array.isArray(to) ||
      to.length !== 1 ||
      lower(to[0]?.address) !== agent ||
      (parsed.cc?.length ?? 0) > 0 ||
      (parsed.bcc?.length ?? 0) > 0
    )
      return false;
    return isPlainChatReply(detail);
  } catch {
    return false;
  }
}

function sentSignalPath(configDir: string, sentId: string): string {
  return join(configDir, "signals", "sent-ids", mailId(sentId));
}

/**
 * Remember a signal this profile sent. An automated responder that answers
 * a signal with plain mail must not trigger another automatic signal, or the
 * two would acknowledge each other forever. Never throws.
 */
export function recordSentSignal(configDir: string, sentId: string): void {
  try {
    const path = sentSignalPath(configDir, sentId);
    privateMailDirectory(join(configDir, "signals", "sent-ids"), true);
    writeFileSync(path, "", { flag: "w", mode: 0o600 });
  } catch {
    /* Best effort. */
  }
}

export function isSentSignal(
  configDir: string,
  sentId: string | null | undefined,
): boolean {
  try {
    return (
      Boolean(sentId) && existsSync(sentSignalPath(configDir, sentId ?? ""))
    );
  } catch {
    return false;
  }
}

function root(configDir: string): string {
  return join(configDir, "auto-signals");
}
function emailDirectory(configDir: string, emailId: string): string {
  return join(root(configDir), mailId(emailId));
}

function parseClaim(value: unknown): AutoSignalClaim | null {
  const row = value as Partial<AutoSignalClaim> | null;
  if (
    !row ||
    row.version !== 1 ||
    typeof row.profile !== "string" ||
    !profilePattern.test(row.profile) ||
    (row.thread_id !== null && typeof row.thread_id !== "string")
  )
    return null;
  try {
    return {
      version: 1,
      email_id: mailId(row.email_id),
      profile: row.profile,
      sender: mailAddress(row.sender),
      thread_id: row.thread_id === null ? null : mailId(row.thread_id),
      claimed_at: String(row.claimed_at),
    };
  } catch {
    return null;
  }
}

/**
 * Record, once per email, that a session surfaced it and it qualified for
 * automatic signals. Returns true only for the first caller, so repeated wakes,
 * redeliveries and concurrent receivers dispatch at most one `read`.
 */
export function claimAutoRead(
  configDir: string,
  claim: {
    emailId: string;
    profileName: string;
    sender: string;
    threadId: string | null | undefined;
  },
  now: () => number = Date.now,
): boolean {
  if (!profilePattern.test(claim.profileName)) return false;
  const directory = emailDirectory(configDir, claim.emailId);
  privateMailDirectory(directory, true);
  const value: AutoSignalClaim = {
    version: 1,
    email_id: mailId(claim.emailId),
    profile: claim.profileName,
    sender: mailAddress(claim.sender),
    thread_id: claim.threadId ? mailId(claim.threadId) : null,
    claimed_at: new Date(now()).toISOString(),
  };
  try {
    writeFileSync(join(directory, "read.json"), `${JSON.stringify(value)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
    throw error;
  }
}

export function readAutoClaim(
  configDir: string,
  emailId: string,
): AutoSignalClaim | null {
  try {
    const claim = parseClaim(
      readMailJson(join(emailDirectory(configDir, emailId), "read.json")),
    );
    return claim && claim.email_id === mailId(emailId) ? claim : null;
  } catch {
    return null;
  }
}

function leasePath(configDir: string, emailId: string): string {
  return join(emailDirectory(configDir, emailId), "working.json");
}
/**
 * The stop lives in its own exclusively created file, so a renewer that
 * rewrites working.json with new signal IDs can never undo it.
 */
function stopPath(configDir: string, emailId: string): string {
  return join(emailDirectory(configDir, emailId), "stopped.json");
}
/**
 * Index of active leases, so the startup backstop and peer matching read only
 * live leases instead of every email that was ever acknowledged.
 */
function activeIndex(configDir: string): string {
  return join(root(configDir), "active");
}
function markActive(configDir: string, emailId: string): void {
  privateMailDirectory(activeIndex(configDir), true);
  writeFileSync(join(activeIndex(configDir), mailId(emailId)), "", {
    mode: 0o600,
  });
}
function unmarkActive(configDir: string, emailId: string): void {
  try {
    unlinkSync(join(activeIndex(configDir), mailId(emailId)));
  } catch {
    /* Already gone. */
  }
}
type StopRecord = { at: number; reason: string; token: string };
function readStop(configDir: string, emailId: string): StopRecord | null {
  try {
    const row = readMailJson(
      stopPath(configDir, emailId),
      4096,
    ) as Partial<StopRecord> | null;
    if (!row || typeof row.at !== "number") return null;
    return {
      at: row.at,
      reason: typeof row.reason === "string" ? row.reason : "stopped",
      token: typeof row.token === "string" ? row.token : "",
    };
  } catch {
    return null;
  }
}

export function readWorkingLease(
  configDir: string,
  emailId: string,
): AutoWorkingLease | null {
  try {
    const row = readMailJson(
      leasePath(configDir, emailId),
      64 * 1024,
    ) as Partial<AutoWorkingLease> | null;
    if (
      !row ||
      row.version !== 1 ||
      typeof row.profile !== "string" ||
      !profilePattern.test(row.profile) ||
      typeof row.started_at !== "number" ||
      !Number.isFinite(row.started_at) ||
      (row.stopped_at !== null && typeof row.stopped_at !== "number") ||
      !Array.isArray(row.signal_sent_ids)
    )
      return null;
    const stop = readStop(configDir, emailId);
    return {
      version: 1,
      email_id: mailId(row.email_id),
      profile: row.profile,
      sender: mailAddress(row.sender),
      thread_id: row.thread_id ? mailId(row.thread_id) : null,
      started_at: row.started_at,
      stopped_at: stop?.at ?? row.stopped_at,
      stop_reason:
        stop?.reason ??
        (typeof row.stop_reason === "string" ? row.stop_reason : null),
      signal_sent_ids: row.signal_sent_ids.slice(-200).map(mailId),
    };
  } catch {
    return null;
  }
}

export function writeWorkingLease(
  configDir: string,
  lease: AutoWorkingLease,
): void {
  // Stop state is owned by stopped.json; never write it here.
  writeMailJson(leasePath(configDir, lease.email_id), {
    ...lease,
    stopped_at: null,
    stop_reason: null,
  });
}

/**
 * Start the working lease for an email that already qualified for automatic
 * signals. Only the first caller succeeds, so working is started once per
 * email however many times the session reads it.
 */
export function startWorkingLease(
  configDir: string,
  emailId: string,
  now: () => number = Date.now,
): AutoWorkingLease | null {
  const claim = readAutoClaim(configDir, emailId);
  if (!claim) return null;
  const lease: AutoWorkingLease = {
    version: 1,
    email_id: claim.email_id,
    profile: claim.profile,
    sender: claim.sender,
    thread_id: claim.thread_id,
    started_at: now(),
    stopped_at: null,
    stop_reason: null,
    signal_sent_ids: [],
  };
  try {
    writeFileSync(leasePath(configDir, emailId), `${JSON.stringify(lease)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  } catch {
    return null;
  }
  try {
    markActive(configDir, emailId);
  } catch {
    /* The cap still bounds a lease the backstop cannot see. */
  }
  return lease;
}

/**
 * Stop a lease. Returns a token that only the stop it created can use to
 * restore the lease, or null when it was already stopped or absent.
 */
export function stopWorkingLease(
  configDir: string,
  emailId: string,
  reason: string,
  now: () => number = Date.now,
): string | null {
  const lease = readWorkingLease(configDir, emailId);
  if (!lease || lease.stopped_at !== null) {
    if (lease) unmarkActive(configDir, emailId);
    return null;
  }
  const token = randomUUID();
  try {
    writeFileSync(
      stopPath(configDir, emailId),
      `${JSON.stringify({ at: now(), reason, token })}\n`,
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      unmarkActive(configDir, emailId);
      return null;
    }
    throw error;
  }
  unmarkActive(configDir, emailId);
  return token;
}

/**
 * Undo a stop this process made, for an answer known not to have been sent.
 * A stop made by anyone else (cap, answered, another reply) is left alone.
 */
export function restoreWorkingLease(
  configDir: string,
  emailId: string,
  token: string,
): boolean {
  try {
    const stop = readStop(configDir, emailId);
    if (!stop || stop.token !== token) return false;
    markActive(configDir, emailId);
    unlinkSync(stopPath(configDir, emailId));
    return true;
  } catch {
    return false;
  }
}

function sendingPath(configDir: string, emailId: string): string {
  return join(emailDirectory(configDir, emailId), "sending");
}

/** Mark a renewal in flight so a reply can wait for it to settle. */
export function markWorkingSending(configDir: string, emailId: string): void {
  writeFileSync(
    sendingPath(configDir, emailId),
    JSON.stringify({ pid: process.pid, at: Date.now() }),
    { mode: 0o600 },
  );
}
export function clearWorkingSending(configDir: string, emailId: string): void {
  try {
    unlinkSync(sendingPath(configDir, emailId));
  } catch {
    /* Already settled. */
  }
}
function sendingInFlight(configDir: string, emailId: string): boolean {
  try {
    const value = JSON.parse(
      readFileSync(sendingPath(configDir, emailId), "utf8"),
    ) as { pid?: unknown; at?: unknown };
    if (
      typeof value.at !== "number" ||
      Date.now() - value.at > SENDING_STALE_MS
    )
      return false;
    if (typeof value.pid === "number") process.kill(value.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Active, unstopped leases in this config directory, read from the active
 * index. Index entries for stopped or capped leases are pruned on the way.
 */
export function activeWorkingLeases(
  configDir: string,
  now: () => number = Date.now,
): AutoWorkingLease[] {
  let entries: string[];
  try {
    entries = readdirSync(activeIndex(configDir));
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(entry)) return [];
    const lease = readWorkingLease(configDir, entry);
    if (
      !lease ||
      lease.stopped_at !== null ||
      now() - lease.started_at >= AUTO_WORKING_CAP_MS * 2
    ) {
      unmarkActive(configDir, entry);
      return [];
    }
    return [lease];
  });
}

/** Stops made by one answer, so they can be undone if it is not sent. */
export type HaltedAutoWorking = {
  configDir: string;
  stops: { emailId: string; token: string }[];
};

/**
 * Stop automatic working for the emails an outgoing message answers, before
 * that message is sent, then wait for any renewal already in flight to land
 * first. A renewal that reached receivers after the answer would show the
 * agent as working again. The wait ends when the renewal settles, which is
 * normally immediate and is bounded by the send timeouts. Never throws.
 */
export async function haltAutoWorking(
  configDir: string,
  match: { emailIds?: string[]; peers?: string[]; profileName?: string },
  reason: string,
  options: { settleMs?: number } = {},
): Promise<HaltedAutoWorking> {
  const halted: HaltedAutoWorking = { configDir, stops: [] };
  try {
    const ids = new Set<string>();
    for (const id of match.emailIds ?? []) {
      try {
        ids.add(mailId(id));
      } catch {
        /* Not an email id; nothing to stop. */
      }
    }
    const peers = new Set((match.peers ?? []).map(lower).filter(Boolean));
    const candidates = new Map<string, AutoWorkingLease>();
    for (const lease of activeWorkingLeases(configDir))
      candidates.set(lease.email_id, lease);
    // Named emails are checked directly, not only through the index.
    for (const id of ids) {
      const lease = readWorkingLease(configDir, id);
      if (lease && lease.stopped_at === null) candidates.set(id, lease);
    }
    const stopped: string[] = [];
    for (const lease of candidates.values()) {
      const byPeer =
        peers.has(lease.sender) &&
        (match.profileName === undefined ||
          match.profileName === lease.profile);
      if (!ids.has(lease.email_id) && !byPeer) continue;
      try {
        const token = stopWorkingLease(configDir, lease.email_id, reason);
        if (token) halted.stops.push({ emailId: lease.email_id, token });
        stopped.push(lease.email_id);
      } catch {
        /* A lease that cannot be written still hits its cap. */
      }
    }
    const deadline = Date.now() + (options.settleMs ?? SENDING_STALE_MS);
    while (
      stopped.some((id) => sendingInFlight(configDir, id)) &&
      Date.now() < deadline
    )
      await new Promise((resolve) => setTimeout(resolve, 50));
  } catch {
    /* Signals are best effort and never block an answer. */
  }
  return halted;
}

/**
 * The answer was definitively refused, so nothing reached the sender: put
 * back the working indication this answer stopped. Never throws.
 */
export function restoreAutoWorking(
  halted: HaltedAutoWorking,
  options: {
    env?: Record<string, string | undefined>;
    spawnImpl?: SpawnLike;
  } = {},
): number {
  try {
    let restored = 0;
    for (const stop of halted.stops)
      if (restoreWorkingLease(halted.configDir, stop.emailId, stop.token))
        restored++;
    if (restored > 0) resumeAutoWorking(halted.configDir, options);
    return restored;
  } catch {
    return 0;
  }
}

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => { unref(): void; on(event: "error", listener: () => void): unknown };

/** The CLI entrypoint that runs a detached signal worker. */
export function autoSignalEntrypoint(): string {
  // Source sits in src/oclif; the bundle may place this code in dist/oclif
  // or in a shared chunk directly under dist.
  const candidates = ["../../bin/run.js", "../bin/run.js"].map((path) =>
    fileURLToPath(new URL(path, import.meta.url)),
  );
  return candidates.find((path) => existsSync(path)) ?? candidates[0] ?? "";
}

/**
 * Run one automatic signal in a detached process with no inherited stdio, so
 * the calling command's output, exit status and timing are unchanged.
 */
export function spawnAutoSignalWorker(options: {
  configDir: string;
  emailId: string;
  kind: AutoSignalKind;
  profileName: string;
  env?: Record<string, string | undefined>;
  entry?: string;
  spawnImpl?: SpawnLike;
}): boolean {
  try {
    const env = { ...(options.env ?? process.env) };
    if (autoSignalsDisabled(env)) return false;
    if (!profilePattern.test(options.profileName)) return false;
    const entry = options.entry ?? autoSignalEntrypoint();
    if (!options.spawnImpl && !existsSync(entry)) return false;
    delete env.PRIMITIVE_API_KEY;
    delete env.PRIMITIVE_KEY;
    const child = (options.spawnImpl ?? spawn)(process.execPath, [entry], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: {
        ...env,
        PRIMITIVE_CONFIG_DIR: options.configDir,
        PRIMITIVE_AGENT_PROFILE: options.profileName,
        PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
        [AUTO_SIGNAL_WORKER_ENV]: "1",
        [AUTO_SIGNAL_EMAIL_ENV]: mailId(options.emailId),
        [AUTO_SIGNAL_KIND_ENV]: options.kind,
      },
    });
    child.on("error", () => undefined);
    child.unref();
    return true;
  } catch {
    return false;
  }
}

/**
 * Called when a receiver surfaces mail to a session: claim the email once and
 * send `read` in the background. Never throws and never writes output.
 */
export function dispatchAutoRead(options: {
  configDir: string;
  emailId: string;
  profileName: string | undefined;
  sender: string;
  threadId: string | null | undefined;
  /** The sent email this one answers, when the API reports it. */
  replyToSentEmailId?: string | null;
  env?: Record<string, string | undefined>;
  spawnImpl?: SpawnLike;
}): boolean {
  try {
    const env = options.env ?? process.env;
    if (autoSignalsDisabled(env) || !options.profileName) return false;
    // A plain answer to one of this profile's signals is never acknowledged.
    if (isSentSignal(options.configDir, options.replyToSentEmailId))
      return false;
    if (
      !claimAutoRead(options.configDir, {
        emailId: options.emailId,
        profileName: options.profileName,
        sender: options.sender,
        threadId: options.threadId,
      })
    )
      return false;
    return spawnAutoSignalWorker({
      configDir: options.configDir,
      emailId: options.emailId,
      kind: "read",
      profileName: options.profileName,
      env,
      spawnImpl: options.spawnImpl,
    });
  } catch {
    return false;
  }
}

/**
 * Called after the session reads an email with `emails get --brief`: start
 * working once for mail that already qualified for automatic signals.
 */
export function dispatchAutoWorking(options: {
  configDir: string;
  emailId: string;
  env?: Record<string, string | undefined>;
  spawnImpl?: SpawnLike;
}): boolean {
  try {
    const env = options.env ?? process.env;
    if (autoSignalsDisabled(env)) return false;
    const lease = startWorkingLease(options.configDir, options.emailId);
    if (!lease) return false;
    return spawnAutoSignalWorker({
      configDir: options.configDir,
      emailId: lease.email_id,
      kind: "working",
      profileName: lease.profile,
      env,
      spawnImpl: options.spawnImpl,
    });
  } catch {
    return false;
  }
}

function renewerPath(configDir: string, emailId: string): string {
  return join(emailDirectory(configDir, emailId), "renewer.json");
}
export function recordRenewer(configDir: string, emailId: string): void {
  writeFileSync(
    renewerPath(configDir, emailId),
    JSON.stringify({ pid: process.pid, at: Date.now() }),
    { mode: 0o600 },
  );
}
export function renewerAlive(configDir: string, emailId: string): boolean {
  try {
    const value = JSON.parse(
      readFileSync(renewerPath(configDir, emailId), "utf8"),
    ) as { pid?: unknown; at?: unknown };
    if (typeof value.pid !== "number" || typeof value.at !== "number")
      return false;
    // A live renewer refreshes this heartbeat at least once per renewal.
    if (Date.now() - value.at > AUTO_WORKING_RENEW_MS * 2) return false;
    process.kill(value.pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Backstop for runtimes that end background processes between tool calls:
 * any CLI invocation restarts a renewer for an active lease whose renewer is
 * gone. Cheap when there are no leases. Never throws.
 */
export function resumeAutoWorking(
  configDir: string,
  options: {
    env?: Record<string, string | undefined>;
    spawnImpl?: SpawnLike;
    now?: () => number;
  } = {},
): number {
  try {
    const env = options.env ?? process.env;
    if (autoSignalsDisabled(env) || env[AUTO_SIGNAL_WORKER_ENV] === "1")
      return 0;
    const now = (options.now ?? Date.now)();
    let started = 0;
    for (const lease of activeWorkingLeases(configDir, () => now)) {
      if (now - lease.started_at >= AUTO_WORKING_CAP_MS) continue;
      if (renewerAlive(configDir, lease.email_id)) continue;
      if (
        spawnAutoSignalWorker({
          configDir,
          emailId: lease.email_id,
          kind: "working",
          profileName: lease.profile,
          env,
          spawnImpl: options.spawnImpl,
        })
      )
        started++;
    }
    return started;
  } catch {
    return 0;
  }
}
