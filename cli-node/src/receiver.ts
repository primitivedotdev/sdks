/**
 * Supported API for receivers that wake a coding session on Primitive mail.
 * Import it as `primitive/receiver`. See "Supported receiver API" in the
 * package README.
 */
import {
  CONTACT_POLICY_RETRY_MAX_MS,
  CONTACT_POLICY_RETRY_MIN_MS,
  type ContactNotificationAdmission,
  ContactPolicyReadRetryError,
  createNotificationContactPolicy,
  NetworkAdmissionPendingError,
} from "./oclif/notification-contact-policy.js";
import { NotificationRetryError } from "./oclif/notify-session-content.js";
import { mailAddress, mailId, mailTime } from "./oclif/shared-mail-files.js";

/** One page of `listAgentContacts` (`primitive agent contacts list`). */
export type ContactPage = {
  readonly data: readonly unknown[];
  /** The cursor for the next page, or null on the last page. */
  readonly cursor: string | null;
};

/**
 * The `checkDefaultNetworkContactAdmission` result for one email
 * (`primitive agent-networks check-default-network-contact-admission`).
 */
export type NetworkAdmission = {
  readonly allowed: boolean;
  readonly allowed_since: string | null;
  readonly pending: boolean;
  readonly member_policy_required: boolean;
  readonly sender_relation?: "owner" | "member" | undefined;
};

/**
 * Reads the policy from the API as the connected address. A reader that hits
 * a temporary failure, such as a rate limit, a 5xx response or a dropped
 * connection, throws `new WakePolicyError("policy_read_failed")`. Any other
 * error from a reader makes the policy unavailable.
 */
export type WakePolicyOptions = {
  /** The connected address that receives the mail. */
  readonly recipient: string;
  /**
   * Admit first mail from unknown senders as `request` when the owner allows
   * contact requests. Defaults to false.
   */
  readonly contactRequests?: boolean | undefined;
  /** The `data` of `getAgentContactPolicy` for the recipient. */
  readonly readContactPolicy: (signal: AbortSignal) => Promise<unknown>;
  /** One page of the recipient's contacts, 100 rows at most. */
  readonly readContactPage: (
    cursor: string | undefined,
    signal: AbortSignal,
  ) => Promise<ContactPage>;
  /** The network admission decision for one exact email. */
  readonly readNetworkAdmission: (
    emailId: string,
    sender: string,
    signal: AbortSignal,
  ) => Promise<NetworkAdmission>;
};

/** The facts of one received email, from the email detail. */
export type InboundEmail = {
  readonly emailId: string;
  /** The authenticated sender address. Check it before admission. */
  readonly sender: string;
  readonly receivedAt: string;
};

/**
 * `allowed` may wake the session. `request` is a first-contact request from
 * an unknown sender: show it as a request, never as a task.
 */
export type WakeAdmission =
  | (InboundEmail & { readonly kind: "allowed" })
  | (InboundEmail & { readonly kind: "request" });

/** `denied` must not wake the session. */
export type WakeDecision = WakeAdmission | { readonly kind: "denied" };

/**
 * Call synchronously immediately before you wake the session. It throws
 * `WakePolicyError` with `permission_changed` when the permission it confirms
 * was refreshed or is older than 30 seconds; recheck and try again.
 */
export type ConfirmWake = () => void;

export type WakePolicy = {
  /** Decide whether one email may wake the session. */
  admit(email: InboundEmail, signal: AbortSignal): Promise<WakeDecision>;
  /**
   * Read the policy again for an admission from this policy's `admit`, right
   * before dispatch. Throws `permission_changed` if the admission no longer
   * holds.
   */
  recheck(admission: WakeAdmission, signal: AbortSignal): Promise<ConfirmWake>;
};

/**
 * - `policy_read_failed`: a policy read failed temporarily. Retry later; the
 *   policy paces repeated reads itself.
 * - `network_admission_pending`: the server has not settled network admission
 *   for this email. Retry in a few seconds.
 * - `permission_changed`: permission changed or expired before dispatch.
 *   Admit the email again.
 * - `policy_unavailable`: the policy is invalid or access is lost. Do not
 *   wake; retrying will not help until access is restored.
 */
export type WakePolicyErrorCode =
  | "policy_read_failed"
  | "network_admission_pending"
  | "permission_changed"
  | "policy_unavailable";

