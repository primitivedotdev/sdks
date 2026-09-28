import {
  canonicalContactSelector,
  matchesContactPattern,
} from "./contact-rule-matcher.js";
import { mailId, mailTime } from "./shared-mail-files.js";

export type ContactPolicyRule = {
  pattern: string;
  effect: "allow" | "silence";
  notify_since: string | null;
  notification_generation: string | null;
};
export type ContactPolicyDocument = {
  rules: ContactPolicyRule[];
  allow_contact_requests: boolean | null;
  contact_request_since: string | null;
  contact_request_generation: string | null;
  version: string | null;
  updated_at: string | null;
};
export type AgentContactPolicy = {
  agent_address: string;
  org_policy: ContactPolicyDocument;
  agent_policy: ContactPolicyDocument;
  effective_version: string;
  effective_since: string;
  allow_contact_requests: boolean;
  contact_request_since: string | null;
  contact_request_generation: string | null;
};
export type NotificationMembership =
  | { notify: false }
  | { notify: true; generation: string; notifySince: string };
export type ContactPolicyDecision =
  | { kind: "silent"; source: "membership" | "agent" | "org" | "default" }
  | {
      kind: "allowed";
      source: "membership" | "agent" | "org";
      generation: string;
      notifySince: string;
      pattern?: string;
    }
  | { kind: "request"; generation: string; notifySince: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid contact policy.");
  return value as Record<string, unknown>;
}
function fingerprint(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid contact policy version.");
  return value;
}
function document(
  value: unknown,
  organization: boolean,
): ContactPolicyDocument {
  const row = record(value);
  if (
    !Array.isArray(row.rules) ||
    row.rules.length > 100 ||
    !(
      typeof row.allow_contact_requests === "boolean" ||
      (!organization && row.allow_contact_requests === null)
    )
  )
    throw new Error("Invalid contact policy document.");
  const seen = new Set<string>();
  const rules = row.rules.map((value): ContactPolicyRule => {
    const rule = record(value);
    if (
      typeof rule.pattern !== "string" ||
      (rule.effect !== "allow" && rule.effect !== "silence")
    )
      throw new Error("Invalid contact policy rule.");
    const pattern = canonicalContactSelector({
      kind: "pattern",
      value: rule.pattern,
    }).value;
    const key = `${pattern}:${rule.effect}`;
    if (pattern !== rule.pattern || seen.has(key))
      throw new Error("Invalid contact policy rule.");
    seen.add(key);
    if (rule.effect === "silence") {
      if (rule.notify_since !== null || rule.notification_generation !== null)
        throw new Error("Invalid silence rule.");
      return {
        pattern,
        effect: "silence",
        notify_since: null,
        notification_generation: null,
      };
    }
    return {
      pattern,
      effect: "allow",
      notify_since: mailTime(rule.notify_since),
      notification_generation: mailId(rule.notification_generation),
    };
  });
  const version = row.version === null ? null : mailId(row.version);
  const updatedAt = row.updated_at === null ? null : mailTime(row.updated_at);
  if ((version === null) !== (updatedAt === null))
    throw new Error("Invalid contact policy document version.");
  const requests = row.allow_contact_requests;
  if (
    requests !== true &&
    (row.contact_request_since !== null ||
      row.contact_request_generation !== null)
  )
    throw new Error("Invalid contact request activation.");
  if (
    version === null &&
    (rules.length || requests !== (organization ? false : null))
  )
    throw new Error("Invalid missing contact policy document.");
  return {
    rules,
    allow_contact_requests: requests,
    contact_request_since:
      requests === true ? mailTime(row.contact_request_since) : null,
    contact_request_generation:
      requests === true ? mailId(row.contact_request_generation) : null,
    version,
    updated_at: updatedAt,
  };
}

export function parseAgentContactPolicy(
  value: unknown,
  recipient: string,
): AgentContactPolicy {
  const row = record(value);
  if (
    row.agent_address !== recipient ||
    typeof row.allow_contact_requests !== "boolean"
  )
    throw new Error("Contact policy recipient mismatch.");
  const org = document(row.org_policy, true);
  const agent = document(row.agent_policy, false);
  if (
    row.allow_contact_requests !==
    (agent.allow_contact_requests ?? org.allow_contact_requests)
  )
    throw new Error("Inconsistent contact request policy.");
  if (
    !row.allow_contact_requests &&
    (row.contact_request_since !== null ||
      row.contact_request_generation !== null)
  )
    throw new Error("Invalid effective contact request activation.");
  return {
    agent_address: recipient,
    org_policy: org,
    agent_policy: agent,
    effective_version: fingerprint(row.effective_version),
    effective_since: mailTime(row.effective_since),
    allow_contact_requests: row.allow_contact_requests,
    contact_request_since: row.allow_contact_requests
      ? mailTime(row.contact_request_since)
      : null,
    contact_request_generation: row.allow_contact_requests
      ? fingerprint(row.contact_request_generation)
      : null,
  };
}

const latest = (left: string, right: string) =>
  Date.parse(left) >= Date.parse(right) ? left : right;
const arrived = (received: string, since: string) =>
  Date.parse(received) >= Date.parse(since);

/** Owner rules are unordered. Agent matches take precedence; silence wins ties. */
export function evaluateContactPolicy(options: {
  policy: AgentContactPolicy;
  sender: string;
  receivedAt: string;
  membership?: NotificationMembership;
  contactRequests: boolean;
}): ContactPolicyDecision {
  const { policy, sender, receivedAt, membership } = options;
  if (membership?.notify === false)
    return { kind: "silent", source: "membership" };
  for (const source of ["agent", "org"] as const) {
    const matches = policy[`${source}_policy`].rules.filter((rule) =>
      matchesContactPattern(rule.pattern, sender),
    );
    if (!matches.length) continue;
    if (matches.some((rule) => rule.effect === "silence"))
      return { kind: "silent", source };
    for (const rule of matches.sort((a, b) =>
      a.pattern < b.pattern ? -1 : a.pattern > b.pattern ? 1 : 0,
    )) {
      if (!rule.notify_since || !rule.notification_generation)
        throw new Error("Missing rule activation.");
      const since = latest(rule.notify_since, policy.effective_since);
      if (arrived(receivedAt, since))
        return {
          kind: "allowed",
          source,
          pattern: rule.pattern,
          generation: rule.notification_generation,
          notifySince: since,
        };
    }
    return { kind: "silent", source };
  }
  if (membership?.notify === true) {
    const since = membership.notifySince;
    return arrived(receivedAt, since)
      ? {
          kind: "allowed",
          source: "membership",
          generation: membership.generation,
          notifySince: since,
        }
      : { kind: "silent", source: "membership" };
  }
  if (
    options.contactRequests &&
    policy.allow_contact_requests &&
    policy.contact_request_since &&
    policy.contact_request_generation
  ) {
    const since = latest(policy.contact_request_since, policy.effective_since);
    if (arrived(receivedAt, since))
      return {
        kind: "request",
        generation: policy.contact_request_generation,
        notifySince: since,
      };
  }
  return { kind: "silent", source: "default" };
}
