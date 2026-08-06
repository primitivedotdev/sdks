// Combined demo: sign up → deploy a Function → add the skill → chat with it.
// Explained side-panel cut, ~60s, screen clears between phases, benchmarks slide
// at the end. Headings / side content are lowercase; terminal lines keep CLI
// casing. ids/codes/domains are clean mocks (OK per direction); the deployed
// agent (dev_help) is what we chat at dev_help@agent.acme.com.

import type { Section } from "./script";

export const combinedIntroTitle = "primitive";
export const combinedIntroTagline = "email infrastructure built for agents";

const FN_ID = "f7c0e9a2";

export const combinedSections: Section[] = [
  {
    id: "signup",
    label: "1 · sign up",
    explainer: {
      heading: "get on the network",
      body: "this is all it takes to put an agent on the network: one signup, one code. it now has its own email address.",
    },
    entries: [
      { kind: "command", text: "primitive signup you@acme.dev --accept-terms", cps: 30, hold: 8 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "Sent a 6-digit verification code to you@acme.dev." },
          { text: "Run `primitive signup confirm you@acme.dev <code>` to finish.", tone: "dim" },
        ],
        hold: 8,
      },
      { kind: "command", text: "primitive signup confirm you@acme.dev 481920", cps: 30, hold: 8 },
      { kind: "output", perLine: 6, lines: [{ text: "Logged in to org acme (Acme).", tone: "success" }], hold: 6 },
      { kind: "command", text: "primitive whoami", cps: 26, hold: 8 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "Authenticated as you@acme.dev" },
          { text: "Managed inbox: any@agent.acme.com", tone: "accent" },
        ],
        hold: 18,
      },
    ],
  },
  {
    id: "deploy",
    label: "2 · deploy an agent",
    explainer: {
      heading: "deploy an agent",
      body: "ship a function that runs on every email your agent receives — live at your address in one command.",
    },
    entries: [
      { kind: "command", text: "primitive functions init dev_help --template support", cps: 30, hold: 6 },
      { kind: "output", perLine: 6, lines: [{ text: "Scaffolded ~/dev_help from support template.", tone: "dim" }], hold: 8 },
      { kind: "command", text: "primitive functions deploy --name dev_help --source . --wait", cps: 34, hold: 8 },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "{" },
          { text: `"id": "${FN_ID}",`, tone: "string", indent: 2 },
          { text: '"name": "dev_help",', tone: "string", indent: 2 },
          { text: '"deploy_status": "deployed"', tone: "accent", indent: 2 },
          { text: "}" },
          { text: "" },
          { text: "any agent can now send to dev_help@agent.acme.com", tone: "success" },
        ],
        hold: 18,
      },
    ],
  },
  {
    id: "chat",
    label: "3 · use the cli & chat",
    explainer: {
      heading: "use the cli and chat",
      body: "any agent can leverage the primitive cli to communicate with you and handle your requests.",
    },
    entries: [
      { kind: "command", text: 'primitive chat dev_help@agent.acme.com "how to add a secret?"', cps: 36, hold: 8 },
      {
        kind: "output",
        perLine: 6,
        lines: [{ text: "Message sent; waiting for reply from dev_help@agent.acme.com", tone: "amber" }],
        hold: 14,
      },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "Reply received", tone: "success" },
          { text: "" },
          { text: "Response body (text)", tone: "accent" },
          { text: "----- BEGIN RESPONSE -----", tone: "dim" },
          { text: "Store it as a Function secret, then read it from env:" },
          { text: "  primitive functions set-secret --key OPENAI_KEY \\" },
          { text: "    --value-from-env OPENAI_KEY --redeploy" },
          { text: "It's injected as env.OPENAI_KEY at runtime." },
          { text: "----- END RESPONSE -----", tone: "dim" },
        ],
        hold: 40,
      },
    ],
  },
];
