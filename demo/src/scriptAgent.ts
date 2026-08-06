// Storyline 2: "Give your agent email." Same brand + terminal machinery as the
// SDK demo, different transcript. Every line is grounded in real product
// behavior:
//   - beat 1: the agent gets an email via the CLI — real `primitive signup`
//     (terms + 6-digit code, captured from a real staging run) and `primitive
//     whoami` (formatWhoamiSummary), whose "Managed inbox: any-local-part@..."
//     line is the agent's assigned *.primitive.email address.
//   - beat 2: real `primitive functions init` scaffold output (email-reply
//     template) + trimmed real lines from the mono-repo dev-help-agent handler
//     (apps/dev-help-agent-fn/handler.ts).
//   - beat 3: real `primitive functions deploy` output — CreateFunctionResult
//     {id,name,deploy_status} JSON + the route-bound stderr hint.
//   - beat 4: real `primitive chat` transcript shape (cli-node .../chat.ts
//     formatChatResponse); the reply body is an accurate answer about the real
//     /v1/send-mail API. Identity is the demo persona (agent@acme.dev).

import type { Section } from "./script";

export const agentIntroTitle = "primitive";
export const agentIntroTagline = "give your agent email";

export const agentSections: Section[] = [
  {
    id: "email",
    label: "1 · Give your agent email",
    entries: [
      { kind: "command", text: "primitive signup agent@acme.dev", cps: 26, hold: 8 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "By continuing, you agree to Primitive's Terms of Service and Privacy Policy:" },
          { text: "  https://primitive.dev/terms", tone: "url" },
          { text: "  https://primitive.dev/privacy", tone: "url" },
        ],
        hold: 4,
      },
      { kind: "command", prefix: "Type 'yes' to continue: ", prefixTone: "default", text: "yes", cps: 9, hold: 10 },
      {
        kind: "output",
        perLine: 7,
        lines: [
          { text: "Sent a 6-digit verification code to agent@acme.dev." },
          { text: "Run `primitive signup confirm agent@acme.dev <code>` to finish.", tone: "dim" },
        ],
        hold: 14,
      },
      { kind: "blank" },
      { kind: "command", text: "primitive signup confirm agent@acme.dev 418207", cps: 26, hold: 10 },
      {
        kind: "output",
        perLine: 8,
        lines: [{ text: "Logged in to org 6b21f4e0-9c3a-4d77-b1e2-3f8a0c5d1e94 (Acme).", tone: "success" }],
        hold: 12,
      },
      { kind: "blank" },
      { kind: "command", text: "primitive whoami", cps: 24, hold: 10 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "Authenticated as agent@acme.dev" },
          { text: "Account id: 9b3c1a7e-2f44-4d18-bc60-1e5a7d2c9f01", tone: "dim" },
          { text: "Plan: free", tone: "dim" },
          { text: "Managed inbox: any-local-part@swift-fox.primitive.email", tone: "accent" },
        ],
        hold: 28,
      },
    ],
  },
  {
    id: "build",
    label: "2 · Build the agent",
    entries: [
      { kind: "blank" },
      { kind: "command", text: "primitive functions init dev-help-agent", cps: 26, hold: 10 },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "Scaffolded ~/dev-help-agent from email-reply template." },
          { text: "Next:", tone: "dim" },
          { text: "  cd ~/dev-help-agent", tone: "dim" },
          { text: "  npm install", tone: "dim" },
          { text: "  npm run deploy", tone: "dim" },
        ],
        hold: 16,
      },
      { kind: "blank" },
      { kind: "command", text: "cat handler.ts", cps: 22, hold: 10 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "import { createPrimitiveClient, normalizeReceivedEmail }", tone: "dim" },
          { text: "  from '@primitivedotdev/sdk/api'", tone: "dim" },
          { text: "" },
          { text: "const ALLOWED_RECIPIENT = 'dev_help@agent.primitive.dev'" },
          { text: "" },
          { text: "// receive the email, ask the model, reply with the answer", tone: "dim" },
          { text: "const email = normalizeReceivedEmail(event)" },
          { text: "const question = buildQuestion(email.subject, email.text)" },
          { text: "const answer = await askAgent(env, question)" },
          { text: "" },
          { text: "const client = createPrimitiveClient({ apiKey: env.PRIMITIVE_API_KEY })" },
          { text: "await client.reply(email, { text: answer })", tone: "accent" },
        ],
        hold: 30,
      },
    ],
  },
  {
    id: "deploy",
    label: "3 · Deploy it",
    entries: [
      { kind: "blank" },
      { kind: "command", text: "primitive functions deploy --name dev-help-agent --file ./dist/handler.js", cps: 34, hold: 14 },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "{" },
          { text: '"id": "a3f2c1d4-7b8e-4a90-bc11-2e6f5a0d9c34",', tone: "string", indent: 2 },
          { text: '"name": "dev-help-agent",', tone: "string", indent: 2 },
          { text: '"deploy_status": "deployed"', tone: "accent", indent: 2 },
          { text: "}" },
          { text: "" },
          { text: "Route bound. Function will receive inbound mail.", tone: "success" },
        ],
        hold: 30,
      },
    ],
  },
  {
    id: "chat",
    label: "4 · Chat with it",
    entries: [
      { kind: "blank" },
      { kind: "command", text: 'primitive chat dev_help@agent.primitive.dev "How do I send an email with the API?"', cps: 36, hold: 10 },
      {
        kind: "output",
        perLine: 6,
        lines: [{ text: "Message sent; waiting for reply from dev_help@agent.primitive.dev", tone: "amber" }],
        hold: 26,
      },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "Reply received", tone: "success" },
          { text: "" },
          { text: "Sent", tone: "accent" },
          { text: "  To: dev_help@agent.primitive.dev", tone: "dim" },
          { text: "  From: agent@acme.dev", tone: "dim" },
          { text: "  Subject: How do I send an email with the API?", tone: "dim" },
          { text: "  Delivery status: delivered", tone: "success" },
          { text: "" },
          { text: "Reply", tone: "accent" },
          { text: "  From: dev_help@agent.primitive.dev", tone: "dim" },
          { text: "  Subject: Re: How do I send an email with the API?", tone: "dim" },
          { text: "  Received: 2026-06-15T17:42:08Z", tone: "dim" },
          { text: "  Match: fallback, matched by sender/time window", tone: "dim" },
        ],
        hold: 10,
      },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "Response body (text; use --json for parsing)", tone: "accent" },
          { text: "----- BEGIN RESPONSE -----", tone: "dim" },
          { text: "Send a POST to https://api.primitive.dev/v1/send-mail with" },
          { text: "Authorization: Bearer prim_<key> and a JSON body:" },
          { text: '{ "from", "to", "subject", "body_text" }.', tone: "string" },
          { text: "Add an Idempotency-Key header so retries are safe." },
          { text: "----- END RESPONSE -----", tone: "dim" },
        ],
        hold: 55,
      },
    ],
  },
];
