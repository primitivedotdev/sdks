import { Args, Command, Errors, Flags } from "@oclif/core";
import { listEmailRuleResults } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  classificationFactLines,
  classificationOf,
  isEmailId,
  noFactsMessage,
} from "../email-rule-authoring.js";
import { withFlagSuggestion } from "../flag-suggestions.js";

const ID_DESCRIPTION =
  "The id of the received email (from `primitive emails list`). The same as the first argument; give one of the two.";

/**
 * `primitive emails facts <id>`: what the classifier read from one received
 * email, every fact as email rule conditions read it, from the email's rule
 * results (GET /emails/{id}/rule-results).
 */
export default class EmailsFactsCommand extends Command {
  static summary = "Show what the classifier read from an email";

  static description =
    `Show what the classifier read from a received email: every fact as email rule conditions read it, one per line with its value and confidence, for example \`is_cold_outreach: true at 0.69\`. A multi fact lists its values: \`topics: [billing, invoice] at 0.80\`. A fact the classifier left out reads null.

Use it to see why an email rule did or did not match, alongside \`primitive email-rules list-email-rule-results --email-id <id>\`, which this reads. An email with no classification (not classified yet, never to be, or content that cannot be read) prints a message saying so on stderr and nothing on stdout. With --json, prints the classification object, or null when there is none.

Needs the email rules feature, and a member's own credential with their full access (not an API key, agent key or narrowed token).`;

  static examples = [
    "<%= config.bin %> emails facts 3f0e1c2a-8b7d-4c6e-9a1b-2d3e4f5a6b7c",
    "<%= config.bin %> emails facts --id 3f0e1c2a-8b7d-4c6e-9a1b-2d3e4f5a6b7c --json",
  ];

  static args = {
    id: Args.string({ description: ID_DESCRIPTION, required: false }),
  };

  static flags = {
    id: Flags.string({ description: ID_DESCRIPTION }),
    json: Flags.boolean({
      description:
        "Print the classification object as one JSON document on stdout (null when the email has none), and nothing on stderr. A failure prints the error with exit_code.",
    }),
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
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EmailsFactsCommand).catch(
      (error: unknown) => {
        throw withFlagSuggestion(
          error,
          Object.keys(EmailsFactsCommand.flags as Record<string, unknown>),
        );
      },
    );
    if (flags.id !== undefined && args.id !== undefined && flags.id !== args.id)
      throw new Errors.CLIError(
        "Give the id once: as the first argument or with --id, not both with different values.",
        { exit: 2 },
      );
    const id = flags.id ?? args.id;
    if (id === undefined || id === "")
      throw new Errors.CLIError(
        "Missing the id: pass the email's id as the first argument or with --id.",
        { exit: 2 },
      );
    if (!isEmailId(id))
      throw new Errors.CLIError(
        "The id must be a received email's UUID (from `primitive emails list` or `primitive emails latest`).",
        { exit: 2 },
      );

    await runWithTiming(flags.time === true, async () => {
      const { apiClient, auth, baseUrlOverridden } =
        await createAuthenticatedCliApiClient({
          apiKey: flags["api-key"],
          apiBaseUrl: flags["api-base-url"],
          configDir: this.config.configDir,
        });
      const result = await listEmailRuleResults({
        client: apiClient.client,
        path: { id },
        responseStyle: "fields",
      });
      if (result.error) {
        const payload = extractErrorPayload(result.error);
        writeErrorWithHints(payload, result.response);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }
      const data = result.data?.data;
      const classification = classificationOf(data);
      if (flags.json) {
        this.log(JSON.stringify(classification, null, 2));
        return;
      }
      const lines = classification
        ? classificationFactLines(classification)
        : [];
      if (lines.length === 0) {
        process.stderr.write(`${noFactsMessage(data)}\n`);
        return;
      }
      this.log(lines.join("\n"));
    });
  }
}
