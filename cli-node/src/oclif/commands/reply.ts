import { Command, Errors, Flags } from "@oclif/core";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { replyToEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { readAttachmentFiles } from "../attachments.js";
import { writeIdempotentReplayBannerIfReplay } from "../idempotent-replay-banner.js";
import { resolveMessageBodies } from "../message-body-sources.js";

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
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ReplyCommand);

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
