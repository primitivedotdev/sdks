import {
  type AgentContactPolicy,
  evaluateContactPolicy,
  type NotificationMembership,
  parseAgentContactPolicy,
} from "./contact-policy.js";
import { ListenStateError } from "./listen-state.js";
import { NotificationRetryError } from "./notify-session-content.js";
import { mailAddress, mailId, mailTime } from "./shared-mail-files.js";

export const CONTACT_POLICY_MAX_AGE_MS = 30_000;
export const CONTACT_POLICY_RETRY_MIN_MS = 1000;
export const CONTACT_POLICY_RETRY_MAX_MS = 30_000;
export const NETWORK_ADMISSION_PENDING_RETRY_MS = 5_000;
export class NetworkAdmissionPendingError extends NotificationRetryError {
  constructor() {
    super("Network mail admission is pending delivery proof.");
  }
}
export class ContactPolicyReadRetryError extends NotificationRetryError {
  constructor() {
    super(
      "Contact notification policy is temporarily unavailable. Mail remains pending while permissions are refreshed.",
    );
  }
}
export type ContactPolicyPage = { data: unknown; cursor: unknown };
export type ContactNotificationAdmission = {
  sender: string;
  emailId?: string;
  receivedAt: string;
  generation: string;
  notifySince: string;
  kind: "allowed" | "request" | "response";
  effectiveVersion: string;
  source?: "network";
  senderRelation?: "owner" | "member";
};
type Snapshot = {
  startedAt: number;
  senders: Map<string, NotificationMembership>;
  policy: AgentContactPolicy;
};

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
  readPolicy(signal: AbortSignal): Promise<unknown>;
  readNetworkAdmission?(
    emailId: string,
    sender: string,
    signal: AbortSignal,
  ): Promise<{
    allowed: boolean;
    allowed_since: string | null;
    pending: boolean;
    member_policy_required: boolean;
    sender_relation?: "owner" | "member";
  }>;
  contactRequests?: boolean;
  now?: () => number;
}) {
  const recipient = mailAddress(options.recipient);
  const now = options.now ?? (() => performance.now());
  let snapshot: Snapshot | undefined;
  let retryAt = 0;
  let retryDelay = CONTACT_POLICY_RETRY_MIN_MS;

  function fresh(value: Snapshot | undefined): value is Snapshot {
    if (!value) return false;
    const elapsed = now() - value.startedAt;
    return elapsed >= 0 && elapsed < CONTACT_POLICY_MAX_AGE_MS;
  }
  async function refreshOnce(signal: AbortSignal): Promise<Snapshot> {
    // Invalidate first: neither a failed page nor an overlapping dispatch can
    // fall back to an older policy while a refresh is unresolved.
    snapshot = undefined;
    signal.throwIfAborted();
    if (now() < retryAt) throw new ContactPolicyReadRetryError();
    const startedAt = now();
    const peers = new Set<string>();
    let cursor: string | undefined;
    try {
      const next: Snapshot = {
        startedAt,
        senders: new Map(),
        policy: parseAgentContactPolicy(
          await options.readPolicy(signal),
          recipient,
        ),
      };
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
              notify: true,
              generation: mailId(row.notification_generation),
              notifySince: mailTime(row.notify_since),
            });
          } else if (
            row.notification_generation !== null ||
            row.notify_since !== null
          )
            throw unavailable();
          else next.senders.set(peer, { notify: false });
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
      retryAt = 0;
      retryDelay = CONTACT_POLICY_RETRY_MIN_MS;
      return next;
    } catch (error) {
      snapshot = undefined;
      signal.throwIfAborted();
      if (error instanceof ContactPolicyReadRetryError) {
        retryAt = now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, CONTACT_POLICY_RETRY_MAX_MS);
        throw error;
      }
      throw unavailable();
    }
  }
  function admission(
    value: Snapshot,
    sender: string,
    receivedAt: string,
    solicited = false,
  ): ContactNotificationAdmission | null {
    const decision = evaluateContactPolicy({
      policy: value.policy,
      sender,
      receivedAt,
      membership: value.senders.get(sender),
      contactRequests: options.contactRequests === true,
    });
    if (decision.kind === "silent") {
      if (!solicited || decision.source !== "default") return null;
      return {
        sender,
        receivedAt,
        generation: value.policy.effective_version,
        notifySince: value.policy.effective_since,
        kind: "response",
        effectiveVersion: value.policy.effective_version,
      };
    }
    return {
      sender,
      receivedAt,
      generation: decision.generation,
      notifySince: decision.notifySince,
      kind: solicited ? "response" : decision.kind,
      effectiveVersion: value.policy.effective_version,
    };
  }
  async function admissionWithNetwork(
    value: Snapshot,
    sender: string,
    receivedAt: string,
    signal: AbortSignal,
    emailId?: string,
    networkReader = options.readNetworkAdmission,
    solicited = false,
  ): Promise<ContactNotificationAdmission | null> {
    const contact = admission(value, sender, receivedAt, solicited);
    if (!networkReader) return contact;
    if (!emailId) throw unavailable();
    // Check every exact email before contact shortcuts. A reserved human sender
    // may have lost membership or carry an inherited owner mute.
    const network = await networkReader(emailId, sender, signal);
    signal.throwIfAborted();
    if (typeof network.member_policy_required !== "boolean")
      throw unavailable();
    if (
      network.sender_relation !== undefined &&
      (!network.member_policy_required ||
        !["owner", "member"].includes(network.sender_relation))
    )
      throw unavailable();
    if (network.member_policy_required) {
      if (network.allowed && !network.sender_relation) throw unavailable();
      if (network.pending) throw new NetworkAdmissionPendingError();
      if (!network.allowed) return null;
      return networkAdmission(
        value,
        sender,
        receivedAt,
        emailId,
        network,
        solicited,
      );
    }
    const scopedContact = contact ? { ...contact, emailId } : null;
    if (contact?.kind === "allowed" || contact?.kind === "response")
      return scopedContact;
    const decision = evaluateContactPolicy({
      policy: value.policy,
      sender,
      receivedAt,
      membership: value.senders.get(sender),
      contactRequests: options.contactRequests === true,
    });
    if (
      decision.kind !== "request" &&
      !(decision.kind === "silent" && decision.source === "default")
    )
      return scopedContact;
    if (network.pending) throw new NetworkAdmissionPendingError();
    if (!network.allowed) return scopedContact;
    return networkAdmission(
      value,
      sender,
      receivedAt,
      emailId,
      network,
      solicited,
    );
  }
  function networkAdmission(
    value: Snapshot,
    sender: string,
    receivedAt: string,
    emailId: string,
    network: {
      allowed_since: string | null;
      sender_relation?: "owner" | "member";
    },
    solicited: boolean,
  ): ContactNotificationAdmission | null {
    const networkSince =
      network.allowed_since && mailTime(network.allowed_since);
    if (!networkSince) throw unavailable();
    const since =
      Date.parse(value.policy.effective_since) > Date.parse(networkSince)
        ? value.policy.effective_since
        : networkSince;
    if (Date.parse(receivedAt) < Date.parse(since)) return null;
    return {
      sender,
      emailId,
      receivedAt,
      generation: since,
      notifySince: since,
      kind: solicited ? "response" : "allowed",
      effectiveVersion: value.policy.effective_version,
      source: "network",
      ...(network.sender_relation
        ? { senderRelation: network.sender_relation }
        : {}),
    };
  }
  function permits(
    prior: ContactNotificationAdmission,
    current: ContactNotificationAdmission | null,
  ) {
    return (
      current !== null &&
      current.emailId === prior.emailId &&
      current.kind === prior.kind &&
      current.source === prior.source &&
      current.senderRelation === prior.senderRelation &&
      current.generation === prior.generation &&
      current.notifySince === prior.notifySince &&
      current.effectiveVersion === prior.effectiveVersion
    );
  }
  return {
    refresh: refreshOnce,
    members() {
      if (!fresh(snapshot)) throw unavailable();
      return snapshot.senders.keys();
    },
    async admit(
      sender: string,
      receivedAt: string,
      signal: AbortSignal,
      emailId?: string,
    ) {
      signal.throwIfAborted();
      let peer: string;
      try {
        peer = mailAddress(sender);
      } catch {
        return null;
      }
      const received = mailTime(receivedAt);
      const inboundId = emailId === undefined ? undefined : mailId(emailId);
      const reader = options.readNetworkAdmission;
      let networkResult: ReturnType<NonNullable<typeof reader>> | undefined;
      // Reuse one exact-email lookup across a cached denial and policy refresh.
      // Dispatch recheck still makes its own fresh authorization request.
      const networkReader: typeof reader = reader
        ? (id, address, abort) => (networkResult ??= reader(id, address, abort))
        : undefined;
      const cached = fresh(snapshot);
      let current = cached && snapshot ? snapshot : await refreshOnce(signal);
      let allowed = await admissionWithNetwork(
        current,
        peer,
        received,
        signal,
        inboundId,
        networkReader,
      );
      if (cached && allowed?.kind !== "allowed") {
        // Cached denial or request-only intake cannot discard ordinary mail
        // from a newly approved contact before its dispatch permission is read.
        current = await refreshOnce(signal);
        allowed = await admissionWithNetwork(
          current,
          peer,
          received,
          signal,
          inboundId,
          networkReader,
        );
      }
      return allowed;
    },
    async recheck(prior: ContactNotificationAdmission, signal: AbortSignal) {
      const current = await refreshOnce(signal);
      const candidate = await admissionWithNetwork(
        current,
        prior.sender,
        prior.receivedAt,
        signal,
        prior.emailId,
        options.readNetworkAdmission,
        prior.kind === "response",
      );
      if (!permits(prior, candidate)) throw changed();
      // The native adapter invokes this synchronously before its durable
      // submitting receipt, after socket/session preflight has completed.
      return () => {
        signal.throwIfAborted();
        if (
          !fresh(snapshot) ||
          snapshot !== current ||
          !permits(prior, candidate)
        )
          throw changed();
      };
    },
    // The caller must first prove an exact, locally initiated reply. This is
    // not permission for new mail or an unsolicited contact request.
    async admitResponse(
      sender: string,
      receivedAt: string,
      signal: AbortSignal,
      emailId?: string,
    ) {
      const current = await refreshOnce(signal);
      return admissionWithNetwork(
        current,
        mailAddress(sender),
        mailTime(receivedAt),
        signal,
        emailId,
        options.readNetworkAdmission,
        true,
      );
    },
  };
}
