import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  type AgentContactPolicy,
  type ContactPolicyRule,
  evaluateContactPolicy,
  parseAgentContactPolicy,
} from "../../src/oclif/contact-policy.js";

const before = "2026-09-01T00:00:00.000Z";
const now = "2026-09-02T00:00:00.000Z";
const sender = "research-a@example.com";
const membership = {
  notify: true as const,
  generation: randomUUID(),
  notifySince: before,
};
function rule(
  pattern: string,
  effect: "allow" | "silence" = "allow",
): ContactPolicyRule {
  return {
    pattern,
    effect,
    notify_since: effect === "allow" ? before : null,
    notification_generation: effect === "allow" ? randomUUID() : null,
  };
}
function policy(
  org: ContactPolicyRule[] = [],
  agent: ContactPolicyRule[] = [],
): AgentContactPolicy {
  const document = (rules: ContactPolicyRule[], allow: boolean | null) => ({
    rules,
    allow_contact_requests: allow,
    contact_request_since: null,
    contact_request_generation: null,
    version: randomUUID(),
    updated_at: before,
  });
  return {
    agent_address: "agent@example.net",
    org_policy: document(org, false),
    agent_policy: document(agent, null),
    effective_version: "a".repeat(64),
    effective_since: before,
    allow_contact_requests: false,
    contact_request_since: null,
    contact_request_generation: null,
  };
}
const decide = (p: AgentContactPolicy, other = {}) =>
  evaluateContactPolicy({
    policy: p,
    sender,
    receivedAt: now,
    contactRequests: true,
    ...other,
  });

describe("effective contact notification policy", () => {
  it("keeps explicit disabled membership above every broad allow", () => {
    expect(
      decide(
        policy([rule("*@example.com")], [rule("research-*@example.com")]),
        { membership: { notify: false } },
      ),
    ).toEqual({ kind: "silent", source: "membership" });
  });
  it("lets owner silence override an existing enabled membership", () => {
    expect(
      decide(policy([rule("*@example.com", "silence")]), { membership }),
    ).toEqual({ kind: "silent", source: "org" });
    expect(
      decide(policy([], [rule("*@example.com", "silence")]), { membership }),
    ).toEqual({ kind: "silent", source: "agent" });
  });
  it("selects matching agent scope before org scope, without array-order priority", () => {
    const p = policy(
      [rule("*@example.com", "silence")],
      [rule("research-*@example.com")],
    );
    expect(decide(p)).toMatchObject({ kind: "allowed", source: "agent" });
    p.agent_policy.rules.push(rule("*@example.com", "silence"));
    expect(decide(p)).toEqual({ kind: "silent", source: "agent" });
    p.agent_policy.rules.reverse();
    expect(decide(p)).toEqual({ kind: "silent", source: "agent" });
    p.agent_policy.rules = [rule("*@unrelated.test", "silence")];
    expect(decide(p)).toEqual({ kind: "silent", source: "org" });
  });
  it("preserves exact enabled membership if no owner rule matches", () => {
    expect(decide(policy(), { membership })).toMatchObject({
      kind: "allowed",
      source: "membership",
      generation: membership.generation,
    });
    expect(decide(policy())).toEqual({ kind: "silent", source: "default" });
  });
  it("does not replay historical mail after silence is removed or policy broadens", () => {
    for (const p of [policy([rule("*@example.com")])]) {
      p.effective_since = now;
      expect(decide(p, { membership, receivedAt: before }).kind).toBe("silent");
      expect(decide(p, { membership }).kind).toBe("allowed");
    }
  });
  it("only considers absent memberships for explicitly enabled first-contact requests", () => {
    const p = policy();
    p.allow_contact_requests = true;
    p.contact_request_since = before;
    p.contact_request_generation = "b".repeat(64);
    expect(decide(p).kind).toBe("request");
    expect(decide(p, { contactRequests: false }).kind).toBe("silent");
    expect(decide(p, { membership: { notify: false } }).kind).toBe("silent");
    expect(
      decide(p, {
        membership: { ...membership, notifySince: "2026-09-03T00:00:00.000Z" },
      }).kind,
    ).toBe("silent");
  });
  it("requires complete, canonical policy metadata before authorizing anything", () => {
    const p = policy([rule("*@example.com")]);
    expect(parseAgentContactPolicy(p, p.agent_address)).toEqual(p);
    for (const invalid of [
      { ...p, agent_address: "other@example.net" },
      { ...p, effective_version: undefined },
      { ...p, org_policy: { ...p.org_policy, rules: [rule("*@*")] } },
      {
        ...p,
        org_policy: {
          ...p.org_policy,
          rules: [...p.org_policy.rules, ...p.org_policy.rules],
        },
      },
      {
        ...p,
        agent_policy: { ...p.agent_policy, allow_contact_requests: true },
      },
      { ...p, org_policy: { ...p.org_policy, version: null } },
    ])
      expect(() => parseAgentContactPolicy(invalid, p.agent_address)).toThrow();
  });
});
