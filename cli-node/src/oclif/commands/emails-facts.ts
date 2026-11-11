import { Args, Command, Errors, Flags } from "@oclif/core";
import { getEmail, listEmailRuleResults } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorCode,
  extractErrorPayload,
  refusalDetails,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";
import {
  type Classification,
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
 * results (GET /emails/{id}/rule-results). A credential that may not read
 * rule results gets the facts as written, from the email read
 * (GET /emails/{id}, `understanding`).
 */
export default class EmailsFactsCommand extends Command {
  static summary = "Show what the classifier read from an email";

  static description =
    `Show what the classifier read from a received email: every fact as email rule conditions read it, one per line with its value and confidence, for example \`is_cold_outreach: true at 0.69\`. A multi fact lists its values: \`topics: [billing, invoice] at 0.80\`. A fact the classifier left out reads null.

Use it to see why an email rule did or did not match, alongside \`primitive email-rules list-email-rule-results --email-id <id>\`, which this reads. An email with no classification (not classified yet, never to be, or content that cannot be read) prints a message saying so on stderr and nothing on stdout. With --json, prints the classification object, or null when there is none.

Needs the email rules feature. Rule results are read with a member's own credential with their full access. An API key, agent key or narrowed token cannot read them, so for one of those the command reads the facts from the email itself instead (\`understanding.facts\` of \`primitive emails get <id> --json\`), as the classifier wrote them, and says so on stderr (in \`warnings\` with --json). Those differ from what rule conditions read in two ways: conditions read a multi fact's options lowercased, and read a fact the classifier left out as null, where \`understanding.facts\` leaves it out.`;

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
        "Print the classification object as one JSON document on stdout (null when the email has none), and nothing on stderr. When the facts come from the email itself, the note saying so is in its warnings. A failure prints the error with exit_code.",
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
        // A key or a narrowed token may not read rule results, but can read
        // the facts as written from the email itself.
        if (refusesRuleResultsToCredential(payload)) {
          await this.printFactsFromEmail(id, Boolean(flags.json), {
            apiClient,
            auth,
            baseUrlOverridden,
          });
          return;
        }
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

  /**
   * The facts as `emails get` reads them, for a credential that may not read
   * rule results: the email's understanding, when it is ready.
   */
  private async printFactsFromEmail(
    id: string,
    json: boolean,
    client: Pick<
      Awaited<ReturnType<typeof createAuthenticatedCliApiClient>>,
      "apiClient" | "auth" | "baseUrlOverridden"
    >,
  ): Promise<void> {
    const read = await getEmail({
      client: client.apiClient.client,
      path: { id },
      responseStyle: "fields",
    });
    if (read.error) {
      const payload = extractErrorPayload(read.error);
      process.stderr.write(
        "This credential cannot read email rule results, and reading the facts from the email itself failed:\n",
      );
      writeErrorWithHints(payload, read.response);
      surfaceUnauthorizedHint({
        auth: client.auth,
        baseUrlOverridden: client.baseUrlOverridden,
        configDir: this.config.configDir,
        payload,
      });
      process.exitCode = 1;
      return;
    }
    const understanding = (
      read.data as { data?: { understanding?: unknown } } | undefined
    )?.data?.understanding;
    const classification = classificationFromUnderstanding(understanding);
    if (classification) process.stderr.write(`${understandingNote(id)}\n`);
    if (json) {
      this.log(JSON.stringify(classification, null, 2));
      return;
    }
    const lines = classification ? classificationFactLines(classification) : [];
    if (lines.length === 0) {
      process.stderr.write(
        `${classification ? "This email's classification has no facts." : noUnderstandingMessage(understanding)}\n`,
      );
      return;
    }
    this.log(lines.join("\n"));
  }
}

/** The refusals of rule results to a credential that is not a member's own, unnarrowed one. */
const NOT_A_RULE_READER = new Set([
  "rule_author_credential",
  "narrowed_credential",
]);

/** Whether rule results were refused only because of the kind of credential. */
export function refusesRuleResultsToCredential(payload: unknown): boolean {
  if (extractErrorCode(payload) !== "forbidden") return false;
  const { reason } = refusalDetails(payload);
  return typeof reason === "string" && NOT_A_RULE_READER.has(reason);
}

/**
 * The email's `understanding` as the classification rule results show
 * (id, vocabulary, classified_at, facts), when it is ready; otherwise null.
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
  } as Classification;
}

/** Where facts read from the email came from, and how they differ. */
export function understandingNote(id: string): string {
  return `This credential cannot read email rule results, so these facts come from the email itself (\`primitive emails get ${id} --json\`, understanding.facts), as the classifier wrote them. Rule conditions read a multi fact's options lowercased, and a fact left out here reads null to them.`;
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
