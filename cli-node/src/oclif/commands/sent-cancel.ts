import { Command, Flags } from "@oclif/core";
import {
  cancelSentEmail,
  cancelSentEmailByIdempotencyKey,
  type SentEmailDetail,
} from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorCode,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { isIsoInstantWithZone } from "../send-options.js";

// `sent cancel`: cancel a scheduled send by its id or by the
// Idempotency-Key it was created with. The generated
// `sending:cancel-sent-email` and
// `sending:cancel-sent-email-by-idempotency-key` commands stay available
// for full API parity.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Shown when the send exists but has left `scheduled`. */
export const NOT_SCHEDULED_HINT =
  "Only a send that is still scheduled can be canceled. `error.details.status` is where it is now; a send already handed to delivery cannot be recalled.";

/** One line for terminal output. */
export function formatCanceledSend(send: SentEmailDetail): string {
  const parts = [`Canceled ${send.id}`];
  if (send.scheduled_at) parts.push(`(was scheduled for ${send.scheduled_at})`);
  if (send.client_idempotency_key)
    parts.push(
      `Idempotency-Key ${send.client_idempotency_key} is free to use again.`,
    );
  return parts.join(" ");
}

export default class SentCancelCommand extends Command {
  static summary = "Cancel a scheduled send";

  static description =
    "Cancel a send that is still scheduled, by its id or by the Idempotency-Key you sent it with. Nothing is sent, the record is kept with status `canceled`, and the key is released so it can schedule a new send. A send the scheduler has already picked up, or one already sent, canceled or failed, cannot be canceled and the command exits 1 with its current status. A connected agent can cancel only its own sends.";

  static examples = [
    "<%= config.bin %> sent cancel --idempotency-key order-42",
    "<%= config.bin %> sent cancel --id 7f9c24e8-3b1a-4b6e-9c11-0d5f8a2e6c3d --json",
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
      description: "The sent email id (UUID) returned when it was scheduled",
      exactlyOne: ["id", "idempotency-key"],
    }),
    "idempotency-key": Flags.string({
      description:
        "The Idempotency-Key the send was created with, matched exactly",
      exactlyOne: ["id", "idempotency-key"],
    }),
    "created-before": Flags.string({
      description:
        "With --idempotency-key: only consider sends created at or before this ISO 8601 time, such as when you first tried to cancel, so a retry never reaches a newer send that reused the key",
      dependsOn: ["idempotency-key"],
    }),
    json: Flags.boolean({ description: "Print the API result as JSON" }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(SentCancelCommand);
    if (flags.id !== undefined && !UUID.test(flags.id))
      this.error("--id must be a sent email id (UUID).", { exit: 2 });
    const key = flags["idempotency-key"]?.trim();
    if (key !== undefined && key.length === 0)
      this.error("--idempotency-key must not be empty.", { exit: 2 });
    const createdBefore = flags["created-before"];
    if (createdBefore !== undefined && !isIsoInstantWithZone(createdBefore))
      this.error(
        "--created-before must be an ISO 8601 time with a time zone, such as 2026-10-20T14:00:00Z.",
        { exit: 2 },
      );

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });
    await runWithTiming(flags.time === true, async () => {
      const client = apiClient.client;
      const result =
        key !== undefined
          ? await cancelSentEmailByIdempotencyKey({
              body: {
                idempotency_key: key,
                ...(createdBefore ? { created_before: createdBefore } : {}),
              },
              client,
              responseStyle: "fields",
            })
          : await cancelSentEmail({
              client,
              path: { id: flags.id as string },
              responseStyle: "fields",
            });
      const send = (result.data as { data?: SentEmailDetail } | undefined)
        ?.data;
      if (result.error || send === undefined) {
        const payload = extractErrorPayload(result.error);
        writeErrorWithHints(payload);
        if (extractErrorCode(payload) === "not_scheduled")
          process.stderr.write(`${NOT_SCHEDULED_HINT}\n`);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }
      this.log(
        flags.json ? JSON.stringify(send, null, 2) : formatCanceledSend(send),
      );
    });
  }
}
