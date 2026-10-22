export interface FunctionTemplateAuthor {
  id: string;
  name: string;
  url?: string;
}

export interface FunctionTemplateFile {
  relativePath: string;
  contents: string;
}

export interface FunctionTemplateRenderParams {
  name: string;
}

export interface FunctionTemplate {
  id: string;
  title: string;
  summary: string;
  description: string;
  author: FunctionTemplateAuthor;
  tags: string[];
  dependencies: string[];
  devDependencies: string[];
  secrets: string[];
  files: (params: FunctionTemplateRenderParams) => FunctionTemplateFile[];
}

export interface FunctionTemplateSummary {
  id: string;
  title: string;
  summary: string;
  description: string;
  author: FunctionTemplateAuthor;
  tags: string[];
  dependencies: string[];
  devDependencies: string[];
  secrets: string[];
}

export const DEFAULT_FUNCTION_TEMPLATE_ID = "email-reply";

export const PRIMITIVE_TEAM_AUTHOR: FunctionTemplateAuthor = {
  id: "primitive-team",
  name: "Primitive Team",
  url: "https://primitive.dev",
};

// The SDK version range that ships in the scaffolded package.json's
// dependencies. Pinned to the current shipped minor with a caret so
// patch releases of the SDK pick up automatically. Update alongside
// any minor or major version bump of the SDK so scaffolded projects
// use the same SDK version this CLI release was tested against.
const SDK_VERSION_RANGE = "^2.0.0";

// The CLI version range that ships in the scaffolded devDependencies.
// Pinned separately from SDK_VERSION_RANGE because primitive
// and @primitivedotdev/sdk are independent packages on independent
// release cadences. Coupling them silently breaks `npm install` in
// every scaffolded project the day we bump one without publishing the
// other. Must include this CLI's own version: a `primitive
// functions:init` run from CLI v1.2.3 should scaffold a project that
// resolves at least v1.2.3, so the user does not silently downgrade
// the bin under themselves. The lockstep test in functions-init.test.ts
// enforces that invariant.
const CLI_VERSION_RANGE = "^1.72.0";

// esbuild version range. Pinned to the latest stable major used
// elsewhere in the Primitive codebase for bundling Workers-style
// handlers. Caret range so patch fixes flow in automatically.
const ESBUILD_VERSION_RANGE = "^0.27.0";

// File contents for the scaffolded project. Each renderer takes the
// function name and returns the raw file body. Kept as named exports
// so the unit test can assert content without having to spin up the
// oclif command lifecycle.

