import { Args, Command, Flags } from "@oclif/core";
import {
  AddressNotesApiError,
  type AddressNotesRequest,
  addressNoteTarget,
  runAddressNotesRequest,
} from "../address-notes.js";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  readTextFileFlag,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

const commonFlags = {
  address: Flags.string({
    description:
      "Address to target; writes by a connected profile can target only its own address",
  }),
  json: Flags.boolean({ description: "Print JSON (already the default)" }),
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

const nameArg = {
  name: Args.string({
    description: "Case-sensitive note name",
    required: true,
  }),
};

type CommonFlags = {
  address?: string;
  json?: boolean;
  "api-key"?: string;
  "api-base-url"?: string;
  time?: boolean;
};

async function run(
  command: Command,
  request: Omit<AddressNotesRequest, "address">,
  flags: CommonFlags,
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
        request.action === "set" || request.action === "delete",
      );
      const result = await runAddressNotesRequest(apiClient.client, {
        ...request,
        address,
      });
      command.log(JSON.stringify(result, null, 2));
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

export class AgentNotesListCommand extends Command {
  static description =
    "List organization notes for an address. A connected profile defaults to its own address and can read notes for other organization addresses with --address.";
  static summary = "List address notes";
  static flags = {
    ...commonFlags,
    prefix: Flags.string({
      description: "Only names beginning with this prefix",
    }),
    cursor: Flags.string({
      description: "Continue after a note name returned as meta.cursor",
    }),
    limit: Flags.integer({
      description: "Page size (1-100)",
      default: 50,
      min: 1,
      max: 100,
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentNotesListCommand);
    await run(
      this,
      {
        action: "list",
        prefix: flags.prefix,
        cursor: flags.cursor,
        limit: flags.limit,
      },
      flags,
    );
  }
}

export class AgentNotesGetCommand extends Command {
  static description =
    "Read one organization address note. A connected profile defaults to its own address.";
  static summary = "Get an address note";
  static args = nameArg;
  static flags = commonFlags;
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentNotesGetCommand);
    await run(this, { action: "get", name: args.name }, flags);
  }
}

export class AgentNotesSetCommand extends Command {
  static description =
    "Create or update an address note with one conditional write. TEXT is stored as a JSON string; --json-value parses it as JSON. Existing visibility is preserved unless --public or --private is explicit. New notes are private. A connected profile can write only its own address. Conflicts are never retried.";
  static summary = "Set an address note";
  static args = {
    ...nameArg,
    text: Args.string({
      description:
        "Text value (or JSON with --json-value); use --value-file for longer or private content",
    }),
  };
  static flags = {
    ...commonFlags,
    "value-file": Flags.string({
      description:
        "Read the value from a UTF-8 file instead of a command argument",
    }),
    "json-value": Flags.boolean({
      description:
        "Parse the supplied value as JSON instead of storing plain text",
    }),
    "if-version": Flags.string({
      description: "Write only if the note has this exact version",
      exclusive: ["if-absent"],
    }),
    "if-absent": Flags.boolean({
      description: "Create only if the note is absent",
      exclusive: ["if-version"],
    }),
    public: Flags.boolean({
      description: "Make this note public immediately",
      exclusive: ["private"],
    }),
    private: Flags.boolean({
      description: "Keep this note private to the organization",
      exclusive: ["public"],
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentNotesSetCommand);
    if ((args.text === undefined) === (flags["value-file"] === undefined))
      throw new Error("Provide exactly one TEXT argument or --value-file.");
    const source =
      flags["value-file"] === undefined
        ? (args.text ?? "")
        : readTextFileFlag(flags["value-file"], "--value-file");
    let value: unknown = source;
    if (flags["json-value"]) {
      try {
        value = JSON.parse(source);
      } catch {
        throw new Error(
          "The note value must be valid JSON when --json-value is set.",
        );
      }
    }
    await run(
      this,
      {
        action: "set",
        name: args.name,
        value,
        ifAbsent: flags["if-absent"],
        ifVersion: flags["if-version"],
        visibility: flags.public
          ? "public"
          : flags.private
            ? "private"
            : undefined,
      },
      flags,
    );
  }
}

export class AgentNotesDeleteCommand extends Command {
  static description =
    "Delete an address note with its current version. A connected profile can delete only its own notes. Conflicts are never retried.";
  static summary = "Delete an address note";
  static args = nameArg;
  static flags = {
    ...commonFlags,
    "if-version": Flags.string({
      description: "Delete only if the note has this exact version",
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentNotesDeleteCommand);
    await run(
      this,
      { action: "delete", name: args.name, ifVersion: flags["if-version"] },
      flags,
    );
  }
}
