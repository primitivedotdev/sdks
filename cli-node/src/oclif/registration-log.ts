import { readdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  agentProfileDirectory,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { listenLockHeld } from "./listen-state.js";
import { readMailJson, writeMailJson } from "./shared-mail-files.js";

/**
 * A short private record of this profile's registration attempts, so a
 * stuck registration can be explained by `agent connect --status` and
 * `whoami` without anyone opening profile files. It holds phase changes,
 * error codes, the organization id and the agent address only: never a
 * token, key, claim URL or response body.
 */
const LOG_FILE = "registration-log.json";
const MAX_ENTRIES = 30;
const MAX_DETAIL = 400;
const MAX_BYTES = 65_536;

export type RegistrationEvent =
  | "started"
  | "created"
  | "setup_attempted"
  | "heal_invited"
  | "replaced_unfinished"
  | "finished"
  | "failed";

export type RegistrationLogEntry = {
  at: string;
  event: RegistrationEvent;
  /** The saved enrollment phase after this step, when there is one. */
  phase: string | null;
  /** A short machine-readable reason for a failure. */
  code: string | null;
  orgId: string | null;
  address: string | null;
  /** A human sentence, scrubbed of anything that looks like a secret. */
  detail: string | null;
};

/**
 * Removes anything that could carry a credential: setup URLs and their
 * fragments, token parameters and Primitive key or token prefixes. The
 * messages written here are the CLI's own refusals, so this is a second
 * line of defence, not the only one.
 */
export function scrubRegistrationDetail(text: string): string {
  return text
    .replace(/https?:\/\/\S*agent-connections\/setup\S*/gi, "[setup URL]")
    .replace(/#?token=[^\s"'&]+/gi, "token=[redacted]")
    .replace(/\b(?:prim|pconn|invite|invitation)_[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, MAX_DETAIL);
}

function logPath(configDir: string, profileName: string): string {
  return join(agentProfileDirectory(configDir, profileName), LOG_FILE);
}

function entryFrom(value: unknown): RegistrationLogEntry | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const text = (key: string) =>
    typeof row[key] === "string" ? (row[key] as string) : null;
  const at = text("at");
  const event = text("event");
  if (!at || !event || !Number.isFinite(Date.parse(at))) return null;
  return {
    at,
    event: event as RegistrationEvent,
    phase: text("phase"),
    code: text("code"),
    orgId: text("orgId"),
    address: text("address"),
    detail: text("detail"),
  };
}

/** Every saved entry, oldest first. Empty when there is no readable log. */
export function readRegistrationLog(
  configDir: string,
  profileName: string,
): RegistrationLogEntry[] {
  try {
    const saved = readMailJson(logPath(configDir, profileName), MAX_BYTES) as {
      version?: unknown;
      entries?: unknown;
    } | null;
    if (saved?.version !== 1 || !Array.isArray(saved.entries)) return [];
    return saved.entries
      .map(entryFrom)
      .filter((row): row is RegistrationLogEntry => row !== null);
  } catch {
    return [];
  }
}

/** Appends one entry, keeping the most recent ones. Best effort. */
export function appendRegistrationLog(
  configDir: string,
  profileName: string,
  entry: Omit<RegistrationLogEntry, "at" | "detail"> & {
    at?: string;
    detail?: string | null;
  },
): void {
  try {
    const row: RegistrationLogEntry = {
      at: entry.at ?? new Date().toISOString(),
      event: entry.event,
      phase: entry.phase,
      code: entry.code,
      orgId: entry.orgId,
      address: entry.address,
      detail:
        entry.detail === undefined || entry.detail === null
          ? null
          : scrubRegistrationDetail(entry.detail),
    };
    const entries = [...readRegistrationLog(configDir, profileName), row].slice(
      -MAX_ENTRIES,
    );
    writeMailJson(logPath(configDir, profileName), { version: 1, entries });
  } catch {
    /* The log only explains failures; it never blocks registration. */
  }
}

export type RegistrationSummary = {
  lastAttemptAt: string;
  lastEvent: RegistrationEvent;
  address: string | null;
  orgId: string | null;
  /** The most recent attempt's failure, when the most recent attempt failed. */
  lastFailure: {
    at: string;
    code: string | null;
    detail: string | null;
  } | null;
};

/** What the last registration attempt did, or null when none was recorded. */
export function registrationSummary(
  configDir: string,
  profileName: string,
): RegistrationSummary | null {
  const entries = readRegistrationLog(configDir, profileName);
  const last = entries.at(-1);
  if (!last) return null;
  const address =
    [...entries].reverse().find((row) => row.address !== null)?.address ?? null;
  const orgId =
    [...entries].reverse().find((row) => row.orgId !== null)?.orgId ?? null;
  return {
    lastAttemptAt: last.at,
    lastEvent: last.event,
    address,
    orgId,
    lastFailure:
      last.event === "failed"
        ? { at: last.at, code: last.code, detail: last.detail }
        : null,
  };
}

/** The lock scope an enrollment holds on its profile's enrollment directory. */
export const ENROLLMENT_LOCK_SCOPE = "agent-enrollment";

/** Profiles whose registration is running right now on this machine. */
export function registrationsInFlight(configDir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(configDir), "profiles"));
  } catch {
    return [];
  }
  return names
    .sort()
    .filter((name) =>
      listenLockHeld(
        join(agentProfilesDirectory(configDir), "profiles", name, "enrollment"),
        ENROLLMENT_LOCK_SCOPE,
      ),
    );
}

/**
 * Waits up to `budgetMs` for running registrations to finish, so a login
 * switch does not change the member login underneath one. Returns the
 * profiles still registering when the budget ran out.
 */
export async function waitForRegistrations(
  configDir: string,
  budgetMs: number,
  options: { pollMs?: number; onWait?: (profiles: string[]) => void } = {},
): Promise<string[]> {
  const deadline = Date.now() + budgetMs;
  let running = registrationsInFlight(configDir);
  if (running.length) options.onWait?.(running);
  while (running.length && Date.now() < deadline) {
    await sleep(Math.min(options.pollMs ?? 250, deadline - Date.now()));
    running = registrationsInFlight(configDir);
  }
  return running;
}

/** One line for people: what the last registration attempt did. */
export function registrationSummaryLine(summary: RegistrationSummary): string {
  const failure = summary.lastFailure;
  return failure
    ? `The last registration attempt for this session${summary.address ? ` (${summary.address})` : ""} failed at ${failure.at}${failure.code ? ` (${failure.code})` : ""}: ${failure.detail ?? "no detail was recorded."}`
    : `The last registration attempt for this session${summary.address ? ` (${summary.address})` : ""} reached "${summary.lastEvent}" at ${summary.lastAttemptAt}.`;
}

/**
 * The failed registration of this session's own profile, when the session
 * has no connected credential there. Null when it is connected, never
 * registered, or its last attempt did not fail. Offline and read-only.
 */
export function failedSessionRegistration(
  configDir: string,
  session: string,
): RegistrationSummary | null {
  const profile = `session-${session.toLowerCase()}`;
  try {
    if (loadConnectedAgentProfile(configDir, profile)) return null;
  } catch {
    /* An unreadable credential still leaves the log worth reporting. */
  }
  const summary = registrationSummary(configDir, profile);
  return summary?.lastFailure ? summary : null;
}