// The handler's loop rules (isLoop and its address helpers) are a
// rendered copy of loopReasons() in automated-mail.ts, which is also what
// `primitive inbox next` uses to skip automated mail. The copy exists
// because scaffolded user code cannot import the CLI. Change the rules
// in automated-mail.ts first; tests/oclif/automated-mail.test.ts runs
// this rendered isLoop against the same cases and fails on any drift.
export function renderHandler(): string {
  return `// env.PRIMITIVE_API_KEY, env.PRIMITIVE_WEBHOOK_SECRET, and
// env.PRIMITIVE_API_BASE_URL are auto-injected by the Primitive Functions runtime.
//
// Imports are taken from the \`/api\` subpath, NOT the package root.
// The root export pulls in webhook signing helpers that depend on
// \`node:crypto\`, which breaks Workers-style bundles. The \`/api\`
// subpath is Workers-safe and exposes everything a handler needs,
// including Web Crypto signature verification.
import {
  createPrimitiveClient,
  getThread,
  PRIMITIVE_SIGNATURE_HEADER,
  replyToEmail,
  type EmailReceivedEvent,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "@primitivedotdev/sdk/api";

interface Env {
  PRIMITIVE_API_KEY: string;
  PRIMITIVE_API_BASE_URL: string;
  PRIMITIVE_WEBHOOK_SECRET: string;
}

// Optional loop-protection knob. The reply endpoint server-defaults the
// outbound from-address from the inbound recipient, so most handlers
// do not need to fill this in. Add any extra addresses your handler
// sends from if you later switch to client.send or a custom domain.
const EXTRA_SELF_ADDRESSES: string[] = [
  // "bot@your-domain.example",
];

function extractEmailAddresses(value: string | null | undefined): string[] {
  return (
    value?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi)?.map((address) =>
      address.toLowerCase(),
    ) ?? []
  );
}

function domainPart(address: string): string | null {
  const at = address.lastIndexOf("@");
  return at === -1 ? null : address.slice(at + 1).toLowerCase();
}

function localPart(address: string): string {
  const at = address.lastIndexOf("@");
  return at === -1 ? address.toLowerCase() : address.slice(0, at).toLowerCase();
}

function inboundRecipientAddresses(event: EmailReceivedEvent): string[] {
  return [
    ...event.email.smtp.rcpt_to.flatMap(extractEmailAddresses),
    ...extractEmailAddresses(event.email.headers.to),
  ];
}

function inboundRecipientDomains(event: EmailReceivedEvent): Set<string> {
  return new Set(
    inboundRecipientAddresses(event)
      .map(domainPart)
      .filter((domain): domain is string => domain !== null),
  );
}

// Loop protection. A newly deployed Function starts as a fallback
// endpoint for managed domains and can receive bounces or auto-replies
// generated by its own outbound mail. Do not hardcode a managed suffix:
// staging, production, and custom domains all arrive through the same
// webhook shape. Derive the handler's inbound domains from the actual
// SMTP recipients instead.
//
// The default check skips:
//   - bounce notifications, which RFC 5321 requires to use an empty
//     SMTP envelope sender (MAIL FROM:<>). Replying to a null sender
//     is forbidden and would itself bounce, producing a
//     bounce-of-bounce chain. The body header on a bounce typically
//     reads "From: MAILER-DAEMON@..." which a naive From-only check
//     would treat as a normal sender, so we gate on the envelope here.
//   - direct self-mail where From equals one of the inbound recipients;
//   - mailer-daemon/postmaster bounces from the same domain as the
//     inbound, as a backup for bounces that arrive with a non-empty
//     envelope sender;
//   - any address explicitly listed in EXTRA_SELF_ADDRESSES.
//
// Anything with no identifiable sender at all (envelope + From both
// empty) is treated as a loop terminator: better to drop one ambiguous
// message than to reply blindly and loop on a bounce.
//
// Mail that declares itself automated (RFC 3834 Auto-Submitted,
// Precedence, List-* and similar headers) and ping-pong between two
// automated responders are handled separately, by automatedReasons and
// replyCapReached below. Extend this helper if you need stricter
// detection, for example a per-sender hourly reply limit.
//
// Loop protection is NOT sender authentication. The address matching
// here is deliberately loose (it exists to avoid replying to our own
// mail, where a false positive just drops one reply). If your handler
// gates any privileged action on WHO sent the email, do not reuse this
// logic or regex the From header yourself; use isTrustedSender from
// "@primitivedotdev/sdk/api", which anchors the DMARC verdict to your
// expected domain and strict-parses the From header.
export function isLoop(event: EmailReceivedEvent): boolean {
  // RFC 5321: bounce notifications use the null MAIL FROM (envelope
  // sender = empty string). Some MTAs report this as "<>" verbatim.
  // Treat either as an unambiguous bounce signal.
  const envelopeSender = (event.email.smtp.mail_from || "").trim();
  if (envelopeSender === "" || envelopeSender === "<>") return true;

  const fromAddresses = [
    ...extractEmailAddresses(event.email.headers.from),
    ...extractEmailAddresses(event.email.smtp.mail_from),
  ];
  // No identifiable sender across either envelope or header: treat as
  // a loop terminator. Was return false in the original template; that
  // returned mail with empty headers straight back into the handler
  // and let bounces with malformed bodies slip past the bounce guard
  // above.
  if (fromAddresses.length === 0) return true;

  const inboundAddresses = new Set(inboundRecipientAddresses(event));
  const inboundDomains = inboundRecipientDomains(event);
  const extraSelfAddresses = new Set(
    EXTRA_SELF_ADDRESSES.map((address) => address.toLowerCase()),
  );

  for (const from of fromAddresses) {
    if (inboundAddresses.has(from)) return true;
    if (extraSelfAddresses.has(from)) return true;

    const fromDomain = domainPart(from);
    const fromLocal = localPart(from);
    const sameInboundDomain = fromDomain ? inboundDomains.has(fromDomain) : false;
    if (
      sameInboundDomain &&
      (fromLocal === "mailer-daemon" || fromLocal === "postmaster")
    ) {
      return true;
    }
  }

  return false;
}

// Agent-to-agent loop protection. isLoop above stops bounces and
// self-mail. These stop two automated responders (two copies of this
// handler, or this handler and another agent) from answering each
// other forever:
//   - every reply is sent with Auto-Submitted: auto-replied (RFC 3834)
//     and X-Auto-Response-Suppress: All, so a responder that honours
//     them, including another copy of this handler, does not answer;
//   - mail the platform marks automated is skipped (automatedReasons);
//   - at most MAX_REPLIES_PER_THREAD replies from this handler's
//     address per thread, and none once the thread is MAX_THREAD_DEPTH
//     messages deep (replyCapReached), which holds even against a peer
//     that strips the headers above;
//   - one reply per inbound Message-ID (replyIdempotencyKey).
// Raise the caps only if you are sure a peer can never answer you back.
const MAX_REPLIES_PER_THREAD = 5;
const MAX_THREAD_DEPTH = 20;
const THREAD_LOOKUP_TIMEOUT_MS = 5000;
const AUTO_REPLY_HEADERS = {
  "Auto-Submitted": "auto-replied",
  "X-Auto-Response-Suppress": "All",
};

// The platform's verdict on whether a machine sent this email, decided
// when it arrived: the same value GET /v1/emails/{id} returns as
// \`automated\`. It covers bounces, auto-replies, and mailing list or
// newsletter mail; a handler that answers the sender should not answer
// a list. Returns the reasons, or null when a person sent it. Read
// loosely so this compiles against SDK releases that predate the typed
// field; events without it fall through to isLoop alone.
export function automatedReasons(event: EmailReceivedEvent): string[] | null {
  const email = event.email as {
    automated?: unknown;
    automated_reasons?: unknown;
  };
  if (email.automated !== true) return null;
  const reasons = Array.isArray(email.automated_reasons)
    ? email.automated_reasons.filter(
        (reason): reason is string => typeof reason === "string",
      )
    : [];
  return reasons.length > 0 ? reasons : ["automated"];
}

function ownAddresses(event: EmailReceivedEvent): Set<string> {
  return new Set([
    ...event.email.smtp.rcpt_to.flatMap(extractEmailAddresses),
    ...EXTRA_SELF_ADDRESSES.map((address) => address.toLowerCase()),
  ]);
}

// Returns why this handler must not reply again in this thread, or
// null. The thread lookup counts this handler's own earlier replies; if
// it fails or times out, the References depth check still bounds the
// thread. The thread view lists only the most recent messages, so a
// thread longer than what came back counts as capped.
export async function replyCapReached(
  client: ReturnType<typeof createPrimitiveClient>,
  event: EmailReceivedEvent,
): Promise<string | null> {
  const parsed = event.email.parsed as { references?: unknown };
  const depth = Array.isArray(parsed.references) ? parsed.references.length : 0;
  if (depth >= MAX_THREAD_DEPTH) return "thread_depth_cap";

  const threadId = event.email.thread_id;
  if (!threadId) return null;
  try {
    const result = await getThread({
      client: client.client,
      path: { id: threadId },
      signal: AbortSignal.timeout(THREAD_LOOKUP_TIMEOUT_MS),
    });
    const thread = result.data?.data;
    const messages = thread?.messages ?? [];
    if ((thread?.message_count ?? 0) > messages.length) {
      return "thread_reply_cap";
    }
    const own = ownAddresses(event);
    const replies = messages.filter(
      (message) =>
        message.direction === "outbound" &&
        extractEmailAddresses(message.from).some((address) => own.has(address)),
    ).length;
    return replies >= MAX_REPLIES_PER_THREAD ? "thread_reply_cap" : null;
  } catch (threadError) {
    console.error("thread lookup failed:", threadError);
    return null;
  }
}

// One reply per inbound message per replying address, however many
// times or through whichever relay it is delivered.
export async function replyIdempotencyKey(
  event: EmailReceivedEvent,
): Promise<string> {
  const source = [
    event.email.smtp.rcpt_to[0],
    event.email.headers.message_id ?? event.email.id,
  ].join("\\n");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return \`reply:\${hex}\`;
}

export default {
  async fetch(
    req: Request,
    env: Env,
  ): Promise<Response> {
    try {
      const rawBody = await req.text();
      const signatureHeader = req.headers.get(PRIMITIVE_SIGNATURE_HEADER) ?? "";

      try {
        await verifyWebhookSignature({
          rawBody,
          signatureHeader,
          secret: env.PRIMITIVE_WEBHOOK_SECRET,
        });
      } catch (signatureError) {
        if (signatureError instanceof WebhookVerificationError) {
          return new Response("invalid signature", { status: 401 });
        }
        throw signatureError;
      }

      const event = JSON.parse(rawBody) as EmailReceivedEvent;

      // Only "email.received" exists today. Future event types will
      // arrive with a different discriminator; return 2xx so the
      // delivery loop does not burn its retry budget on payloads you
      // intentionally skipped.
      if (event.event !== "email.received") {
        return Response.json({ ok: true, skipped: event.event });
      }

      // Loop protection runs immediately after signature verification
      // and the event-type check. See isLoop above for what's covered
      // and how to extend it.
      if (isLoop(event)) {
        return Response.json({ ok: true, skipped: "loop" });
      }
      const automated = automatedReasons(event);
      if (automated) {
        return Response.json({ ok: true, skipped: "automated", reasons: automated });
      }

      const client = createPrimitiveClient({
        apiKey: env.PRIMITIVE_API_KEY,
        apiBaseUrl: env.PRIMITIVE_API_BASE_URL,
      });
      const capped = await replyCapReached(client, event);
      if (capped) {
        return Response.json({ ok: true, skipped: capped });
      }

      // To add an LLM or another API, store its key as a Function secret.
      // Example:
      //   export OPENAI_KEY=sk-...
      //   primitive functions set-secret --id <fn-id> --key OPENAI_KEY --value-from-env OPENAI_KEY --redeploy

      // Recipient gate
      // https://www.primitive.dev/docs/sending#who-you-can-send-to
      // Even via the reply endpoint, sends to the original sender are
      // subject to the recipient gate. New accounts can send to
      // Primitive-managed domains, verified domains, addresses that
      // have authenticated to you, and other org-member signup emails.
      // Sends to arbitrary external addresses return 403
      // recipient_not_allowed with a structured gates[] array until
      // the recipient has authenticated to you or support has enabled
      // the gate.

      // Recipient routing: a single function can handle multiple inbound
      // addresses by branching on event.email.headers.to. For example,
      // route "support@" to a ticketing flow and "sales@" to a lead
      // capture flow before replying.

      // replyToEmail calls POST /v1/emails/{id}/reply (NOT /send-mail)
      // so the server derives recipients, the \`Re: <parent>\` subject,
      // threading headers, and the in_reply_to_email_id foreign key
      // automatically. The FK is what populates the inbound's
      // \`replies\` array on GET /emails/{id}; without it,
      // \`primitive functions:test-function --show-sends\` would report
      // no outbound emails for this handler because the join would
      // miss. It is used instead of client.reply because the reply
      // carries AUTO_REPLY_HEADERS (the endpoint accepts Auto-Submitted,
      // X-Auto-Response-Suppress and Precedence). Use client.send only
      // when you need to send to a different address than the inbound
      // sender, and pass \`in_reply_to\` explicitly to preserve
      // correlation.
      const replyBody = {
        body_text: "Got your message.",
        headers: AUTO_REPLY_HEADERS,
      };
      const result = await replyToEmail({
        client: client.client,
        path: { id: event.email.id },
        body: replyBody,
        headers: { "Idempotency-Key": await replyIdempotencyKey(event) },
      });
      if (result.error) {
        // A refused send (a rate limit included) is final: answer 2xx
        // so the delivery queue does not re-invoke this handler.
        return Response.json({
          ok: false,
          status: result.response?.status ?? null,
          error: result.error,
        });
      }

      return Response.json({ ok: true, reply: result.data?.data ?? null });
    } catch (err) {
      // Return 2xx so the webhook delivery loop does not retry a bug
      // it cannot fix. The function-invocation row still records the
      // error body for debugging. Flip to a 5xx status if you want
      // transient failures retried (e.g. a flaky external API you call).
      console.error("handler error:", err);
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 200 },
      );
    }
  },
};
`;
}

