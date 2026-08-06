// YC cut: "get any agent on the network." Minimal + explanatory, ~60s. The story
// is the SKILL: add it, then watch an agent leverage email on its own. All real.
//
//   beat 1 (add the skill): real `npx skills add primitivedotdev/skills` output
//     (skills.sh CLI — Clack ◇/● milestones; spinner frames + risk-assessment box
//     omitted for legibility, nothing altered). Installs primitive-chat +
//     primitive-inbox to every detected coding agent (Claude Code, Codex, Zed…).
//   beat 2 (agent leverages email): the agent now has the `primitive chat` verb
//     and uses it to email another agent (dev_help@agent.primitive.dev) and get
//     the answer back. Real `primitive chat` transcript shape (chat.ts
//     formatChatResponse); the reply is an accurate answer about a real CLI flow
//     (`functions set-secret --value-from-env … --redeploy`, the scaffold's own
//     documented pattern). from = agent@<managed-domain> (chat's default sender).
//
// Skill source: ~/repos/skills (github.com/primitivedotdev/skills). Identity is
// the demo persona; commands/flags/output match the real CLIs.

import type { Section } from "./script";

export const networkIntroTitle = "primitive";
export const networkIntroTagline = "get your agent on the network";
export const networkOutroInstall = "npx skills add primitivedotdev/skills";
export const networkOutroRepo = "skills.sh/primitivedotdev/skills";

export const networkSections: Section[] = [
  {
    id: "skill",
    label: "add the skill",
    explainer: {
      heading: "Add the skill",
      body: "One command teaches your coding agent — Claude Code, Codex, and 50+ others — to send email and get the reply. That's the whole on-ramp. Any product can do this.",
    },
    entries: [
      { kind: "command", text: "npx skills add primitivedotdev/skills", cps: 28, hold: 12 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "◇  Source: https://github.com/primitivedotdev/skills.git", tone: "dim" },
          { text: "◇  Repository cloned", tone: "dim" },
          { text: "◇  Found 2 skills" },
          { text: "●  Installing to: Claude Code, Codex, Zed", tone: "accent" },
          { text: "◇  Installation Summary" },
          { text: "     ./.agents/skills/primitive-chat", tone: "dim" },
          { text: "     ./.agents/skills/primitive-inbox", tone: "dim" },
          { text: "◇  Installation complete", tone: "success" },
        ],
        hold: 26,
      },
    ],
  },
  {
    id: "chat",
    label: "now it just emails",
    explainer: {
      heading: "Now it just emails",
      body: "Stuck on a tool, your agent emails the vendor's own agent and gets the answer back — one command, no SMTP, no API keys, no human in the loop.",
    },
    entries: [
      { kind: "blank" },
      {
        kind: "command",
        text: 'primitive chat dev_help@agent.primitive.dev "How do I store a secret for my Function?"',
        cps: 38,
        hold: 10,
      },
      {
        kind: "output",
        perLine: 6,
        lines: [{ text: "Message sent; waiting for reply from dev_help@agent.primitive.dev", tone: "amber" }],
        hold: 24,
      },
      {
        kind: "output",
        perLine: 5,
        lines: [
          { text: "Reply received", tone: "success" },
          { text: "" },
          { text: "Sent", tone: "accent" },
          { text: "  To: dev_help@agent.primitive.dev", tone: "dim" },
          { text: "  From: agent@swift-fox.primitive.email", tone: "dim" },
          { text: "  Delivery status: delivered", tone: "success" },
          { text: "" },
          { text: "Reply", tone: "accent" },
          { text: "  From: dev_help@agent.primitive.dev", tone: "dim" },
          { text: "  Match: fallback, matched by sender/time window", tone: "dim" },
        ],
        hold: 8,
      },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "Response body (text; use --json for parsing)", tone: "accent" },
          { text: "----- BEGIN RESPONSE -----", tone: "dim" },
          { text: "Set it as a Function secret, then read it from env in your handler:" },
          { text: "  primitive functions set-secret --id <fn-id> --key OPENAI_KEY \\" },
          { text: "    --value-from-env OPENAI_KEY --redeploy" },
          { text: "It's injected as env.OPENAI_KEY at runtime; redeploy picks it up.", tone: "dim" },
          { text: "----- END RESPONSE -----", tone: "dim" },
        ],
        hold: 50,
      },
    ],
  },
];
