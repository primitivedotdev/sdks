// The transcript for the demo. Every output line below is REAL — captured by
// running the actual @primitivedotdev/cli (v1.2.0) and the Primitive API, or
// reproduced verbatim from the command source. Nothing here is invented.
//
// Sources of truth:
//   - install:  real `npm install -g @primitivedotdev/cli` + `primitive --version`
//   - signup:   real run against staging (terms text, "Sent a 6-digit ...",
//               "The code expires in 30 minutes."); confirm lines from
//               cli-node/src/oclif/commands/signup.ts L800-803.
//   - inbox:    cli-node/src/oclif/commands/inbox-setup.ts formatInboxSetupGuide,
//               populated from a real getInboxStatus response (ready account).
//   - send:     a REAL authenticated /send-mail envelope captured with wait:true
//               (queue_id null, 64-hex client_idempotency_key, real smtp_* and
//               delivery_status fields). CLI prints the inner data object via
//               JSON.stringify(data, null, 2).
//   - version:  real `primitive --version` on this machine (node-v25.9.0).
//
// Identity is a clean demo persona (you@acme.dev / Acme / acme.dev + the managed
// receive domain swift-fox.primitive.email). Persona substitutions are limited
// to: email/org name/domain names, the org UUID, and the placeholder OTP 418207.
// The command flow, flags, messages, field names, value FORMATS, and formatting
// are exactly what the CLI emits. The inbox readiness counts (3 endpoints /
// 7 Functions) and the send envelope are real captured values.

export type Tone = "default" | "dim" | "success" | "url" | "accent" | "key" | "string" | "amber";

export interface OutLine {
  text: string;
  tone?: Tone;
  indent?: number;
}

export interface CommandEntry {
  kind: "command";
  prefix?: string;
  prefixTone?: Tone;
  text: string;
  cps?: number;
  hold?: number;
}

export interface OutputEntry {
  kind: "output";
  lines: OutLine[];
  perLine?: number;
  hold?: number;
}

export interface BlankEntry {
  kind: "blank";
}

export type Entry = CommandEntry | OutputEntry | BlankEntry;

export interface Explainer {
  // Plain-language narration for the side panel (non-technical audience).
  heading: string;
  body: string;
}

export interface Section {
  id: string;
  label: string;
  explainer?: Explainer;
  entries: Entry[];
}

// Brand voice from the marketing site: lowercase wordmark, "email for agents".
export const introTitle = "primitive";
export const introTagline = "email for agents";
export const outroInstall = "npm i -g @primitivedotdev/cli";
export const outroRepo = "github.com/primitivedotdev/sdks";

