// Storyline: "the agent self-signup flow" — the REAL emailless, zero-touch path
// a headless agent uses to give ITSELF an identity, driven through the Primitive
// CLI. One command creates the account with no email and no human; the returned
// `prim_` API key + provisioned `*.primitive.email` inbox work immediately, on
// the reply-only `agent` plan.
//
// Source of truth (primitive-mono-repo + sdks):
//   - CLI command: `primitive agent create-agent-account` (alias `primitive
//     agent create`) — the generated `createAgentAccount` operation
//     (sdks/cli-node/src/oclif/index.ts COMMAND_ALIASES; sdks/openapi
//     /agent/accounts → operationId createAgentAccount). Generated operation
//     commands print the bare `data` object (api-command.ts
//     operationOutputPayload), so the `{ success, data }` envelope is unwrapped.
//   - Request: CreateAgentAccountInput { terms_accepted: true, device_name? }.
//   - Response: AgentAccountResult { api_key, org_id, address, plan, limits,
//     upgrade } (sdks/openapi/primitive-api.yaml). Endpoint + handler:
//     packages/api/src/routes/v1/agent.ts → createEmaillessAgentAccount.
//   - Payoff: `primitive account show` (alias for getAccount) → GET /v1/account
//     returns { …customer, plan, entitlements, managed_inbox_address, limits }
//     (packages/api/src/routes/v1/account.ts). An emailless account's `email`
//     is null — the literal "emailless" proof — and the `agent` plan grants
//     `send_mail` + `send_to_known_addresses` (reply-only).
//
// Everything shown is REAL. `address` / `managed_inbox_address` use the
// documented example `brave-crow.primitive.email` (auth.md / generateName). The
// `api_key` is a SECRET shown exactly once, so its value is elided to `prim_…`
// rather than invented; the org UUID is truncated; nested `limits` / `upgrade`
// objects are abbreviated with the `"...": "..."` convention auth.md itself
// uses. No command, flag, field name, or shape is faked.

import type { Section } from "./script";

export const agentSignupIntroTitle = "primitive";
export const agentSignupCaption = "agent signup";
// Outro reference: the actual one-command self-signup.
export const agentSignupOutroInstall = "primitive agent create-agent-account";
export const agentSignupOutroRepo = "primitive.dev/auth.md";

export const agentSignupSections: Section[] = [
  {
    id: "register",
    label: "1 · Self-register",
    explainer: {
      heading: "The agent signs itself up",
      body: "One command — no email, no human, no browser. Primitive returns a prim_ API key and a managed *.primitive.email inbox on the spot. This is the zero-touch path for headless agents.",
    },
    entries: [
      // hold ~52 (30fps-baseline) → with holdScale 1.3 + f() ≈ 2.3s pause after
      // the command runs, before the response prints.
      { kind: "command", text: "primitive agent create-agent-account --terms-accepted", cps: 60, hold: 52 },
      {
        kind: "output",
        perLine: 3,
        lines: [
          { text: "{" },
          { text: '"api_key": "prim_…",', indent: 2 },
          { text: '"org_id": "6b21f4e0-9c3a-4d77-…",', indent: 2 },
          { text: '"address": "brave-crow.primitive.email",', indent: 2 },
          { text: '"plan": "agent",', indent: 2 },
          { text: '"limits": { "send_per_hour": 10, "send_per_day": 50 },', indent: 2 },
          { text: '"upgrade": { "plan": "developer", "...": "..." }', indent: 2 },
          { text: "}" },
        ],
        hold: 12,
      },
    ],
  },
  {
    id: "use",
    label: "2 · It's live",
    explainer: {
      heading: "The key works immediately",
      body: "Bearer the new key on any call. The account is emailless (email: null) on the reply-only agent plan, with its own inbox — ready to receive mail and reply. Upgrade later by confirming an email.",
    },
    entries: [
      { kind: "blank" },
      // hold ~52 → ~2.3s pause after the command runs, before the response.
      { kind: "command", text: "primitive account show --api-key prim_…", cps: 48, hold: 52 },
      {
        kind: "output",
        perLine: 3,
        lines: [
          { text: "{" },
          { text: '"email": null,', indent: 2 },
          { text: '"plan": "agent",', indent: 2 },
          { text: '"managed_inbox_address": "brave-crow.primitive.email",', indent: 2 },
          { text: '"entitlements": ["send_mail", "send_to_known_addresses"]', indent: 2 },
          { text: "}" },
        ],
        hold: 16,
      },
    ],
  },
];
