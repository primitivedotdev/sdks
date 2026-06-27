import { Command, Flags } from "@oclif/core";
import type { EmailDetail, SendMailResult } from "@primitivedotdev/api-core";
import { getEmail, sendEmail } from "@primitivedotdev/api-core";
import type {
  BuiltPaymentStep,
  X402EmailChallenge,
} from "@primitivedotdev/sdk/x402";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  API_ERROR_CODES,
  extractErrorCode,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { hasStoredCliLogin } from "../auth.js";
import { writeIdempotentReplayBannerIfReplay } from "../idempotent-replay-banner.js";
import { deriveEmailChallengeFromInbound } from "./payments-email-challenge.js";
import { readEmailChallenge } from "./payments-pay-email-step.js";
import {
  pollForSettlementInteraction,
  settlementWaitNotice,
} from "./payments-settlement.js";
import {
  PRIVATE_KEY_ENV,
  PRIVATE_KEY_FLAG_DESCRIPTION,
  reportX402Error,
  signEmailChallenge,
} from "./payments-shared.js";

/**
 * True when none of the explicit challenge sources are present (no --challenge,
 * no --challenge-file, and stdin is an interactive TTY rather than a pipe). In
 * that case `pay-email` auto-derives the challenge from the inbound email's
 * interaction.json attachment. We treat a TTY stdin as "no challenge piped" so
 * the one-shot does not block on readFileSync(0) waiting for the user to paste.
 */
export function shouldDeriveChallenge(flags: {
  challenge?: string;
  "challenge-file"?: string;
}): boolean {
  // Auto-derive whenever no explicit challenge source is given. This is the
  // headline one-command flow (`pay-email --in-reply-to <id>`) and it must work
  // identically in an interactive terminal, in CI, and in Docker. We do NOT key
  // this on `process.stdin.isTTY`: in CI / Docker / any non-interactive process
  // stdin is not a TTY even though nothing is piped, so a TTY check would skip
  // derivation there and then block on / mis-parse stdin. Unlike `pay-email-step`
  // (a sign-only primitive that still reads a piped challenge from stdin),
  // `pay-email` derives from --in-reply-to by default; pass --challenge /
  // --challenge-file to override.
  return flags.challenge === undefined && flags["challenge-file"] === undefined;
}

// `primitive payments pay-email` is the one-shot payer side of an email-native
// x402 payment: it SIGNs the challenge and SENDs the signed `interaction.json`
// as a fresh message in a single step, so the payer does not have to run
// `pay-email-step` and then a separate `send --attachment` by hand.
//
// Why send, not reply: the reply endpoint deduplicates by parent thread, and
// every x402 challenge to the same payer shares the subject "Payment request:
// x402.payment", so all challenges to that payer thread together. Once any
// reply exists in that thread, a subsequent reply is deduped as an idempotent
// replay and no mail goes on the wire, so the payment never reaches the payee
// and the challenge never settles. The send endpoint has no such dedup, so it
// delivers reliably; the interaction is associated by the `interaction.json`'s
// own `interaction_id`, not by thread-level reply matching.
//
// CRITICAL: do NOT set `in_reply_to` (the inbound challenge's Message-Id) on
// the outgoing send, and do not "restore threading" by adding it back. The
// send endpoint applies the SAME parent-thread dedup as reply whenever
// `in_reply_to` references a thread that already has a reply. Because every
// x402 challenge to a given payer shares the "Payment request: x402.payment"
// subject and threads together, setting the Message-Id makes the second and
// later one-shots dedup to a no-op (`idempotent_replay: true`,
// `dedup_reason: "parent_already_replied"`): no mail goes on the wire and the
// payment never settles. Sending WITHOUT `in_reply_to` settles every time. The
// payment associates by the interaction.json's `interaction_id`, so email
// threading is unnecessary for correctness and only reintroduces the bug.
//
// Addressing is still derived from the inbound challenge email the payer
// received: --in-reply-to is that inbound email's id. We fetch it to derive the
// payer (its recipient, used as the send From) and the payee (its sender, used
// as the send To). Its Message-Id is intentionally NOT used (see above). Pass
// --from only to override the derived payer From (e.g. a display name or
// alternate verified address).
//
// The signing path is shared byte-for-byte with `pay-email-step` via
// `signEmailChallenge`; the only addition here is delivering the result.