const RETRYABLE: Record<WakePolicyErrorCode, boolean> = {
  policy_read_failed: true,
  network_admission_pending: true,
  permission_changed: true,
  policy_unavailable: false,
};

export class WakePolicyError extends Error {
  readonly code: WakePolicyErrorCode;
  /** Whether the same email may be admitted later without operator action. */
  readonly retryable: boolean;

  constructor(code: WakePolicyErrorCode, options?: { cause?: unknown }) {
    super(`Wake policy: ${code}`, options);
    this.name = "WakePolicyError";
    this.code = code;
    this.retryable = RETRYABLE[code];
  }
}

function publicError(error: unknown, signal: AbortSignal): unknown {
  if (signal.aborted) return signal.reason;
  if (error instanceof WakePolicyError) return error;
  if (error instanceof NetworkAdmissionPendingError)
    return new WakePolicyError("network_admission_pending");
  if (error instanceof ContactPolicyReadRetryError)
    return new WakePolicyError("policy_read_failed");
  if (error instanceof NotificationRetryError)
    return new WakePolicyError("permission_changed");
  return new WakePolicyError("policy_unavailable", { cause: error });
}

function transient<A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args) => {
    try {
      return await read(...args);
    } catch (error) {
      if (
        error instanceof WakePolicyError &&
        error.code === "policy_read_failed"
      )
        throw new ContactPolicyReadRetryError();
      throw error;
    }
  };
}

/**
 * The policy backs off its own reads but not the network read, which runs per
 * email. Give that read the same backoff so a receiver that retries right away
 * does not keep calling a failing server.
 */
function paced<A extends unknown[], R>(
  read: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  let retryAt = 0;
  let retryDelay = CONTACT_POLICY_RETRY_MIN_MS;
  return async (...args) => {
    if (performance.now() < retryAt) throw new ContactPolicyReadRetryError();
    try {
      const value = await read(...args);
      retryAt = 0;
      retryDelay = CONTACT_POLICY_RETRY_MIN_MS;
      return value;
    } catch (error) {
      if (error instanceof ContactPolicyReadRetryError) {
        retryAt = performance.now() + retryDelay;
        retryDelay = Math.min(retryDelay * 2, CONTACT_POLICY_RETRY_MAX_MS);
      }
      throw error;
    }
  };
}

function inbound(email: InboundEmail) {
  try {
    return {
      emailId: mailId(email.emailId),
      receivedAt: mailTime(email.receivedAt),
    };
  } catch {
    throw new TypeError(
      "admit needs an email ID (UUID) and an ISO 8601 received time.",
    );
  }
}

/** Create the contact admission policy for one connected address. */
export function createWakePolicy(options: WakePolicyOptions): WakePolicy {
  let recipient: string;
  try {
    recipient = mailAddress(options.recipient);
  } catch {
    throw new TypeError("createWakePolicy needs a recipient email address.");
  }
  const policy = createNotificationContactPolicy({
    recipient,
    contactRequests: options.contactRequests === true,
    readPolicy: transient(options.readContactPolicy),
    readPage: transient(options.readContactPage),
    readNetworkAdmission: paced(transient(options.readNetworkAdmission)),
  });
  const issued = new WeakMap<WakeAdmission, ContactNotificationAdmission>();

  return {
    async admit(email, signal) {
      const { emailId, receivedAt } = inbound(email);
      let admitted: ContactNotificationAdmission | null;
      try {
        admitted = await policy.admit(
          email.sender,
          receivedAt,
          signal,
          emailId,
        );
      } catch (error) {
        throw publicError(error, signal);
      }
      if (admitted === null || admitted.kind === "response")
        return { kind: "denied" };
      const admission: WakeAdmission = Object.freeze({
        kind: admitted.kind,
        emailId,
        sender: admitted.sender,
        receivedAt,
      });
      issued.set(admission, admitted);
      return admission;
    },
    async recheck(admission, signal) {
      const prior = issued.get(admission);
      if (!prior)
        throw new TypeError(
          "recheck takes an admission returned by this policy's admit.",
        );
      try {
        const confirm = await policy.recheck(prior, signal);
        return () => {
          try {
            confirm();
          } catch (error) {
            throw publicError(error, signal);
          }
        };
      } catch (error) {
        throw publicError(error, signal);
      }
    },
  };
}
