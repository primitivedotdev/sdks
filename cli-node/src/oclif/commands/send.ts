import { Command, Errors, Flags } from "@oclif/core";
import type {
  Domain,
  ListDomainsResponse,
  SendMailResult,
  VerifiedDomain,
} from "@primitivedotdev/api-core";
import {
  listDomains,
  PrimitiveApiClient,
  sendEmail,
} from "@primitivedotdev/api-core";
import {
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  formatErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { type ResolvedCliAuth, resolveCliAuth } from "../auth.js";
import { writeIdempotentReplayBannerIfReplay } from "../idempotent-replay-banner.js";
import { resolveMessageBodies } from "../message-body-sources.js";

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

// 200 chars is a generous cap that almost never trips on natural
// first-line subjects (a sentence is typically <120 chars). The
// previous 70-char limit was tight enough that legitimate one-line
// bodies routinely produced ellipsis-truncated subjects in inbox
// listings, e.g. `"this is the simplest possible send: agent typed
// two flags and hit\\n e..."` from the AGX walkthrough. Real spam
// scoring engines don't penalize subjects under ~200 chars, so 200
// is both more useful and still well under the practical wire limit.
const SUBJECT_MAX_LENGTH = 200;

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
  authFailureContext: {
    auth: ResolvedCliAuth;
    baseUrlOverridden: boolean;
    configDir: string;
  },
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
    if (extractErrorCode(errorPayload) === API_ERROR_CODES.unauthorized) {
      writeErrorWithHints(errorPayload);
      removeStaleSavedCredentialOnUnauthorized({
        ...authFailureContext,
        payload: errorPayload,
      });
      // exit: 1 to match the run() unauthorized path (which uses
      // `process.exitCode = 1`). oclif's CLIError defaults to 2,
      // so without this override the same "unauthorized" condition
      // exits 2 when surfaced from listDomains and 1 when surfaced
      // from sendEmail, breaking callers that branch on exit code.
      throw new Errors.CLIError(
        "Cannot send: API key is missing or invalid (see hint above).",
        { exit: 1 },
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
      "No active verified outbound domain found on this account; pass --from explicitly. To set up outbound, claim a domain via `primitive domains add` and verify it.",
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
    `Send an outbound email. Agent-grade shortcut for \`sending send\` with sensible defaults.

  --from defaults to agent@<your-first-verified-outbound-domain> when omitted.
  --subject defaults to the first line of the body when omitted.

  For the full flag set (custom message-id threading on the wire,
  references arrays, etc.), use \`primitive sending send\`.`;

  static summary = "Send an email (simplified, agent-friendly)";

  static examples = [
    "<%= config.bin %> send --to alice@example.com --body 'Hi Alice!'",
    "<%= config.bin %> send --to alice@example.com --body-file ./message.txt",
    "<%= config.bin %> send --to alice@example.com --from support@yourcompany.com --subject 'Quick question' --body 'Are you free Thursday?'",
    "<%= config.bin %> send --to alice@example.com --html '<p>Hello!</p>'",
    "<%= config.bin %> send --to alice@example.com --body 'Confirmed' --wait",
    "<%= config.bin %> send --to inbox@your-managed-domain.primitive.email --body 'self-loop smoke test' --wait  # any *.primitive.email address routes back to the sending account; useful for proving outbound + inbound work end-to-end",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key (defaults to PRIMITIVE_API_KEY or saved `primitive login` credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "api-base-url-2": Flags.string({
      description:
        "Override the attachments-supporting send host base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_2",
      hidden: true,
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
    "body-file": Flags.string({
      description:
        "Read the plain-text message body from a UTF-8 file. Mutually exclusive with --body and --body-stdin.",
    }),
    "body-stdin": Flags.boolean({
      description:
        "Read the plain-text message body from stdin. Mutually exclusive with --body and --body-file. Stdin can only be consumed once.",
    }),
    html: Flags.string({
      description:
        "HTML message body. Either --body or --html (or both) is required.",
    }),
    "html-file": Flags.string({
      description:
        "Read the HTML message body from a UTF-8 file. Mutually exclusive with --html and --html-stdin.",
    }),
    "html-stdin": Flags.boolean({
      description:
        "Read the HTML message body from stdin. Mutually exclusive with --html and --html-file. Stdin can only be consumed once.",
    }),
    "in-reply-to": Flags.string({
      description:
        "Message-Id of the parent email when threading a reply on the wire. For replying to an inbound message you received, prefer `primitive reply --id <inbound-id>`.",
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the message for delivery.",
    }),
    "wait-timeout-ms": Flags.integer({
      description:
        "Maximum time to wait when --wait is set. Defaults to 30000ms.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SendCommand);

    const bodies = resolveMessageBodies({
      body: flags.body,
      bodyFile: flags["body-file"],
      bodyStdin: flags["body-stdin"],
      html: flags.html,
      htmlFile: flags["html-file"],
      htmlStdin: flags["html-stdin"],
    });
    if (bodies.kind === "error") {
      throw new Errors.CLIError(bodies.message);
    }

    await runWithTiming(flags.time, async () => {
      const baseUrlOverridden =
        flags["api-base-url-1"] !== undefined ||
        flags["api-base-url-2"] !== undefined;
      const auth = resolveCliAuth({
        apiKey: flags["api-key"],
        apiBaseUrl1: flags["api-base-url-1"],
        apiBaseUrl2: flags["api-base-url-2"],
        configDir: this.config.configDir,
      });
      const apiClient = new PrimitiveApiClient({
        apiKey: auth.apiKey,
        apiBaseUrl1: auth.apiBaseUrl1,
        apiBaseUrl2: auth.apiBaseUrl2,
      });

      const authFailureContext = {
        auth,
        baseUrlOverridden,
        configDir: this.config.configDir,
      };
      const from =
        flags.from ??
        (await pickDefaultFromAddress(apiClient, authFailureContext));
      const subject =
        flags.subject ?? (bodies.body ? deriveSubject(bodies.body) : "Message");

      const result = await sendEmail({
        body: {
          from,
          to: flags.to,
          subject,
          ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
          ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
          ...(flags["in-reply-to"] !== undefined
            ? { in_reply_to: flags["in-reply-to"] }
            : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
          ...(flags["wait-timeout-ms"] !== undefined
            ? { wait_timeout_ms: flags["wait-timeout-ms"] }
            : {}),
        },
        // /send-mail goes to the attachments-supporting host. The
        // wrapper exposes the host-2 client as _sendClient for this
        // and any other host-2 operation that lands here. Customer
        // SDK callers should use PrimitiveClient.send() instead so
        // the routing stays internal.
        client: apiClient._sendClient,
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        removeStaleSavedCredentialOnUnauthorized({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: SendMailResult } | undefined;
      // Loud stderr banner when the server returned a cached row instead
      // of putting fresh SMTP traffic on the wire. Stdout JSON is
      // unchanged so `primitive send ... | jq ...` keeps parsing.
      writeIdempotentReplayBannerIfReplay(envelope?.data, {
        write: (chunk) => {
          process.stderr.write(chunk);
        },
      });
      this.log(JSON.stringify(envelope?.data ?? null, null, 2));
    });
  }
}

export default SendCommand;
