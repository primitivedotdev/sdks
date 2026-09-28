import { createHash } from "node:crypto";
import { join } from "node:path";
import type { ConnectedAgentIdentity } from "./connected-agent-profile.js";
import { acquireListenLock, ListenStateError } from "./listen-state.js";
import type { NotificationReceipt } from "./notify-session-state.js";
import {
  mailId,
  mailObject,
  mailTime,
  privateMailDirectory,
  readMailJson,
  writeMailJson,
} from "./shared-mail-files.js";

export const MAX_PENDING_CONTACT_REQUESTS = 32;
export const MAX_CONTACT_REQUEST_SENDERS = 1024;
type RequestNotice = {
  senderHash: string;
  emailId: string;
  eventId: string;
  clientId: string;
  threadId: string;
  pending: boolean;
};
type RequestState = { activatedAt: string | null; notices: RequestNotice[] };
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const invalid = () =>
  new ListenStateError(
    "Contact request notice state is unavailable. Preserve it to avoid duplicate notices.",
  );

/** Stable across profile, credential and native-session changes in one config. */
export function openContactRequestNotices(
  configDir: string,
  identity: ConnectedAgentIdentity,
) {
  const key = hash(
    JSON.stringify([
      identity.apiBaseUrl,
      identity.orgId,
      identity.agentAddress,
    ]),
  );
  const directory = join(configDir, "contact-request-notices", key);
  privateMailDirectory(directory, true);
  const path = join(directory, "notices.json");
  function read(): RequestState {
    const raw = readMailJson(path, 512 * 1024);
    if (raw === null) return { activatedAt: null, notices: [] };
    const state = mailObject(raw, ["activatedAt", "notices"]);
    if (
      !Array.isArray(state.notices) ||
      state.notices.length > MAX_CONTACT_REQUEST_SENDERS
    )
      throw invalid();
    const senders = new Set<string>();
    const notices = state.notices.map((value): RequestNotice => {
      const row = mailObject(value, [
        "senderHash",
        "emailId",
        "eventId",
        "clientId",
        "threadId",
        "pending",
      ]);
      if (
        typeof row.senderHash !== "string" ||
        !/^[a-f0-9]{64}$/.test(row.senderHash) ||
        senders.has(row.senderHash) ||
        typeof row.pending !== "boolean"
      )
        throw invalid();
      senders.add(row.senderHash);
      return {
        senderHash: row.senderHash,
        emailId: mailId(row.emailId),
        eventId: mailId(row.eventId),
        clientId: mailId(row.clientId),
        threadId: mailId(row.threadId),
        pending: row.pending,
      };
    });
    return {
      activatedAt:
        state.activatedAt === null ? null : mailTime(state.activatedAt),
      notices,
    };
  }
  return {
    /** First local opt-in excludes backlog; ordinary restarts retain this cutoff. */
    activate(now = Date.now()): string {
      const release = acquireListenLock(directory, "contact-request-notices");
      try {
        const state = read();
        if (state.activatedAt !== null) return state.activatedAt;
        state.activatedAt = new Date(now).toISOString();
        writeMailJson(path, state);
        return state.activatedAt;
      } finally {
        release();
      }
    },
    /** Held is intentional even if the subsequent native submission is uncertain. */
    reserve(
      sender: string,
      threadId: string,
      receipt: NotificationReceipt,
      decidedSenders: Iterable<string>,
    ): "reserved" | "duplicate" | "full" {
      const release = acquireListenLock(directory, "contact-request-notices");
      try {
        const state = read();
        const senderHash = hash(sender);
        if (state.notices.some((notice) => notice.senderHash === senderHash))
          return "duplicate";
        const decided = new Set([...decidedSenders].map(hash));
        for (const notice of state.notices)
          if (decided.has(notice.senderHash)) notice.pending = false;
        if (
          state.notices.length >= MAX_CONTACT_REQUEST_SENDERS ||
          state.notices.filter((notice) => notice.pending).length >=
            MAX_PENDING_CONTACT_REQUESTS
        )
          return "full";
        state.notices.push({
          senderHash,
          emailId: mailId(receipt.emailId),
          eventId: mailId(receipt.eventId),
          clientId: mailId(receipt.clientId),
          threadId: mailId(threadId),
          pending: true,
        });
        writeMailJson(path, state);
        return "reserved";
      } finally {
        release();
      }
    },
  };
}
