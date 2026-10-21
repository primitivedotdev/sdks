import { writeFileSync } from "node:fs";
import { Args, Command, Flags } from "@oclif/core";
import {
  downloadEmailAttachmentArchiveMember,
  downloadEmailAttachmentByFilename,
  downloadSentAttachmentArchiveMember,
  downloadSentAttachmentByFilename,
  listEmailAttachmentArchiveMembers,
  listSentAttachmentArchiveMembers,
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
import {
  ATTACHMENT_WAIT_FLAG_DESCRIPTION,
  ATTACHMENT_WAIT_MAX_MS,
  withAttachmentWait,
} from "../attachment-wait.js";

const sharedFlags = {
  sent: Flags.boolean({
    description:
      "Read an email you sent (a sent email id) instead of one you received.",
  }),
  output: Flags.string({
    char: "o",
    description:
      "Write the bytes to this file instead of stdout. Nothing else is written to stdout.",
  }),
  wait: Flags.boolean({
    description: ATTACHMENT_WAIT_FLAG_DESCRIPTION,
    default: true,
    allowNo: true,
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

type Result = { data?: unknown; error?: unknown; response?: Response };

/** Retries attachment_not_ready unless --no-wait, with the note on stderr. */
function waitFor(call: () => Promise<Result>, wait: boolean): Promise<Result> {
  return withAttachmentWait(call, {
    wait,
    errorCode: (error) => extractErrorCode(extractErrorPayload(error)),
    onFirstWait: () => {
      process.stderr.write(
        `Attachment content is not ready yet; waiting up to ${ATTACHMENT_WAIT_MAX_MS / 1000}s. Pass --no-wait to return immediately.\n`,
      );
    },
  });
}

/** Writes downloaded bytes to --output or stdout. */
async function writeBytes(
  data: unknown,
  output: string | undefined,
): Promise<void> {
  const bytes = Buffer.from(await (data as Blob).arrayBuffer());
  if (output) writeFileSync(output, bytes);
  else process.stdout.write(bytes);
}

type ClientContext = Awaited<
  ReturnType<typeof createAuthenticatedCliApiClient>
>;

function reportFailure(
  command: Command,
  context: ClientContext,
  error: unknown,
): void {
  const payload = extractErrorPayload(error);
  writeErrorWithHints(payload);
  surfaceUnauthorizedHint({
    auth: context.auth,
    baseUrlOverridden: context.baseUrlOverridden,
    configDir: command.config.configDir,
    payload,
  });
  process.exitCode = 1;
}

export class EmailsAttachmentCommand extends Command {
  static summary = "Download one attachment by its filename";

  static description =
    `Download one attachment of an email by its exact filename, without looking up its part_index first.

  The filename is matched exactly (case-sensitive, after Unicode NFC
  normalization) against the attachment names in the email's metadata.
  Any name works, including one made only of digits. When two or more
  attachments share the name, nothing is downloaded and the command
  exits 1 with error code attachment_name_ambiguous; error.details
  lists every matching part_index, and
  \`primitive emails download-email-attachment-part --id <id> --part-index <n>\`
  fetches one of them.

  stdout carries only the attachment bytes, unless --output names a file.
  With --sent, <id> is a sent email id and the attachment is one you sent.`;

  static examples = [
    "<%= config.bin %> emails attachment <email-id> report.pdf --output report.pdf",
    "<%= config.bin %> emails attachment <sent-email-id> invoice.csv --sent > invoice.csv",
  ];

  static args = {
    id: Args.string({ description: "Email id", required: true }),
    filename: Args.string({
      description: "Exact attachment filename",
      required: true,
    }),
  };

  static flags = sharedFlags;

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EmailsAttachmentCommand);
    const context = await createAuthenticatedCliApiClient({
      configDir: this.config.configDir,
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
    });
    await runWithTiming(flags.time, async () => {
      const options = {
        client: context.apiClient.client,
        path: { id: args.id },
        query: { filename: args.filename },
        parseAs: "blob" as const,
      };
      const result = await waitFor(
        () =>
          flags.sent
            ? downloadSentAttachmentByFilename(options)
            : downloadEmailAttachmentByFilename(options),
        flags.wait,
      );
      if (result.error) {
        reportFailure(this, context, result.error);
        return;
      }
      await writeBytes(result.data, flags.output);
    });
  }
}

export class EmailsAttachmentMembersCommand extends Command {
  static summary =
    "List the files inside a zip or tar attachment, or fetch one";

  static description =
    `List the files inside a zip, tar or tar.gz attachment, or download one of them with --member.

  <attachment> is the attachment's part_index when it is only digits,
  otherwise its exact filename. The listing prints JSON: the attachment's
  part_index and filename, the archive format, and members, each with
  path, size_bytes and sha256. Directories and links are not listed.

  With --member <path>, the command downloads that one file instead, by
  the path the listing reports. stdout then carries only its bytes,
  unless --output names a file.

  The server refuses archives that are not zip or tar, that hold an
  unsafe path (absolute, "..", backslashes and similar), or that exceed
  its size, entry-count or compression-ratio limits. Each refusal exits 1
  with its error code, for example archive_unsafe_path or
  archive_limit_exceeded.`;

  static examples = [
    "<%= config.bin %> emails attachment-members <email-id> logs.zip",
    "<%= config.bin %> emails attachment-members <email-id> 0 --member logs/run.txt --output run.txt",
    "<%= config.bin %> emails attachment-members <sent-email-id> bundle.tar.gz --sent",
  ];

  static args = {
    id: Args.string({ description: "Email id", required: true }),
    attachment: Args.string({
      description:
        "The attachment: its part_index when only digits, otherwise its exact filename",
      required: true,
    }),
  };

  static flags = {
    ...sharedFlags,
    member: Flags.string({
      description:
        "Download the file at this path inside the archive, as the listing reports it.",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EmailsAttachmentMembersCommand);
    const context = await createAuthenticatedCliApiClient({
      configDir: this.config.configDir,
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
    });
    await runWithTiming(flags.time, async () => {
      const client = context.apiClient.client;
      const member = flags.member;
      if (member !== undefined) {
        const options = {
          client,
          path: { id: args.id, attachment: args.attachment, path: member },
          parseAs: "blob" as const,
        };
        const result = await waitFor(
          () =>
            flags.sent
              ? downloadSentAttachmentArchiveMember(options)
              : downloadEmailAttachmentArchiveMember(options),
          flags.wait,
        );
        if (result.error) {
          reportFailure(this, context, result.error);
          return;
        }
        await writeBytes(result.data, flags.output);
        return;
      }
      const options = {
        client,
        path: { id: args.id, attachment: args.attachment },
      };
      const result = await waitFor(
        () =>
          flags.sent
            ? listSentAttachmentArchiveMembers(options)
            : listEmailAttachmentArchiveMembers(options),
        flags.wait,
      );
      if (result.error) {
        reportFailure(this, context, result.error);
        return;
      }
      const listing = (result.data as { data?: unknown } | undefined)?.data;
      const text = `${JSON.stringify(listing, null, 2)}\n`;
      if (flags.output) writeFileSync(flags.output, text);
      else process.stdout.write(text);
    });
  }
}
