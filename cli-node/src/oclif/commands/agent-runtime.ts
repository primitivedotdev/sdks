import { Command, Flags } from "@oclif/core";
import {
  AddressNotesApiError,
  addressNoteTarget,
  runAddressNotesRequest,
} from "../address-notes.js";
import {
  defaultRuntimeNote,
  RUNTIME_NOTE_MAX_LENGTH,
  RUNTIME_NOTE_NAME,
  runtimeNoteValue,
} from "../agent-runtime-note.js";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

const commonFlags = {
  json: Flags.boolean({ description: "Print the result as JSON" }),
  "api-key": Flags.string({
    description: "API key override",
    env: "PRIMITIVE_API_KEY",
  }),
  "api-base-url": Flags.string({
    description: API_BASE_URL_FLAG_DESCRIPTION,
    env: "PRIMITIVE_API_BASE_URL",
    hidden: true,
  }),
  time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
};

type CommonFlags = {
  address?: string;
  json?: boolean;
  "api-key"?: string;
  "api-base-url"?: string;
  time?: boolean;
};

type NoteRow = {
  value: unknown;
  visibility?: string;
  version?: string;
  updated_at?: string;
};

async function run(
  command: Command,
  flags: CommonFlags,
  write: boolean,
  action: (context: {
    client: Parameters<typeof runAddressNotesRequest>[0];
    address: string;
  }) => Promise<void>,
): Promise<void> {
  const { apiClient, auth, baseUrlOverridden } =
    await createAuthenticatedCliApiClient({
      configDir: command.config.configDir,
      apiKey: flags["api-key"],
      apiBaseUrl: flags["api-base-url"],
    });
  await runWithTiming(flags.time, async () => {
    try {
      const address = addressNoteTarget(
        flags.address,
        auth.connectedAgent?.agentAddress,
        write,
      );
      await action({ client: apiClient.client, address });
    } catch (error) {
      if (!(error instanceof AddressNotesApiError)) throw error;
      const payload = extractErrorPayload(error.payload);
      writeErrorWithHints(payload);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: command.config.configDir,
        payload,
      });
      process.exitCode = 1;
    }
  });
}

export class AgentRuntimeSetCommand extends Command {
  static summary = "Record where this agent runs";
  static description =
    `Write the private ${RUNTIME_NOTE_NAME} address note: one line saying where this agent runs and what it is, so its owner and peers can tell sessions apart. Without --value the line is \`<runtime> on <host> at <directory>\`, for example "Claude Code on my-laptop at ~/projects/app". The runtime is Claude Code, Codex or omp when detected, otherwise CLI; the host is the machine name without a trailing .local; the directory is the current one, with the home directory shown as ~. No environment values or credentials are included. The note is private to the organization, and an existing note is updated in place. Offer this to your owner before writing it.`;
  static examples = [
    "<%= config.bin %> agent runtime set",
    '<%= config.bin %> agent runtime set --value "Codex on build-box at ~/src/api" --json',
  ];
  static flags = {
    ...commonFlags,
    value: Flags.string({
      description: `One line to store instead of the computed default, at most ${RUNTIME_NOTE_MAX_LENGTH} characters`,
    }),
    address: Flags.string({
      description:
        "Address whose note to write. A connected profile defaults to, and can write only, its own address; owner logins must pass it.",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentRuntimeSetCommand);
    const value =
      flags.value === undefined
        ? defaultRuntimeNote()
        : runtimeNoteValue(flags.value);
    await run(this, flags, true, async ({ client, address }) => {
      // Reads the current version first, so an existing note is updated.
      const note = (await runAddressNotesRequest(client, {
        action: "set",
        address,
        name: RUNTIME_NOTE_NAME,
        value,
        visibility: "private",
      })) as NoteRow;
      if (flags.json)
        this.log(
          JSON.stringify(
            {
              address,
              name: RUNTIME_NOTE_NAME,
              value,
              visibility: note.visibility ?? "private",
              version: note.version ?? null,
            },
            null,
            2,
          ),
        );
      else this.log(`${RUNTIME_NOTE_NAME} set: ${value}`);
    });
  }
}

export class AgentRuntimeGetCommand extends Command {
  static summary = "Show where an agent runs";
  static description =
    `Read the ${RUNTIME_NOTE_NAME} address note for an address. Prints its one line, or "none" when the note is absent. A connected profile defaults to its own address.`;
  static examples = [
    "<%= config.bin %> agent runtime get",
    "<%= config.bin %> agent runtime get --address peer@example.com --json",
  ];
  static flags = {
    ...commonFlags,
    address: Flags.string({
      description:
        "Address to read. A connected profile defaults to its own address.",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentRuntimeGetCommand);
    await run(this, flags, false, async ({ client, address }) => {
      let note: NoteRow | null = null;
      try {
        note = (await runAddressNotesRequest(client, {
          action: "get",
          address,
          name: RUNTIME_NOTE_NAME,
        })) as NoteRow;
      } catch (error) {
        if (!(error instanceof AddressNotesApiError) || error.status !== 404)
          throw error;
      }
      const value =
        note === null
          ? null
          : typeof note.value === "string"
            ? note.value
            : JSON.stringify(note.value);
      if (flags.json)
        this.log(
          JSON.stringify(
            {
              address,
              name: RUNTIME_NOTE_NAME,
              value,
              visibility: note?.visibility ?? null,
              updated_at: note?.updated_at ?? null,
            },
            null,
            2,
          ),
        );
      else this.log(value ?? "none");
    });
  }
}
