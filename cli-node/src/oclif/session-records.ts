import { readdirSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { agentProfileDirectory } from "./connected-agent-profile.js";
import { acquireListenLock, ListenStateError } from "./listen-state.js";
import {
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

export const MACHINE_RUNTIMES = ["claude", "codex", "omp"] as const;
export type MachineRuntime = (typeof MACHINE_RUNTIMES)[number];

/** Why a registration stopped owning the credential in its profile. */
export type SessionRecordRelease = {
  at: string;
  reason: "replaced_by_connect" | "credential_changed";
  /** The address the registration created, kept for the record. */
  registeredAddress: string | null;
};

/** The machine's record of a session it registered. Never holds credentials. */
export type SessionRecord = {
  version: 1;
  runtime: MachineRuntime;
  session: string;
  profile: string;
  name: string;
  createdBy: "session-register" | "existing";
  address: string | null;
  /**
   * The invitation hash of the credential this record describes, so a later
   * end can tell it apart from a different credential saved in the same
   * profile. Null for records written before it was kept.
   */
  invitationHash: string | null;
  agentInfo: "created" | "already_present" | null;
  registeredAt: string;
  endedAt: string | null;
  /**
   * Whether disconnecting an ended session's agent is confirmed. "deferred"
   * means the end came from a runtime hook and waits until `deferredUntil`,
   * so a restart or resume of the same session keeps its agent.
   */
  disconnect: "done" | "pending" | "pending_enrollment" | "deferred" | null;
  deferredUntil: string | null;
  /** The runtime's reason for the end, when its hook gave one. */
  endReason: string | null;
  release: SessionRecordRelease | null;
};

const HASH = /^[a-f0-9]{64}$/;
const REASON = /^[a-z_]{1,40}$/;

export function sessionRecordsDirectory(configDir: string): string {
  return join(configDir, "machine", "sessions");
}

function sessionRecordPath(configDir: string, session: string): string {
  return join(sessionRecordsDirectory(configDir), `${session}.json`);
}

function parseRelease(value: unknown): SessionRecordRelease | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Partial<SessionRecordRelease>;
  if (
    typeof row.at !== "string" ||
    (row.reason !== "replaced_by_connect" &&
      row.reason !== "credential_changed")
  )
    return null;
  return {
    at: row.at,
    reason: row.reason,
    registeredAddress:
      typeof row.registeredAddress === "string" ? row.registeredAddress : null,
  };
}

export function readSessionRecord(
  configDir: string,
  session: string,
): SessionRecord | null {
  try {
    const value = readMailJson(sessionRecordPath(configDir, session));
    if (!value || typeof value !== "object" || Array.isArray(value))
      return null;
    const row = value as Partial<SessionRecord>;
    if (
      row.version !== 1 ||
      row.session !== session ||
      typeof row.profile !== "string" ||
      typeof row.name !== "string" ||
      !MACHINE_RUNTIMES.includes(row.runtime as MachineRuntime) ||
      (row.createdBy !== "session-register" && row.createdBy !== "existing")
    )
      return null;
    return {
      version: 1,
      runtime: row.runtime as MachineRuntime,
      session,
      profile: row.profile,
      name: row.name,
      createdBy: row.createdBy,
      address: typeof row.address === "string" ? row.address : null,
      invitationHash:
        typeof row.invitationHash === "string" && HASH.test(row.invitationHash)
          ? row.invitationHash
          : null,
      agentInfo:
        row.agentInfo === "created" || row.agentInfo === "already_present"
          ? row.agentInfo
          : null,
      registeredAt:
        typeof row.registeredAt === "string"
          ? row.registeredAt
          : new Date(0).toISOString(),
      endedAt: typeof row.endedAt === "string" ? row.endedAt : null,
      disconnect:
        row.disconnect === "done" ||
        row.disconnect === "pending" ||
        row.disconnect === "pending_enrollment" ||
        row.disconnect === "deferred"
          ? row.disconnect
          : // Records written before this field existed ended with a disconnect.
            typeof row.endedAt === "string"
            ? "done"
            : null,
      deferredUntil:
        typeof row.deferredUntil === "string" ? row.deferredUntil : null,
      endReason:
        typeof row.endReason === "string" && REASON.test(row.endReason)
          ? row.endReason
          : null,
      release: parseRelease(row.release),
    };
  } catch {
    return null;
  }
}

function saveSessionRecord(configDir: string, row: SessionRecord): void {
  writeMailJson(sessionRecordPath(configDir, row.session), row);
}

/** Serialize every read-modify-write of one session's record. */
async function withRecordLock<T>(
  configDir: string,
  session: string,
  action: () => T | Promise<T>,
): Promise<T> {
  const directory = sessionRecordsDirectory(configDir);
  privateMailDirectory(directory, true);
  let release: (() => void) | undefined;
  for (let attempt = 0; attempt < 200 && !release; attempt++) {
    try {
      release = acquireListenLock(directory, `session-record-${session}`);
    } catch {
      await sleep(50);
    }
  }
  if (!release)
    throw new ListenStateError("The session record is locked by another run.");
  try {
    return await action();
  } finally {
    release();
  }
}

/** Read, change and save one record under its lock. Returns the saved record. */
export function updateSessionRecord(
  configDir: string,
  session: string,
  change: (current: SessionRecord | null) => SessionRecord | null,
): Promise<SessionRecord | null> {
  return withRecordLock(configDir, session, () => {
    const current = readSessionRecord(configDir, session);
    const next = change(current);
    if (next && next !== current) saveSessionRecord(configDir, next);
    return next ?? current;
  });
}

/** Every readable session record on this machine. */
export function listSessionRecords(configDir: string): SessionRecord[] {
  let names: string[];
  try {
    names = readdirSync(sessionRecordsDirectory(configDir));
  } catch {
    return [];
  }
  return names.flatMap((name) => {
    const match = /^([0-9a-f-]{36})\.json$/.exec(name);
    if (!match?.[1]) return [];
    const record = readSessionRecord(configDir, match[1]);
    return record ? [record] : [];
  });
}

/**
 * The record no longer owns the credential in its profile: it becomes a
 * record of an agent connected some other way, which a session end leaves
 * connected. Any end that was waiting is dropped with it.
 */
export function releasedRecord(
  record: SessionRecord,
  reason: SessionRecordRelease["reason"],
  at: Date,
  current?: { address: string; invitationHash: string } | null,
): SessionRecord {
  return {
    ...record,
    createdBy: "existing",
    address: current ? current.address : record.address,
    invitationHash: current ? current.invitationHash : null,
    endedAt: null,
    disconnect: null,
    deferredUntil: null,
    endReason: null,
    release: {
      at: at.toISOString(),
      reason,
      registeredAddress: record.address,
    },
  };
}

/** The invitation hash an enrollment in this profile saved, if any. */
function enrollmentInvitationHash(
  configDir: string,
  profileName: string,
): string | null {
  try {
    const state = readMailJson(
      join(
        agentProfileDirectory(configDir, profileName),
        "enrollment",
        "state.json",
      ),
      65_536,
    ) as { invitationHash?: unknown } | null;
    return typeof state?.invitationHash === "string" &&
      HASH.test(state.invitationHash)
      ? state.invitationHash
      : null;
  } catch {
    return null;
  }
}

/**
 * A credential was just claimed into `profileName`. Every session record that
 * says `session-register` created the agent in that profile is released,
 * unless this claim is that registration's own enrollment finishing, so a
 * later session end never disconnects the newly connected agent. Best effort:
 * a failure here leaves the end-time credential check as the safeguard.
 */
export async function releaseRegistrationsForClaim(params: {
  configDir: string;
  profileName: string;
  address: string;
  invitationHash: string;
  now?: () => Date;
}): Promise<void> {
  const own = enrollmentInvitationHash(params.configDir, params.profileName);
  for (const listed of listSessionRecords(params.configDir)) {
    if (listed.profile !== params.profileName) continue;
    try {
      await updateSessionRecord(params.configDir, listed.session, (current) => {
        if (!current || current.profile !== params.profileName) return current;
        // A record released earlier (for example by a replacement) now
        // describes the credential that took the profile's place.
        if (current.createdBy === "existing")
          return current.release &&
            (current.address !== params.address ||
              current.invitationHash !== params.invitationHash)
            ? {
                ...current,
                address: params.address,
                invitationHash: params.invitationHash,
              }
            : current;
        const enrollmentFinishing =
          own === params.invitationHash &&
          (current.address === null ||
            current.address.toLowerCase() === params.address.toLowerCase());
        if (enrollmentFinishing) return current;
        return releasedRecord(
          current,
          "replaced_by_connect",
          (params.now ?? (() => new Date()))(),
          { address: params.address, invitationHash: params.invitationHash },
        );
      });
    } catch {
      /* The end-time credential check still protects this profile. */
    }
  }
}

/**
 * The profile's credential is being replaced on purpose (for example by
 * `--replace-existing`): release every registration record for it, keeping
 * the registered address for reference.
 */
export async function releaseRegistrationsForProfile(params: {
  configDir: string;
  profileName: string;
  now?: () => Date;
}): Promise<void> {
  for (const listed of listSessionRecords(params.configDir)) {
    if (
      listed.profile !== params.profileName ||
      listed.createdBy !== "session-register"
    )
      continue;
    try {
      await updateSessionRecord(params.configDir, listed.session, (current) =>
        current &&
        current.profile === params.profileName &&
        current.createdBy === "session-register"
          ? releasedRecord(
              current,
              "replaced_by_connect",
              (params.now ?? (() => new Date()))(),
            )
          : current,
      );
    } catch {
      /* The end-time credential check still protects this profile. */
    }
  }
}