// PAYER ORG CONTEXT (the prod-testing bug this fixes).
//
// `pay-email` reads the payer's OWN inbox: it fetches the inbound challenge
// email (--in-reply-to), downloads that email's interaction.json attachment, and
// (with --wait-settle) polls the inbox for the settlement receipt. All three
// reads must be scoped to the account that received the challenge: the payer's
// logged-in account.
//
// The trap: the `--api-key` flag also reads `PRIMITIVE_API_KEY` from the env, so
// a stray `PRIMITIVE_API_KEY` (commonly exported for OTHER CLI work, e.g. an
// issuer/payee key) silently becomes the auth for the inbox reads. When that key
// belongs to a DIFFERENT org than the payer's logged-in account, the challenge
// email lives in the payer's org but the lookup runs in the key's org, so
// getEmail returns "Email not found" and paying fails with a confusing error.
// Payers very commonly have `PRIMITIVE_API_KEY` set, so this bites in practice.
//
// Precedence we choose (and why it is safe):
//   1. An EXPLICIT `--api-key <value>` on the command line always wins. The user
//      asked for that org on purpose; honor it unchanged.
//   2. Otherwise, if `PRIMITIVE_API_KEY` is set ONLY via the environment AND a
//      logged-in session exists on disk, ignore the env key and use the stored
//      login. The inbox belongs to the logged-in account, so this is the org
//      that can actually see the challenge.
//   3. With no stored login, keep the env key (it is the only auth available);
//      a wrong-org key then still produces the clear hint below rather than a
//      bare "Email not found".
//
// This is scoped to `pay-email` only: it is the one command whose correctness
// depends on reading the *payer's own* inbox. Other `payments`/`emails` commands
// keep the existing flag/env-over-login precedence untouched.

/**
 * Decide the api-key `pay-email` should authenticate its inbox reads with, given
 * the parsed flag value, whether `--api-key` was passed explicitly on the
 * command line (vs sourced from `PRIMITIVE_API_KEY`), and whether a logged-in
 * session exists. Returns the key to use, or `undefined` to fall through to the
 * stored login. See the block comment above for the precedence rationale.
 */
export function resolvePayerInboxApiKey(params: {
  apiKeyFlag: string | undefined;
  apiKeyFromEnvOnly: boolean;
  hasStoredLogin: boolean;
}): { apiKey: string | undefined; usedStoredLoginOverEnvKey: boolean } {
  // An env-only key with a stored login to fall back to: drop the env key so the
  // payer's logged-in account (which owns the inbox) authenticates the reads.
  if (
    params.apiKeyFlag !== undefined &&
    params.apiKeyFromEnvOnly &&
    params.hasStoredLogin
  ) {
    return { apiKey: undefined, usedStoredLoginOverEnvKey: true };
  }
  return { apiKey: params.apiKeyFlag, usedStoredLoginOverEnvKey: false };
}

/** The exact part name + content type the inbound matcher requires. */
const INTERACTION_PART_FILENAME = "interaction.json";
const INTERACTION_PART_CONTENT_TYPE = "application/json";

// Send requires a subject; the payment associates by the interaction.json's
// interaction_id, so the visible subject only needs to be human-readable and
// non-empty.
const DEFAULT_SUBJECT = "x402 payment authorization";

// Always carry a body even though the payload that matters travels in the
// `interaction.json` attachment. Default to a short human-readable note so the
// command works with no extra flags; `--body` overrides it.
const DEFAULT_BODY_TEXT =
  "x402 payment authorization attached (interaction.json).";

/** Build the `interaction.json` attachment from a signed payment step. */
export function interactionAttachment(built: BuiltPaymentStep): {
  filename: string;
  content_type: string;
  content_base64: string;
} {
  return {
    filename: INTERACTION_PART_FILENAME,
    content_type: INTERACTION_PART_CONTENT_TYPE,
    content_base64: Buffer.from(built.json, "utf8").toString("base64"),
  };
}

/**
 * Pull the `EmailDetail` out of the get-email envelope. The fields wrapper
 * returns `{ data: { data: EmailDetail } }`; normalize to the inner detail or
 * null when the API returned no body.
 */
function emailDetailFromEnvelope(
  data: { data?: EmailDetail } | undefined,
): EmailDetail | null {
  return data?.data ?? null;
}

