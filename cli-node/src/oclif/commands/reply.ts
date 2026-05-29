import { Command, Errors, Flags } from "@oclif/core";
import type {
  ReplyToEmailData,
  SendMailResult,
} from "@primitivedotdev/api-core";
import { replyToEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  readJsonBody,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readAttachmentFiles } from "../attachments.js";
import { writeIdempotentReplayBannerIfReplay } from "../idempotent-replay-banner.js";
import { resolveMessageBodies } from "../message-body-sources.js";

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertNoRawBodyConflicts(flags: Record<string, unknown>): void {
  const conflictingFlags = [
    "body",
    "body-file",
    "body-stdin",
    "html",
    "html-file",
    "html-stdin",
    "from",
    "attachment",
    "wait",
  ].filter((flag) => flags[flag] !== undefined);
  if (conflictingFlags.length > 0) {
    throw new Errors.CLIError(
      `--raw-body cannot be combined with ${conflictingFlags.map((flag) => `--${flag}`).join(", ")}.`,
    );
  }
}

class ReplyCommand extends Command {
  static description = `Reply to an inbound email.

  The API derives recipients, the Re: subject, and threading headers from the inbound email id. Use \`primitive send --in-reply-to <message-id>\` only when you need to thread against a raw Message-Id instead of an inbound email stored by Primitive.`;

  static summary = "Reply to an inbound email";

  static examples = [
    "<%= config.bin %> reply --id <inbound-email-id> --body 'Thanks, got it.'",
    "<%= config.bin %> reply --id <inbound-email-id> --body-file ./reply.txt",
    "<%= config.bin %> reply --id <inbound-email-id> --body 'See attached.' --attachment ./report.pdf",
    "<%= config.bin %> reply --id <inbound-email-id> --html '<p>Thanks, got it.</p>' --wait",
    "<%= config.bin %> reply --id <inbound-email-id> --from 'Support <support@example.com>' --body 'Thanks!'",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description:
        "Override the API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    id: Flags.string({
      description: "Inbound email id to reply to.",
      required: true,
    }),
    body: Flags.string({
      description:
        "Plain-text reply body. Either --body or --html (or both) is required.",
    }),
    "body-file": Flags.string({
      description:
        "Read the plain-text reply body from a UTF-8 file; this does not attach the file. Use --attachment for attachments. Mutually exclusive with --body and --body-stdin.",
    }),
    "body-stdin": Flags.boolean({
      description:
        "Read the plain-text reply body from stdin. Mutually exclusive with --body and --body-file. Stdin can only be consumed once.",
    }),
    html: Flags.string({
      description:
        "HTML reply body. Either --body or --html (or both) is required.",
    }),
    "html-file": Flags.string({
      description:
        "Read the HTML reply body from a UTF-8 file; this does not attach the file. Use --attachment for attachments. Mutually exclusive with --html and --html-stdin.",
    }),
    "html-stdin": Flags.boolean({
      description:
        "Read the HTML reply body from stdin. Mutually exclusive with --html and --html-file. Stdin can only be consumed once.",
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound recipient.",
    }),
    attachment: Flags.string({
      char: "a",
      description:
        "Attach a file to the reply. Repeat --attachment to attach multiple files.",
      multiple: true,
    }),
    wait: Flags.boolean({
      description:
        "Block until the receiving MTA returns an outcome. Without --wait, the call returns once Primitive has accepted the reply for delivery.",
    }),
    "raw-body": Flags.string({
      description:
        "Full reply request body as raw JSON. Use for advanced fields not exposed as first-class flags; cannot be combined with message flags.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ReplyCommand);
    const rawBody = readJsonBody({ "raw-body": flags["raw-body"] });
    if (rawBody !== undefined) {
      assertNoRawBodyConflicts(flags);
      if (!isJsonObject(rawBody)) {
        throw new Errors.CLIError("--raw-body must be a JSON object.");
      }

      await runWithTiming(flags.time, async () => {
        const { apiClient, auth, baseUrlOverridden } =
          await createAuthenticatedCliApiClient({
            apiKey: flags["api-key"],
            apiBaseUrl: flags["api-base-url"],
            configDir: this.config.configDir,
          });
        const result = await replyToEmail({
          body: rawBody as ReplyToEmailData["body"],
          client: apiClient.client,
          path: { id: flags.id },
          responseStyle: "fields",
        });
        if (result.error) {
          const errorPayload = extractErrorPayload(result.error);
          writeErrorWithHints(errorPayload);
          surfaceUnauthorizedHint({
            auth,
            baseUrlOverridden,
            configDir: this.config.configDir,
            payload: errorPayload,
          });
          process.exitCode = 1;
          return;
        }
        const envelope = result.data as { data?: SendMailResult } | undefined;
        writeIdempotentReplayBannerIfReplay(envelope?.data, {
          write: (chunk) => {
            process.stderr.write(chunk);
          },
        });
        this.log(JSON.stringify(envelope?.data ?? null, null, 2));
      });
      return;
    }

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
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });
      const attachments = readAttachmentFiles(flags.attachment);

      const result = await replyToEmail({
        body: {
          ...(bodies.body !== undefined ? { body_text: bodies.body } : {}),
          ...(bodies.html !== undefined ? { body_html: bodies.html } : {}),
          ...(flags.from !== undefined ? { from: flags.from } : {}),
          ...(attachments !== undefined ? { attachments } : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
        path: { id: flags.id },
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload: errorPayload,
        });
        process.exitCode = 1;
        return;
      }

      const envelope = result.data as { data?: SendMailResult } | undefined;
      writeIdempotentReplayBannerIfReplay(envelope?.data, {
        write: (chunk) => {
          process.stderr.write(chunk);
        },
      });
      this.log(JSON.stringify(envelope?.data ?? null, null, 2));
    });
  }
}

export default ReplyCommand;