export function renderPackageJson(name: string): string {
  const pkg = {
    name,
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      build: "node build.mjs",
      deploy: `npm run build && primitive functions deploy --name ${name} --file ./dist/handler.js --wait`,
      "test:function":
        "primitive functions test --id $PRIMITIVE_FUNCTION_ID --wait --show-sends",
      logs: "primitive functions logs --id $PRIMITIVE_FUNCTION_ID",
      redeploy:
        "npm run build && primitive functions redeploy --id $PRIMITIVE_FUNCTION_ID --file ./dist/handler.js --wait",
    },
    dependencies: {
      "@primitivedotdev/sdk": SDK_VERSION_RANGE,
    },
    devDependencies: {
      // primitive ships the primitive bin. Including it as
      // a devDep here means `node_modules/.bin/primitive` resolves to
      // the real CLI inside the scaffolded project so `npm run deploy`
      // works without a global install. Pinned via CLI_VERSION_RANGE,
      // a dedicated constant so the version is decoupled from the SDK
      // range and bumps are explicit on both ends.
      primitive: CLI_VERSION_RANGE,
      esbuild: ESBUILD_VERSION_RANGE,
      typescript: "^5.7.2",
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

export function renderBuildMjs(): string {
  return `import { build } from "esbuild";

// Bundle handler.ts into a single ESM file suitable for the Primitive
// Functions runtime. The runtime is a Workers-style environment, so
// we pick the "worker" / "browser" export conditions on @primitivedotdev/sdk
// (which routes us to the /api subpath safely without dragging in
// node:crypto-dependent webhook helpers).

await build({
  entryPoints: ["handler.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  conditions: ["worker", "browser"],
  outfile: "dist/handler.js",
});
`;
}

export function renderTsconfig(): string {
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      strict: true,
      lib: ["ES2022", "WebWorker"],
      types: [],
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["handler.ts"],
  };
  return `${JSON.stringify(tsconfig, null, 2)}\n`;
}

export function renderGitignore(): string {
  return "node_modules\ndist\n";
}

export function renderReadme(name: string): string {
  return `# ${name}

## What this is

A Primitive Function: a JavaScript handler that runs on inbound mail.
It receives the \`email.received\` event, demonstrates a basic reply
via the Primitive SDK, and returns a JSON envelope.

## Develop

\`\`\`
npm install
npm run build
\`\`\`

## Deploy

\`\`\`
npm run deploy
\`\`\`

The deploy step calls \`primitive functions deploy --wait\` (provided
by the \`primitive\` package; install with
\`npm install -g primitive\` or run via
\`npx primitive@latest <command>\`). It requires
\`PRIMITIVE_API_KEY\` to be set in your shell (or pass \`--api-key\`).
Run \`primitive signin\` once to save a key in your CLI config if you
prefer that to an env var.

After the first deploy, copy the returned function id into your shell:

\`\`\`
export PRIMITIVE_FUNCTION_ID=<fn-id>
\`\`\`

## Bind a route

A deployed Function does not receive inbound mail until a route is
bound to it. Without this step, the Function is installed in the
runtime but unreachable, and \`functions test\` will refuse to send
(returns 422 \`no_endpoint\`).

\`\`\`
primitive functions route-set --id "$PRIMITIVE_FUNCTION_ID" --domain <domain-id>
\`\`\`

Use \`--fallback\` instead of \`--domain\` to bind the Function as the
org-wide fallback for any active domain that has no scoped binding.
Run \`primitive functions route-get --id "$PRIMITIVE_FUNCTION_ID"\` to
inspect the current binding, or \`primitive functions routing-topology\`
for the org-wide view of which domain points at which Function.

## Prove it works

\`\`\`
primitive inbox status
npm run test:function
npm run logs
\`\`\`

\`npm run test:function\` sends a real test email through MX, waits for
the Function to process it, and prints any outbound replies emitted by
the handler.

## Redeploy

\`\`\`
npm run redeploy
\`\`\`

## Secrets

Use secrets for API keys used by your handler. \`--redeploy\` makes the
new value visible to the running Function immediately.

\`\`\`
export OPENAI_KEY=sk-...
primitive functions set-secret --id "$PRIMITIVE_FUNCTION_ID" --key OPENAI_KEY --value-from-env OPENAI_KEY --redeploy
\`\`\`
`;
}

function renderEmailReplyTemplateFiles(name: string): FunctionTemplateFile[] {
  return [
    { contents: renderHandler(), relativePath: "handler.ts" },
    { contents: renderPackageJson(name), relativePath: "package.json" },
    { contents: renderBuildMjs(), relativePath: "build.mjs" },
    { contents: renderTsconfig(), relativePath: "tsconfig.json" },
    { contents: renderGitignore(), relativePath: ".gitignore" },
    { contents: renderReadme(name), relativePath: "README.md" },
  ];
}

export const FUNCTION_TEMPLATES: FunctionTemplate[] = [
  {
    author: PRIMITIVE_TEAM_AUTHOR,
    dependencies: ["@primitivedotdev/sdk"],
    description:
      "A deployable TypeScript email handler that verifies signed email.received events, skips likely loops, and replies with the Primitive SDK.",
    devDependencies: ["primitive", "esbuild", "typescript"],
    files: ({ name }) => renderEmailReplyTemplateFiles(name),
    id: DEFAULT_FUNCTION_TEMPLATE_ID,
    secrets: [],
    summary: "Reply to inbound email with the Primitive SDK.",
    tags: ["email", "reply", "typescript", "worker"],
    title: "Email Reply",
  },
];

export function functionTemplateIds(
  templates: readonly FunctionTemplate[],
): string[] {
  return templates.map((template) => template.id);
}

export function findFunctionTemplate(
  templates: readonly FunctionTemplate[],
  id: string,
): FunctionTemplate | null {
  return templates.find((template) => template.id === id) ?? null;
}

export function serializeFunctionTemplate(
  template: FunctionTemplate,
): FunctionTemplateSummary {
  return {
    author: { ...template.author },
    dependencies: [...template.dependencies],
    description: template.description,
    devDependencies: [...template.devDependencies],
    id: template.id,
    secrets: [...template.secrets],
    summary: template.summary,
    tags: [...template.tags],
    title: template.title,
  };
}

export function formatFunctionTemplateList(
  templates: readonly FunctionTemplate[],
): string {
  const lines = ["Available Primitive Function templates:", ""];

  for (const template of templates) {
    lines.push(`${template.id}`);
    lines.push(`  title: ${template.title}`);
    lines.push(`  author: ${template.author.name}`);
    lines.push(`  summary: ${template.summary}`);
    lines.push(
      `  tags: ${template.tags.length > 0 ? template.tags.join(", ") : "none"}`,
    );
    lines.push(
      `  secrets: ${
        template.secrets.length > 0 ? template.secrets.join(", ") : "none"
      }`,
    );
    lines.push("");
  }

  lines.push("Use `primitive functions init <name> --template <id>`.");
  return lines.join("\n");
}
