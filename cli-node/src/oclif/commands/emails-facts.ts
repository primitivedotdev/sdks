import { Args, Command, Errors, Flags } from "@oclif/core";
import { getEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import { formatFact, isEmailId } from "../email-rule-authoring.js";
import { withFlagSuggestion } from "../flag-suggestions.js";

const ID_DESCRIPTION =
  "The id of the received email (from `primitive emails list`). The same as the first argument; give one of the two.";

/**
 * `primitive emails facts <id>`: what the classifier read from one received
 * email, from the email itself (GET /emails/{id}, `understanding`).
 */
export default class EmailsFactsCommand extends Command {
  static summary = "Show what the classifier read from an email";

  static description =
    `Show what the classifier read from a received email, from its understanding.facts (\`primitive emails get <id> --json\`): one fact per line with its value and confidence, for example \`is_cold_outreach: true at 0.69\`, or \`topics: [billing, invoice] at 0.80\` for a multi fact. An email with no classification yet, or none to read, prints why on stderr and nothing on stdout; with --json it prints the classification, or null.

With --json, the classification or null is in data, alongside success and meta. These are the facts as the classifier wrote them; a test's results[].values shows what a rule's conditions compared.`;

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
        "Print success, data and meta as one JSON document. data is the classification (id, vocabulary, classified_at, facts), or null when the email has none. A failure prints the error with exit_code.",
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
      const read = await getEmail({
        client: apiClient.client,
        path: { id },
        responseStyle: "fields",
      });
      if (read.error) {
        const payload = extractErrorPayload(read.error);
        writeErrorWithHints(payload, read.response);
        surfaceUnauthorizedHint({
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
          payload,
        });
        process.exitCode = 1;
        return;
      }
      const envelope = read.data as
        | { data?: { understanding?: unknown }; meta?: unknown }
        | undefined;
      const understanding = envelope?.data?.understanding;
      const classification = classificationFromUnderstanding(understanding);
      if (flags.json) {
        this.log(
          JSON.stringify(
            {
              ...envelope,
              success: true,
              data: classification,
              meta: envelope?.meta ?? {},
            },
            null,
            2,
          ),
        );
        return;
      }
      const lines = classification
        ? Object.entries(classification.facts).map(([name, fact]) =>
            formatFact(name, isRecord(fact) ? fact : {}),
          )
        : [];
      if (lines.length === 0) {
        process.stderr.write(
          `${classification ? "This email's classification has no facts." : noUnderstandingMessage(understanding)}\n`,
        );
        return;
      }
      this.log(lines.join("\n"));
    });
  }
}

/** The classification an email's understanding gives once it is ready. */
export type Classification = {
  id: unknown;
  vocabulary: unknown;
  classified_at: unknown;
  facts: Record<string, unknown>;
};

/**
 * The email's `understanding` as a classification (id, vocabulary,
 * classified_at, facts), when it is ready; otherwise null.
 */
export function classificationFromUnderstanding(
  understanding: unknown,
): Classification | null {
  if (!isRecord(understanding) || understanding.status !== "ready") return null;
  // A ready block names all three; null rather than a dropped key otherwise.
  return {
    id: understanding.classification_id ?? null,
    vocabulary: understanding.vocabulary ?? null,
    classified_at: understanding.classified_at ?? null,
    facts: isRecord(understanding.facts) ? understanding.facts : {},
  };
}

/** Why an email read gave no facts to show. */
export function noUnderstandingMessage(understanding: unknown): string {
  const status = isRecord(understanding) ? understanding.status : undefined;
  if (status === "pending")
    return "No classification for this email yet: it has not been classified. Recent mail can take a while, so try again later.";
  if (status === "unavailable")
    return "No classification to show for this email: it was not classified in time, its content was discarded first, or its facts are too large to include.";
  if (typeof status === "string")
    return `No classification to show: the email's understanding is ${status}.`;
  return "No classification to show: the email read carries no facts. Its content may be withheld, discarded or failed to parse, this credential may not read message content, or the facts could not be read just now, so try again.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
