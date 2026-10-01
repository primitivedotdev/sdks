import { Command, Errors, Flags } from "@oclif/core";
import type { SentEmailSummary } from "@primitivedotdev/api-core";
import { getSentEmail, listSentEmails } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { assertValidIdempotencyKey } from "../send-outcome.js";

// Rows fetched when looking a send up by idempotency key. A key names one
// send; retries that reuse it replay the same row, so more than a handful
// of matches would mean the key was shared on purpose.
const IDEMPOTENCY_LOOKUP_LIMIT = 10;

type SentEnvelope = {
  data?: unknown;
  meta?: Record<string, unknown>;
  success?: boolean;
};

export function idempotencyKeyNotFoundError(key: string): {
  code: string;
  message: string;
} {
  return {
    code: "not_found",
    message: `No sent email has idempotency key ${key}. If the command that used this key reported an uncertain outcome, the request did not create a send record. Retrying with the same --idempotency-key is safe: the API returns the original send instead of sending twice.`,
  };
}

/**
 * Rows from a key-filtered sent-history page that really carry the key,
 * newest first. The server filters already; the check guards against a
 * server that ignores the filter and returns unrelated sends.
 */
export function rowsMatchingIdempotencyKey(
  rows: readonly SentEmailSummary[],
  key: string,
): SentEmailSummary[] {
  return rows
    .filter((row) => row.client_idempotency_key === key)
    .sort((left, right) =>
      left.created_at < right.created_at
        ? 1
        : left.created_at > right.created_at
          ? -1
          : 0,
    );
}

export default class SentGetCommand extends Command {
  static description =
    `Get one sent email by id, or find it by the idempotency key the send used.

  --id <sent-email-id> prints the sent email record, with bodies, exactly
  like \`primitive sending get-sent-email\`.

  --idempotency-key <key> reconciles a send whose outcome is uncertain.
  \`primitive send\`, \`reply\` and \`chat\` report the key in their --json
  envelope as idempotency_key, including when the outcome is uncertain.
  The CLI filters sent history by that key on the server and prints the
  newest matching send. When nothing matches, it exits 1 with error code
  not_found: the request did not create a send record, and retrying with
  the same --idempotency-key is safe because the API returns the original
  send instead of sending twice.

  Without --json, stdout is the sent email record (or the full response
  envelope with --envelope). With --json, stdout is exactly one JSON
  document { success, data, meta } on success and { error, exit_code }
  on failure, and stderr stays empty. A key lookup sets
  meta.idempotency_key and meta.matches.`;

  static summary = "Get a sent email by id or idempotency key";

  static examples = [
    "<%= config.bin %> sent get --id <sent-email-id>",
    "<%= config.bin %> sent get --idempotency-key primitive-send-3f2a... --json",
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
    id: Flags.string({
      description: "Sent email id.",
      exactlyOne: ["id", "idempotency-key"],
    }),
    "idempotency-key": Flags.string({
      description:
        "Idempotency key the send used (the idempotency_key field of a send, reply or chat --json envelope). Prints the newest send with this key.",
      exactlyOne: ["id", "idempotency-key"],
    }),
    envelope: Flags.boolean({
      description:
        "Print the full response envelope instead of only the sent email record. Ignored with --json, which always prints the envelope.",
    }),
    json: Flags.boolean({
      description:
        "Print exactly one JSON document on stdout, on success and on failure, and nothing on stderr.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SentGetCommand);
    const key =
      flags["idempotency-key"] === undefined
        ? undefined
        : assertValidIdempotencyKey(flags["idempotency-key"]);

    await runWithTiming(flags.time, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });
      const fail = (payload: unknown) => {
        writeErrorWithHints(payload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
      };

      let sentId = flags.id;
      let lookupMeta: Record<string, unknown> | undefined;
      if (key !== undefined) {
        const page = await listSentEmails({
          client: apiClient.client,
          query: { idempotency_key: key, limit: IDEMPOTENCY_LOOKUP_LIMIT },
          responseStyle: "fields",
        });
        if (page.error) {
          fail(extractErrorPayload(page.error));
          return;
        }
        const rows = Array.isArray(page.data?.data) ? page.data.data : [];
        const matches = rowsMatchingIdempotencyKey(rows, key);
        const newest = matches[0];
        if (!newest) {
          fail(idempotencyKeyNotFoundError(key));
          return;
        }
        sentId = newest.id;
        lookupMeta = { idempotency_key: key, matches: matches.length };
        if (matches.length > 1 && !flags.json) {
          process.stderr.write(
            `${matches.length} sends share idempotency key ${key}; showing the newest (id ${newest.id}).\n`,
          );
        }
      }
      if (sentId === undefined) {
        throw new Errors.CLIError("Pass --id or --idempotency-key.", {
          exit: 2,
        });
      }

      const result = await getSentEmail({
        client: apiClient.client,
        path: { id: sentId },
        responseStyle: "fields",
      });
      if (result.error) {
        fail(extractErrorPayload(result.error));
        return;
      }
      const envelope = (result.data ?? {}) as SentEnvelope;
      if (flags.json || flags.envelope) {
        const document: SentEnvelope = lookupMeta
          ? { ...envelope, meta: { ...envelope.meta, ...lookupMeta } }
          : envelope;
        this.log(JSON.stringify(document, null, 2));
        return;
      }
      this.log(JSON.stringify(envelope.data ?? null, null, 2));
    });
  }
}
