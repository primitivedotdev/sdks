import { Command, Errors, Flags } from "@oclif/core";
import { listDomains, sendEmail } from "../../api/generated/sdk.gen.js";
import type {
  Domain,
  ListDomainsResponse,
  SendMailResult,
  VerifiedDomain,
} from "../../api/generated/types.gen.js";
import { PrimitiveApiClient } from "../../api/index.js";
import {
  extractErrorCode,
  extractErrorPayload,
  formatErrorPayload,
  writeErrorWithHints,
} from "../api-command.js";

// `primitive send` is the agent-grade shortcut for the most common
// case: send a fresh outbound email. It wraps `sending:send-email`
// with two ergonomic defaults that the underlying operation can't
// express through manifest-driven flag generation alone:
//
//   1. `--from` defaults to `agent@<first-verified-domain>` when
//      omitted. Most agents don't know which domains their org has
//      verified for outbound; making them list-domains first to
//      derive a from-address is exactly the kind of email-ops cruft
//      this command exists to hide. Customers with multiple
//      domains, or who want a different local-part, pass --from
//      explicitly.
//   2. `--subject` defaults to the first non-empty line of the body
//      (capped). Empty subjects get spam-scored, so we always emit
//      something. Callers who want full control pass --subject.
//
// `--body` here is the message body (text). The full `send-email`
// operation distinguishes `body_text` and `body_html`; this
// shortcut keeps it simple by exposing `--body` for text and
// `--html` for the HTML alternative. Users who need both can pass
// both flags or fall back to `sending:send-email` for the full
// flag list.
//
// Compared to `swaks` (which agents likely have in their training
// data): this is `swaks`-shaped on purpose so an agent
// pattern-matching from there lands in the happy path. We just
// don't need swaks's `--server` / `--auth-*` flags because the
// HTTPS API key is the auth and the server is implicit.

const SUBJECT_MAX_LENGTH = 70;

function deriveSubject(body: string): string {
  for (const line of body.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    return trimmed.length > SUBJECT_MAX_LENGTH
      ? `${trimmed.slice(0, SUBJECT_MAX_LENGTH - 3)}...`
      : trimmed;
  }
  return "Message";
}

function isVerifiedDomain(domain: Domain): domain is VerifiedDomain {
  return (domain as VerifiedDomain).is_active === true;
}

async function pickDefaultFromAddress(
  apiClient: PrimitiveApiClient,
): Promise<string> {
  const result = await listDomains({
    client: apiClient.client,
    responseStyle: "fields",
  });
  if (result.error) {
    const errorPayload = extractErrorPayload(result.error);
    // If the underlying failure is an auth problem, don't pretend
    // --from will fix it: the actual sendEmail call would 401 too.
    // Surface the auth hint via writeErrorWithHints and bail with
    // a focused message instead of the verbose "underlying error"
    // wrapping.
    if (extractErrorCode(errorPayload) === "unauthorized") {
      writeErrorWithHints(errorPayload);
      throw new Errors.CLIError(
        "Cannot send: API key is missing or invalid (see hint above).",
      );
    }
    throw new Errors.CLIError(
      `Could not look up your verified domains to default --from. Pass --from explicitly. Underlying error: ${formatErrorPayload(errorPayload)}`,
    );
  }
  const envelope = result.data as ListDomainsResponse | undefined;
  const first = envelope?.data?.find(isVerifiedDomain);
  if (!first) {
    throw new Errors.CLIError(
      "No active verified outbound domain found on this account; pass --from explicitly. To set up outbound, claim a domain via `primitive domains:add-domain` and verify it.",
    );
  }
  // Local-part: "agent". Any local-part is accepted on managed
  // *.primitive.email subdomains, so this works out of the box for
  // the auto-issued domain pool. For customers with BYO domains
  // and their own MX, "agent@" may or may not be a routable
  // mailbox; if you have a specific address you want to use, pass
  // --from explicitly.
  return `agent@${first.domain}`;
}

class SendCommand extends Command {
  static description =
    `Send an outbound email. Agent-grade shortcut for sending:send-email with sensible defaults.

  --from defaults to agent@<your-first-verified-outbound-domain> when omitted.
  --subject defaults to the first line of the body when omitted.

  For the full flag set (custom message-id threading on the wire,
  references arrays, etc.), use \`primitive sending:send-email\`.`;

  static summary = "Send an email (simplified, agent-friendly)";

  static examples = [
    "<%= config.bin %> send --to alice@example.com --body 'Hi Alice!'",
    "<%= config.bin %> send --to alice@example.com --from support@yourcompany.com --subject 'Quick question' --body 'Are you free Thursday?'",
    "<%= config.bin %> send --to alice@example.com --html '<p>Hello!</p>'",
    "<%= config.bin %> send --to alice@example.com --body 'Confirmed' --wait",
  ];

  static flags = {
    "api-key": Flags.string({
      description: "Primitive API key (defaults to PRIMITIVE_API_KEY)",
      env: "PRIMITIVE_API_KEY",
    }),
    "base-url": Flags.string({
      description: "API base URL (defaults to PRIMITIVE_API_URL or production)",
      env: "PRIMITIVE_API_URL",
    }),
    to: Flags.string({
      description: "Recipient address (e.g. alice@example.com).",
      required: true,
    }),
    from: Flags.string({
      description:
        "Sender address. Defaults to agent@<your-first-verified-outbound-domain>.",
    }),
    subject: Flags.string({
      description:
        "Subject line. Defaults to the first line of --body / --html when omitted.",
    }),
    body: Flags.string({
      description:
        "Plain-text message body. Either --body or --html (or both) is required.",
    }),
    html: Flags.string({
      description:
        "HTML message body. Either --body or --html (or both) is required.",
    }),
    "in-reply-to": Flags.string({
      description:
        "Message-Id of the parent email when threading a reply on the wire. For replying to an inbound message you received, prefer `primitive sending:reply-to-email --id <inbound-id>`.",
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the message for delivery.",
    }),
    "wait-timeout-ms": Flags.integer({
      description:
        "Maximum time to wait when --wait is set. Defaults to 30000ms.",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SendCommand);

    if (!flags.body && !flags.html) {
      throw new Errors.CLIError(
        "Either --body or --html (or both) is required.",
      );
    }

    const apiClient = new PrimitiveApiClient({
      apiKey: flags["api-key"],
      baseUrl: flags["base-url"],
    });

    const from = flags.from ?? (await pickDefaultFromAddress(apiClient));
    const subject =
      flags.subject ?? (flags.body ? deriveSubject(flags.body) : "Message");

    const result = await sendEmail({
      body: {
        from,
        to: flags.to,
        subject,
        ...(flags.body !== undefined ? { body_text: flags.body } : {}),
        ...(flags.html !== undefined ? { body_html: flags.html } : {}),
        ...(flags["in-reply-to"] !== undefined
          ? { in_reply_to: flags["in-reply-to"] }
          : {}),
        ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        ...(flags["wait-timeout-ms"] !== undefined
          ? { wait_timeout_ms: flags["wait-timeout-ms"] }
          : {}),
      },
      client: apiClient.client,
      responseStyle: "fields",
    });

    if (result.error) {
      writeErrorWithHints(extractErrorPayload(result.error));
      process.exitCode = 1;
      return;
    }

    const envelope = result.data as { data?: SendMailResult } | undefined;
    this.log(JSON.stringify(envelope?.data ?? null, null, 2));
  }
}

export default SendCommand;