class PaymentsPayEmailCommand extends Command {
  static description =
    `Pay an email-native x402 challenge in one step: sign it and send the signed interaction.json.

  THE ONE-COMMAND PAYER FLOW. You received a payment-request email carrying an
  \`interaction.json\` attachment. Run:

      ${"<%= config.bin %>"} payments pay-email --in-reply-to <inbound-email-id>

  with your wallet key in ${PRIVATE_KEY_ENV}, and this command auto-derives the
  challenge from that inbound email's attachment, signs the interaction-bound
  EIP-3009 authorization locally, and sends the signed \`interaction.json\` back
  to the payee. The key never leaves your machine. You do NOT need --challenge or
  --challenge-file: with just --in-reply-to the challenge is derived for you.

  THE CHALLENGE OBJECT (only needed for the --challenge / --challenge-file
  override). \`--challenge\` expects the object the PAYEE's
  \`create-email-challenge\` API returns, NOT the inbound email's
  \`interaction.json\` attachment (those are different shapes). Its fields are:

      {
        "interaction_id": "<uuid@domain>",     // the email thread id
        "challenge": {
          "payment_requirements": { ... },     // scheme, network, payTo, asset, ...
          "nonce_binding": {
            "interaction_id": "<uuid@domain>",  // must equal the outer interaction_id
            "challenge_step_id": "<uuid>",      // the challenge step id
            "challenge_nonce": "<64 hex chars>"
          },
          "expires_at": "<ISO-8601>"
        }
      }

  As a real payer you usually have only the inbound email's attachment, whose
  layout differs (top-level \`step\`, \`step_id\`, \`expires_at\`, and a nested
  \`payload.payment_requirements\` / \`payload.challenge_nonce\`). You do NOT
  reshape it by hand: omit --challenge and let --in-reply-to derive it, or run
  \`payments challenge-from-email --id <inbound-id>\` to print the correctly
  shaped challenge object. Pass --challenge / --challenge-file only when you have
  the payee-side challenge from another source; it is used as-is and overrides
  the auto-derive.

  SETTLEMENT IS ASYNC. --wait only confirms the receiving MTA accepted the
  message (SMTP 250); it does NOT confirm on-chain settlement. The \`settle_tx\`
  hash arrives later in a follow-up inbound x402 settlement interaction email
  from the payee. Use --wait-settle to poll for that settlement email after
  sending and surface the receipt.

  ADDRESSING. --in-reply-to is the inbound challenge email's id. It is fetched to
  derive the recipient (the payee, from the inbound's sender) and the From (you,
  the payer, from the inbound's recipient). The outgoing send does NOT thread
  under the challenge: threading would trigger the send endpoint's parent-thread
  dedup and the payment would never settle. The interaction associates by
  interaction_id instead. Pass --from only to override the derived payer From.`;

  static summary =
    "Sign an email x402 challenge and send the signed interaction.json (one step; derives the challenge from --in-reply-to)";

