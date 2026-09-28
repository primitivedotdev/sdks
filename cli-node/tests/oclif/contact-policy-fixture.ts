import type { AgentContactPolicy } from "../../src/oclif/contact-policy.js";

export function emptyContactPolicy(recipient: string): AgentContactPolicy {
  const document = {
    rules: [],
    contact_request_since: null,
    contact_request_generation: null,
    version: null,
    updated_at: null,
  };
  return {
    agent_address: recipient,
    org_policy: { ...document, allow_contact_requests: false },
    agent_policy: { ...document, allow_contact_requests: null },
    effective_version: "a".repeat(64),
    effective_since: "2026-01-01T00:00:00.000Z",
    allow_contact_requests: false,
    contact_request_since: null,
    contact_request_generation: null,
  };
}