export const sections: Section[] = [
  {
    id: "install",
    label: "1 · Install",
    explainer: {
      heading: "Install the tool",
      body: "We start by installing Primitive's command-line tool. One line adds it to your computer — no dashboard and no setup to click through.",
    },
    entries: [
      { kind: "command", text: "npm install -g @primitivedotdev/cli", cps: 28, hold: 12 },
      {
        kind: "output",
        perLine: 4,
        lines: [
          { text: "" },
          { text: "added 65 packages in 1s", tone: "dim" },
          { text: "" },
          { text: "15 packages are looking for funding", tone: "dim" },
          { text: "  run `npm fund` for details", tone: "dim" },
        ],
        hold: 16,
      },
      { kind: "command", text: "primitive --version", cps: 26, hold: 10 },
      {
        kind: "output",
        lines: [{ text: "@primitivedotdev/cli/1.2.0 darwin-arm64 node-v25.9.0", tone: "dim" }],
        hold: 26,
      },
    ],
  },
  {
    id: "signup",
    label: "2 · Sign up",
    explainer: {
      heading: "Create an account",
      body: "You can sign up right here in the terminal. Primitive emails you a 6-digit code to confirm it's really you, then logs you in — no browser needed.",
    },
    entries: [
      { kind: "blank" },
      { kind: "command", text: "primitive signup you@acme.dev", cps: 24, hold: 8 },
      {
        kind: "output",
        perLine: 6,
        lines: [
          { text: "By continuing, you agree to Primitive's Terms of Service and Privacy Policy:" },
          { text: "  https://primitive.dev/terms", tone: "url" },
          { text: "  https://primitive.dev/privacy", tone: "url" },
        ],
        hold: 6,
      },
      // The prompt and the user's typed "yes" share one line in a real TTY.
      { kind: "command", prefix: "Type 'yes' to continue: ", prefixTone: "default", text: "yes", cps: 9, hold: 12 },
      {
        kind: "output",
        perLine: 7,
        lines: [
          { text: "Sent a 6-digit verification code to you@acme.dev." },
          { text: "The code expires in 30 minutes.", tone: "dim" },
          { text: "Run `primitive signup confirm you@acme.dev <code>` to finish.", tone: "dim" },
        ],
        hold: 18,
      },
      { kind: "blank" },
      { kind: "command", text: "primitive signup confirm you@acme.dev 418207", cps: 26, hold: 10 },
      {
        kind: "output",
        perLine: 8,
        lines: [
          { text: "Logged in to org 6b21f4e0-9c3a-4d77-b1e2-3f8a0c5d1e94 (Acme).", tone: "success" },
          { text: "Saved credentials to ~/.config/primitive/credentials.json.", tone: "dim" },
        ],
        hold: 26,
      },
    ],
  },
  {
    id: "inbox",
    label: "3 · Inbox",
    explainer: {
      heading: "Your inbox is ready",
      body: "Every new account comes with a real email address your AI agents can receive mail at — already set up and ready to go.",
    },
    entries: [
      { kind: "blank" },
      { kind: "command", text: "primitive inbox setup", cps: 26, hold: 10 },
      {
        kind: "output",
        perLine: 4,
        lines: [
          { text: "Inbound setup", tone: "accent" },
          { text: "" },
          { text: "Inbound mail is ready and at least one processing route is enabled." },
          { text: "" },
          { text: "Readiness: ready", tone: "success" },
          { text: "Receiving: yes", tone: "success" },
          { text: "Processing: yes", tone: "success" },
          { text: "Mode: actively processed", tone: "dim" },
          { text: "" },
          { text: "Receive address: inbox@swift-fox.primitive.email", tone: "accent" },
          { text: "Receive domain: swift-fox.primitive.email (Primitive-managed)", tone: "dim" },
          { text: "" },
          { text: "Domains" },
          { text: "- acme.dev: ready, receive yes, process yes, routes 1", tone: "dim" },
          { text: "- swift-fox.primitive.email: ready, receive yes, process yes, routes 1", tone: "dim" },
          { text: "" },
          { text: "Processing routes: 3 enabled endpoint(s), 7 deployed Function(s)" },
        ],
        hold: 28,
      },
    ],
  },
  {
    id: "send",
    label: "4 · Send",
    explainer: {
      heading: "Send an email",
      body: "One command sends a real email through Primitive — and it waits for the receiving mail server to confirm delivery with a “250 OK”.",
    },
    entries: [
      { kind: "blank" },
      { kind: "command", text: "primitive send --to inbox@swift-fox.primitive.email \\", cps: 26 },
      { kind: "command", prefix: "  ", prefixTone: "dim", text: '--subject "Hello from the CLI" \\', cps: 30 },
      {
        kind: "command",
        prefix: "  ",
        prefixTone: "dim",
        text: '--body "Sent straight from my terminal." --wait',
        cps: 34,
        hold: 14,
      },
      {
        // Real /send-mail envelope captured from a genuine authenticated send
        // (wait:true). queue_id is null, client_idempotency_key is a 64-hex
        // digest, and the smtp_* / delivery_status fields are the real wait
        // outcome. Only the from/to addresses are mapped to the demo persona.
        kind: "output",
        perLine: 4,
        lines: [
          { text: "{" },
          { text: '"id": "238772f2-81fe-4f98-9829-93c6a546b79d",', tone: "string", indent: 2 },
          { text: '"status": "delivered",', tone: "accent", indent: 2 },
          { text: '"from": "agent@acme.dev",', tone: "string", indent: 2 },
          { text: '"queue_id": null,', tone: "dim", indent: 2 },
          { text: '"accepted": [', tone: "string", indent: 2 },
          { text: '"inbox@swift-fox.primitive.email"', tone: "string", indent: 4 },
          { text: "],", indent: 2 },
          { text: '"rejected": [],', tone: "string", indent: 2 },
          { text: '"client_idempotency_key": "24f940d0db002e08bcda7d7d9b610511752dd8e6fa29be51a825ff47a8ff83a4",', tone: "string", indent: 2 },
          { text: '"request_id": "a694fd98-f3f2-4365-88ab-0f82447c8b28",', tone: "string", indent: 2 },
          { text: '"content_hash": "d5456fb6ad9a7c4d796f5f6f08f79b7f5a560a5b13cbfb7b823c69f75630cd90",', tone: "string", indent: 2 },
          { text: '"idempotent_replay": false,', tone: "dim", indent: 2 },
          { text: '"delivery_status": "delivered",', tone: "success", indent: 2 },
          { text: '"smtp_response_code": 250,', tone: "success", indent: 2 },
          { text: '"smtp_response_text": "250 2.0.0 Ok: message accepted",', tone: "string", indent: 2 },
          { text: '"smtp_enhanced_status_code": "2.0.0"', tone: "dim", indent: 2 },
          { text: "}" },
        ],
        hold: 50,
      },
    ],
  },
];