  static examples = [
    "<%= config.bin %> payments pay-email --in-reply-to <inbound-email-id>",
    "<%= config.bin %> payments pay-email --in-reply-to <inbound-email-id> --wait-settle",
    "<%= config.bin %> payments pay-email --challenge-file challenge.json --in-reply-to <inbound-email-id>",
    "<%= config.bin %> payments pay-email --in-reply-to <inbound-email-id> --from 'Payer <payer@your-domain.example>'",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "private-key": Flags.string({
      description: PRIVATE_KEY_FLAG_DESCRIPTION,
      env: PRIVATE_KEY_ENV,
    }),
    challenge: Flags.string({
      description:
        "OVERRIDE: the payee-side email challenge object (the create-email-challenge response shape, NOT the inbound interaction.json attachment) as a JSON string. Optional: omit it and the challenge is auto-derived from the --in-reply-to email's attachment.",
      exclusive: ["challenge-file"],
    }),
    "challenge-file": Flags.string({
      description:
        "OVERRIDE: path to a file containing the payee-side email challenge JSON (the create-email-challenge response shape). Optional: omit it and the challenge is auto-derived from the --in-reply-to email's attachment.",
      exclusive: ["challenge"],
    }),
    "in-reply-to": Flags.string({
      description:
        "Id of the inbound challenge email you received. With no --challenge / --challenge-file, its interaction.json attachment is downloaded and reshaped into the challenge to sign. It is also fetched to derive the payee recipient and the payer From. The outgoing send is not threaded under the challenge; the payment associates by interaction_id.",
      required: true,
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound's recipient (the payer the challenge was addressed to).",
    }),
    body: Flags.string({
      description: `Plain-text body. The signed authorization travels in the interaction.json attachment; this is the human-readable accompanying note. Defaults to "${DEFAULT_BODY_TEXT}".`,
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns a delivery outcome (SMTP 250). This confirms email DELIVERY only, NOT on-chain settlement. Without --wait, the call returns once Primitive has accepted the message for delivery.",
    }),
    "wait-settle": Flags.boolean({
      description:
        "After sending, poll the inbox for the follow-up x402 settlement interaction email from the payee and print the settlement receipt (including settle_tx when present). Settlement is async, so this can take a while; tune with --settle-timeout / --settle-interval.",
    }),
    "settle-timeout": Flags.integer({
      default: 180,
      description:
        "With --wait-settle: seconds to wait for the settlement email before giving up (0 waits forever).",
      min: 0,
    }),
    "settle-interval": Flags.integer({
      default: 5,
      description:
        "With --wait-settle: seconds between settlement-email polls.",
      min: 1,
    }),
    json: Flags.boolean({
      description:
        "Print a JSON object with the signed interaction step and the send result.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags, raw } = await this.parse(PaymentsPayEmailCommand);

    // Was `--api-key` passed explicitly on the command line, or did its value
    // come from `PRIMITIVE_API_KEY`? oclif records only CLI-passed flags in
    // `raw` (env-sourced flags resolve through a separate path), so a flag token
    // for `api-key` means the user typed it. We use this to keep an explicit
    // `--api-key` authoritative while ignoring a stray env key (see
    // resolvePayerInboxApiKey + the block comment above it).
    const apiKeyFlagExplicit = raw.some(
      (token) => token.type === "flag" && token.flag === "api-key",
    );
    const apiKeyFromEnvOnly =
      flags["api-key"] !== undefined && !apiKeyFlagExplicit;
    const { apiKey: effectiveApiKey, usedStoredLoginOverEnvKey } =
      resolvePayerInboxApiKey({
        apiKeyFlag: flags["api-key"],
        apiKeyFromEnvOnly,
        hasStoredLogin: hasStoredCliLogin(this.config.configDir),
      });
    if (usedStoredLoginOverEnvKey) {
      // Make the precedence visible: a payer with an unrelated PRIMITIVE_API_KEY
      // set should understand why pay-email read their logged-in inbox instead.
      process.stderr.write(
        "PRIMITIVE_API_KEY is set, but pay-email reads the inbound challenge from your logged-in account's inbox, so it is using your saved login for this command. Pass --api-key explicitly to override.\n",
      );
    }

    // Unlike `pay-email-step` (fully offline), this command sends, so it needs
    // an authenticated client. Build it first so a not-signed-in caller gets
    // the standard auth guidance before we do any signing work.
    const { apiClient, auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        apiKey: effectiveApiKey,
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    const authFailureContext = {
      auth,
      baseUrlOverridden,
      configDir: this.config.configDir,
    };

    await runWithTiming(flags.time, async () => {
      // Fetch the inbound challenge email FIRST. It serves two purposes now:
      //   1. addressing (payee = its sender, payer = its recipient), and
      //   2. the source of the challenge to sign when no --challenge override is
      //      given (its interaction.json attachment is the wire envelope a real
      //      payer actually receives).
      // We deliberately do NOT carry the inbound's Message-Id onto the send (see
      // the file header): threading the send under the challenge re-triggers the
      // parent-thread dedup that swallows the payment. The interaction associates
      // by interaction_id, not threading.
      const inboundResult = await getEmail({
        client: apiClient.client,
        path: { id: flags["in-reply-to"] },
        responseStyle: "fields",
      });
      if (inboundResult.error) {
        const errorPayload = extractErrorPayload(inboundResult.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        // A not-found on the inbound challenge while an API KEY (not a saved
        // login) authenticated the read is the classic wrong-org symptom: the
        // challenge lives in the payer's inbox but the key scoped the lookup to
        // a different org. Turn the bare "Email not found" into an actionable
        // hint. We only add it when a key was authoritative (auth.source ===
        // "flag-or-env"); the env-only-with-login case already swapped to the
        // login above, so it never lands here for that reason.
        if (
          extractErrorCode(errorPayload) === API_ERROR_CODES.notFound &&
          auth.source === "flag-or-env"
        ) {
          process.stderr.write(
            "The inbound challenge email was not found for the org this API key belongs to. pay-email reads the challenge from the PAYER account's inbox: unset PRIMITIVE_API_KEY (or pass --api-key for the payer's org, or run `primitive signin` as the payer) and retry.\n",
          );
        }
        process.exitCode = 1;
        return;
      }
      const inbound = emailDetailFromEnvelope(
        inboundResult.data as { data?: EmailDetail } | undefined,
      );
      if (!inbound) {
        process.stderr.write(
          `Could not load inbound challenge email ${flags["in-reply-to"]}: the API returned no email.\n`,
        );
        process.exitCode = 1;
        return;
      }

      // Resolve the challenge. With an explicit --challenge / --challenge-file
      // (or a piped stdin), use it as-is for back-compat. Otherwise auto-derive
      // it from the inbound email's interaction.json attachment (the wire
      // envelope) and reshape it via the SDK's canonical
      // parseEmailChallengeFromPart. Then sign locally; signing failures (bad
      // key, expired/invalid challenge, no interaction.json part) surface through
      // the x402 error reporter, the same as `pay-email-step`.
      let built: BuiltPaymentStep;
      try {
        let challenge: X402EmailChallenge;
        if (shouldDeriveChallenge(flags)) {
          challenge = await deriveEmailChallengeFromInbound({
            baseUrl: auth.apiBaseUrl,
            emailId: flags["in-reply-to"],
            apiKey: auth.apiKey,
            headers: requestConfig.headers,
            // The attachments archive names each entry `<part_index>_<filename>`
            // (e.g. `0_interaction.json`), so locate the challenge member by its
            // metadata `tar_path` rather than guessing the entry name. The
            // inbound email is already fetched above for from/to derivation, so
            // the metadata is in hand.
            attachments: inbound.parsed?.attachments,
          });
        } else {
          challenge = readEmailChallenge({
            inline: flags.challenge,
            file: flags["challenge-file"],
          });
        }
        built = await signEmailChallenge({
          challenge,
          privateKey: flags["private-key"] ?? "",
          resolvedApiBaseUrl: auth.apiBaseUrl,
          // Cosmetic only: payEmailChallenge signs locally and makes no request.
          // Use the same effective key the inbox reads use for consistency.
          apiKey: effectiveApiKey,
        });
      } catch (error) {
        reportX402Error(error, authFailureContext);
        process.exitCode = 1;
        return;
      }

      // To = the payee that issued the challenge (the inbound's canonical
      // sender). From = the payer the challenge was addressed to (the inbound's
      // recipient), overridable with --from. We require a payee To; if the
      // payer From cannot be derived, --from is the fallback.
      const payeeTo = inbound.from_email;
      const derivedPayerFrom = inbound.to_email || inbound.recipient;
      const from = flags.from ?? derivedPayerFrom;
      if (!payeeTo) {
        process.stderr.write(
          `Inbound challenge email ${flags["in-reply-to"]} has no resolvable sender to address the payment to.\n`,
        );
        process.exitCode = 1;
        return;
      }
      if (!from) {
        process.stderr.write(
          `Could not derive the payer From from inbound challenge email ${flags["in-reply-to"]}; pass --from explicitly.\n`,
        );
        process.exitCode = 1;
        return;
      }

      // Capture the moment just before sending so --wait-settle only considers
      // settlement emails that arrive AFTER this payment, not a stale prior one.
      const sendStartedAt = new Date().toISOString();

      // Send the signed envelope. The inbound matcher requires a part named
      // exactly `interaction.json` with content type `application/json`; build
      // it that way. Always include a non-empty body_text (default, overridable
      // with `--body`) even though the payload of record is the attachment.
      const result = await sendEmail({
        body: {
          from,
          to: payeeTo,
          subject: DEFAULT_SUBJECT,
          // Fall back to the default note when --body is omitted OR blank /
          // whitespace-only, so an empty override can't produce an empty body.
          body_text: flags.body?.trim() ? flags.body : DEFAULT_BODY_TEXT,
          attachments: [interactionAttachment(built)],
          // Intentionally NO in_reply_to / Message-Id. Setting it threads this
          // send under the challenge, and the send endpoint then dedups it as a
          // `parent_already_replied` no-op (no mail on the wire, payment never
          // settles) because all x402 challenges to a payer share a subject and
          // thread together. The interaction associates by the interaction.json's
          // interaction_id, so threading is unnecessary. Do not add it back.
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          ...authFailureContext,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: SendMailResult } | undefined;
      const sent = envelope?.data ?? null;

      // A replayed send is a hard failure for a payment one-shot, not a soft
      // warning. The server auto-derives an idempotency key from the message
      // content, so a retried pay-email (same payer, payee, body, attachment)
      // returns the cached row with `idempotent_replay: true` and puts no fresh
      // SMTP traffic on the wire. The `interaction.json` is therefore NOT
      // re-delivered for settlement, yet the row reads `status: "delivered"`.
      // The plain `send` command treats this as advisory, but here a silent
      // success would let an agent believe a settlement is in flight when
      // nothing was sent. So we still print the result (and a loud stderr
      // banner explaining the bypass), but exit non-zero so automation halts
      // instead of continuing the payment flow on a no-op.
      const replayed = sent?.idempotent_replay === true;
      if (replayed) {
        writeIdempotentReplayBannerIfReplay(sent, {
          write: (chunk) => {
            process.stderr.write(chunk);
          },
        });
      }

      // Optionally wait for the async on-chain settlement. The payment is now on
      // the wire, but settlement happens later and the settle_tx arrives in a
      // follow-up x402 settlement interaction email from the payee. A replayed
      // send put no fresh interaction.json on the wire, so polling for a
      // settlement that will never come is pointless; skip the wait in that case.
      let settlement: Awaited<ReturnType<typeof pollForSettlementInteraction>> =
        null;
      if (flags["wait-settle"] && !replayed && payeeTo) {
        process.stderr.write(
          "Payment sent. Waiting for the x402 settlement interaction email (settlement is async)...\n",
        );
        settlement = await pollForSettlementInteraction({
          apiClient,
          baseUrl: auth.apiBaseUrl,
          apiKey: auth.apiKey,
          headers: requestConfig.headers,
          interactionId: built.envelope.interaction_id,
          payeeFrom: payeeTo,
          since: sendStartedAt,
          timeoutSeconds: flags["settle-timeout"],
          intervalSeconds: flags["settle-interval"],
        });
        if (settlement) {
          process.stderr.write(
            settlement.settleTx
              ? `Settled. settle_tx: ${settlement.settleTx}\n`
              : "Settlement interaction received (no settle_tx field present; full receipt below).\n",
          );
        } else {
          process.stderr.write(
            "Timed out waiting for the x402 settlement interaction email. The payment was sent; the settle_tx will arrive in a follow-up x402 settlement interaction email from the payee. Re-run with --wait-settle, or check your inbox for an x402 settlement message.\n",
          );
        }
      }

      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              interaction: built.envelope,
              sent,
              idempotent_replay: replayed,
              ...(flags["wait-settle"]
                ? {
                    settlement: settlement
                      ? {
                          email_id: settlement.emailId,
                          settle_tx: settlement.settleTx,
                          receipt: settlement.envelope,
                        }
                      : null,
                  }
                : {}),
            },
            null,
            2,
          ),
        );
      } else {
        this.log(JSON.stringify(sent, null, 2));
        // Without --wait-settle the user has no on-chain confirmation yet; say so
        // plainly so a delivered send is not mistaken for a settled payment.
        if (!flags["wait-settle"]) {
          process.stderr.write(`${settlementWaitNotice}\n`);
        } else if (settlement) {
          this.log(JSON.stringify(settlement.envelope, null, 2));
        }
      }

      if (replayed) {
        process.exitCode = 1;
      } else if (flags["wait-settle"] && !settlement) {
        // --wait-settle was requested but no settlement arrived in time: exit
        // non-zero so automation does not treat an unconfirmed payment as done.
        process.exitCode = 1;
      }
    });
  }
}

export default PaymentsPayEmailCommand;
