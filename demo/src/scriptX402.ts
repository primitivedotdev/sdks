// Storyline: "x402 agent-to-agent payments" — the launch-week-02 companion to
// the agent-signup clip. We watch ONE agent's run transcript: mid-task it needs
// a GPU compute job it can't run locally, reaches a compute-provider agent over
// email, clears the payment ITSELF, and gets the result back in the thread.
//
// TRUTHFULNESS (this feature is SDK-driven, not auto-wired to email — verified
// in primitive-mono-repo):
//   - x402 today is explicit SDK calls: the payee calls `x402.charge()` to quote
//     a price; the payer calls `x402.pay(challenge, { signer })` to sign locally
//     and settle. There is NO platform mechanism that auto-injects a 402 onto an
//     email reply (x402.ts mints a SYNTHETIC interaction_id `${uuid}@x402
//     .primitive`; x402_challenges has no FK to any email/thread; engine.test.ts
//     notes interaction-wiring is future work: "approval/x402 WILL"). So this
//     transcript shows the AGENT doing the work: the provider quoted with one
//     charge() call and emailed the challenge back; our agent reads it and pays.
//     Email is the (real) channel; the payment is an explicit (real) SDK action.
//   - Every transcript line maps to a real op: sending/receiving email is core
//     Primitive; `x402.pay()` → POST /v1/x402/challenges/:id/pay; the spend
//     policy (kill-switch / per-payment / daily / allowlist) is enforced
//     server-side on pay; `settle_tx` is the real on-chain hash from the x402
//     facilitator. `buyer-agent.ts` is illustrative glue around those calls.
//   - base-sepolia is the demoable network (settles for free via the public
//     facilitator; mainnet `base` is real USDC). Amounts are testnet USDC base
//     units (6 decimals): "2000000" = 2 USDC, "5000000"/"50000000" = 5/50 USDC.
//   - Persona address (gpu-farm.primitive.email) is a demo identity, per the
//     other clips; the SECRET/unknowable values are truncated for display, never
//     invented: the resolved `pay_to` (0x…), the on-chain `settle_tx` (0x…).
//
// Source of truth: sdks/sdk-node/src/x402/client.ts (charge/pay/setSpendPolicy),
// README "x402 agent-to-agent payments"; packages/api/src/routes/v1/x402.ts.

import type { Section } from "./script";

export const x402IntroTitle = "primitive";
export const x402Caption = "agent payments";
// Outro reference: install the SDK that ships the x402 client.
export const x402OutroInstall = "npm i @primitivedotdev/sdk";
export const x402OutroRepo = "primitive.dev/blog/launch-week-02";

export const x402Sections: Section[] = [
  {
    id: "job",
    label: "1 · The job",
    explainer: {
      heading: "Your agent needs compute",
      body: "Mid-task it needs a GPU job it can't run locally. It reaches a compute-provider agent over email and gets back a price — not a signup wall. The provider quoted it with one x402 call; our agent just reads the reply.",
    },
    entries: [
      { kind: "command", text: "npx tsx buyer-agent.ts", cps: 60, hold: 44 },
      {
        kind: "output",
        perLine: 4,
        lines: [
          { text: "job: embed 2M documents — no local GPU", tone: "accent" },
          { text: "→ emailing jobs@gpu-farm.primitive.email …", tone: "dim" },
          { text: "← reply: queued · 2 USDC to start the run", tone: "amber" },
        ],
        hold: 16,
      },
    ],
  },
  {
    id: "pay",
    label: "2 · Clear it",
    explainer: {
      heading: "It pays — within your limits",
      body: "The agent signs an EIP-3009 authorization with its own key (the key never leaves it) and Primitive settles on Base. Non-custodial. It stays inside the spend policy you set — over the cap, the payment is declined and logged.",
    },
    entries: [
      { kind: "blank" },
      {
        kind: "output",
        perLine: 4,
        lines: [
          { text: "→ challenge: 2 USDC · base-sepolia", tone: "default" },
          { text: "  pay_to 0x8f3c…b21c", tone: "dim" },
          { text: "→ spend policy: ≤5 USDC · ≤50/day  ✓ ok", tone: "default" },
          { text: "→ signing transferWithAuthorization …", tone: "dim" },
          { text: "→ x402.pay() → settled ✓", tone: "success" },
          { text: "  tx 0x…  ↗ basescan", tone: "url" },
        ],
        hold: 18,
      },
    ],
  },
  {
    id: "settled",
    label: "3 · Settled",
    explainer: {
      heading: "Work comes back, with a receipt",
      body: "The provider runs the job and returns the result in the same thread. One email exchange, one on-chain payment — no invoice, no Stripe account, no human in the loop — and a receipt you can audit.",
    },
    entries: [
      { kind: "blank" },
      {
        kind: "output",
        perLine: 4,
        lines: [
          { text: "← job complete · 2M embeddings ready", tone: "accent" },
          { text: "→ replying to the thread with the output", tone: "dim" },
          { text: "✓ done · paid 2 USDC · 0 humans · 1 thread", tone: "success" },
        ],
        hold: 14,
      },
    ],
  },
];
