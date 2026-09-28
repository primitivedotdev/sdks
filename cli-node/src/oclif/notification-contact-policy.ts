import { ListenStateError } from "./listen-state.js";
import { NotificationRetryError } from "./notify-session-content.js";
import { mailAddress, mailId, mailTime } from "./shared-mail-files.js";

export const CONTACT_POLICY_MAX_AGE_MS = 30_000;
export type ContactPolicyPage = { data: unknown; cursor: unknown };
export type ContactNotificationAdmission = {
  sender: string;
  receivedAt: string;
  generation: string;
  notifySince: string;
};
type Preference = { generation: string; notifySince: string };
type Snapshot = { startedAt: number; senders: Map<string, Preference> };

const unavailable = () =>
  new ListenStateError(
    "Contact notification preferences are unavailable or invalid. No contact notification was submitted; restart after access is restored.",
  );
const changed = () =>
  new NotificationRetryError(
    "Contact notification permission changed or expired before dispatch.",
  );

/** Read one connected address's policy. Partial pages never authorize delivery. */
export function createNotificationContactPolicy(options: {
  recipient: string;
  readPage(
    cursor: string | undefined,
    signal: AbortSignal,
  ): Promise<ContactPolicyPage>;
  now?: () => number;
}) {
  const recipient = mailAddress(options.recipient);
  const now = options.now ?? (() => performance.now());
  let snapshot: Snapshot | undefined;

  function fresh(value: Snapshot | undefined): value is Snapshot {
    if (!value) return false;
    const elapsed = now() - value.startedAt;
    return elapsed >= 0 && elapsed < CONTACT_POLICY_MAX_AGE_MS;
  }
  async function refresh(signal: AbortSignal): Promise<Snapshot> {
    // Invalidate first: neither a failed page nor an overlapping dispatch can
    // fall back to an older policy while a refresh is unresolved.
    snapshot = undefined;
    const next: Snapshot = { startedAt: now(), senders: new Map() };
    const peers = new Set<string>();
    let cursor: string | undefined;
    try {
      do {
        signal.throwIfAborted();
        const page = await options.readPage(cursor, signal);
        signal.throwIfAborted();
        if (!fresh(next) || !Array.isArray(page.data) || page.data.length > 100)
          throw unavailable();
        let previous = cursor;
        for (const value of page.data) {
          if (!value || typeof value !== "object" || Array.isArray(value))
            throw unavailable();
          const row = value as Record<string, unknown>;
          const peer = mailAddress(row.contact_address);
          if (
            row.agent_address !== recipient ||
            row.contact_address !== peer ||
            (previous !== undefined && peer <= previous) ||
            peers.has(peer) ||
            typeof row.notify !== "boolean"
          )
            throw unavailable();
          mailId(row.version);
          peers.add(peer);
          previous = peer;
          if (row.notify) {
            next.senders.set(peer, {
              generation: mailId(row.notification_generation),
              notifySince: mailTime(row.notify_since),
            });
          } else if (
            row.notification_generation !== null ||
            row.notify_since !== null
          )
            throw unavailable();
        }
        if (page.cursor === null) cursor = undefined;
        else {
          const following = mailAddress(page.cursor);
          if (!page.data.length || following !== previous) throw unavailable();
          cursor = following;
        }
      } while (cursor !== undefined);
      if (!fresh(next)) throw unavailable();
      snapshot = next;
      return next;
    } catch {
      snapshot = undefined;
      signal.throwIfAborted();
      throw unavailable();
    }
  }
  function permits(value: Snapshot, admission: ContactNotificationAdmission) {
    const preference = value.senders.get(admission.sender);
    return (
      preference?.generation === admission.generation &&
      preference.notifySince === admission.notifySince &&
      Date.parse(admission.receivedAt) >= Date.parse(preference.notifySince)
    );
  }
  return {
    refresh,
    async admit(sender: string, receivedAt: string, signal: AbortSignal) {
      signal.throwIfAborted();
      let peer: string;
      try {
        peer = mailAddress(sender);
      } catch {
        return null;
      }
      const received = mailTime(receivedAt);
      const cached = fresh(snapshot);
      let current = cached && snapshot ? snapshot : await refresh(signal);
      let preference = current.senders.get(peer);
      if (
        cached &&
        (!preference ||
          Date.parse(received) < Date.parse(preference.notifySince))
      ) {
        // A cached denial must not permanently discard mail received after a
        // newly enabled preference. Fetch current policy before settling it.
        current = await refresh(signal);
        preference = current.senders.get(peer);
      }
      if (
        !preference ||
        Date.parse(received) < Date.parse(preference.notifySince)
      )
        return null;
      return {
        sender: peer,
        receivedAt: received,
        generation: preference.generation,
        notifySince: preference.notifySince,
      } satisfies ContactNotificationAdmission;
    },
    async recheck(
      admission: ContactNotificationAdmission,
      signal: AbortSignal,
    ) {
      const current = await refresh(signal);
      if (!permits(current, admission)) throw changed();
      // The native adapter invokes this synchronously before its durable
      // submitting receipt, after socket/session preflight has completed.
      return () => {
        signal.throwIfAborted();
        if (!fresh(snapshot) || !permits(snapshot, admission)) throw changed();
      };
    },
  };
}
