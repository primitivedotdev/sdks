import { Command, Errors, Flags } from "@oclif/core";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { PrimitiveApiClient, replyToEmail } from "@primitivedotdev/api-core";
import {
  extractErrorPayload,
  removeStaleSavedCredentialOnUnauthorized,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import { writeIdempotentReplayBannerIfReplay } from "../idempotent-replay-banner.js";

class ReplyCommand extends Command {
  static description = `Reply to an inbound email.

  The API derives recipients, the Re: subject, and threading headers from the inbound email id. Use \`primitive send --in-reply-to <message-id>\` only when you need to thread against a raw Message-Id instead of an inbound email stored by Primitive.`;

  static summary = "Reply to an inbound email";

  static examples = [
    "<%= config.bin %> reply --id <inbound-email-id> --body 'Thanks, got it.'",
    "<%= config.bin %> reply --id <inbound-email-id> --html '<p>Thanks, got it.</p>' --wait",
    "<%= config.bin %> reply --id <inbound-email-id> --from 'Support <support@example.com>' --body 'Thanks!'",
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
    id: Flags.string({
      description: "Inbound email id to reply to.",
      required: true,
    }),
    body: Flags.string({
      description:
        "Plain-text reply body. Either --body or --html (or both) is required.",
    }),
    html: Flags.string({
      description:
        "HTML reply body. Either --body or --html (or both) is required.",
    }),
    from: Flags.string({
      description:
        "Optional From header override. Defaults to the inbound recipient.",
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

    if (!flags.body && !flags.html) {
      throw new Errors.CLIError(
        "Either --body or --html (or both) is required.",
      );
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

      const result = await replyToEmail({
        body: {
          ...(flags.body !== undefined ? { body_text: flags.body } : {}),
          ...(flags.html !== undefined ? { body_html: flags.html } : {}),
          ...(flags.from !== undefined ? { from: flags.from } : {}),
          ...(flags.wait !== undefined ? { wait: flags.wait } : {}),
        },
        client: apiClient.client,
        path: { id: flags.id },
        responseStyle: "fields",
      });

      if (result.error) {
        const errorPayload = extractErrorPayload(result.error);
        writeErrorWithHints(errorPayload);
        removeStaleSavedCredentialOnUnauthorized({
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
