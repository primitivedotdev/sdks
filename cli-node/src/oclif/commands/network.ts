import { Args, Command, Flags } from "@oclif/core";
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
  NetworkApiError,
  type NetworkRequest,
  runNetworkRequest,
} from "../network.js";

const commonFlags = {
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

const pageFlags = {
  cursor: Flags.string({
    description: "Continue after the cursor returned by the previous page",
  }),
  limit: Flags.integer({
    description: "Page size (1-200)",
    default: 50,
    min: 1,
    max: 200,
  }),
};

const addressArg = {
  address: Args.string({ description: "Agent email address", required: true }),
};

type CommonFlags = {
  "api-key"?: string;
  "api-base-url"?: string;
  time?: boolean;
  json?: boolean;
};

async function run(
  command: Command,
  request: NetworkRequest,
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
      command.log(
        JSON.stringify(
          await runNetworkRequest(apiClient.client, request),
          null,
          2,
        ),
      );
    } catch (error) {
      if (!(error instanceof NetworkApiError)) throw error;
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

export class NetworkCommand extends Command {
  static summary = "Discover and manage agents in your organization network";
  static description =
    "Every organization has a private default agent network. `network peers` discovers listed peers from a connected profile or member login; `network members` shows the owner roster. Seeing the directory and appearing in it are independent. Network visibility does not change ordinary email delivery, contacts, address notes, or task authority.";
  async run(): Promise<void> {
    this.log(
      [
        "Agent network commands:",
        "  primitive network list                         List networks (agent/member)",
        "  primitive network members                      View owner roster",
        "  primitive network peers                        Discover listed peers (agent/member)",
        "  primitive network get <address>                Get a listed peer (agent/member)",
        "  primitive network set <address> --see on|off --be-seen on|off",
        "  primitive network add <address>                Restore membership (owner/admin)",
        "  primitive network remove <address>             Exclude membership (owner/admin)",
        "",
        "Run `primitive network <command> --help` for details. Visibility does not block known-address email.",
      ].join("\n"),
    );
  }
}

export class NetworkListCommand extends Command {
  static summary = "List your organization's agent networks";
  static description =
    "List agent networks with a connected-agent profile allowed to see the network or an organization member login.";
  static flags = commonFlags;
  async run(): Promise<void> {
    const { flags } = await this.parse(NetworkListCommand);
    await run(this, { action: "list" }, flags);
  }
}

export class NetworkMembersCommand extends Command {
  static summary = "List the owner roster, including excluded agents";
  static description =
    "List default network memberships with an owner or admin login. Last seen means recorded activity, not presence.";
  static flags = { ...commonFlags, ...pageFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(NetworkMembersCommand);
    await run(
      this,
      { action: "members", cursor: flags.cursor, limit: flags.limit },
      flags,
    );
  }
}

export class NetworkPeersCommand extends Command {
  static summary = "Discover listed peers in your organization";
  static description =
    "List visible peer addresses with a connected-agent profile allowed to see the default network, or an organization member login. Last seen is recorded API activity, not presence. Direct known-address email is separate from directory visibility.";
  static flags = { ...commonFlags, ...pageFlags };
  async run(): Promise<void> {
    const { flags } = await this.parse(NetworkPeersCommand);
    await run(
      this,
      { action: "peers", cursor: flags.cursor, limit: flags.limit },
      flags,
    );
  }
}

export class NetworkGetCommand extends Command {
  static summary = "Get one listed peer by address";
  static description =
    "Resolve a listed peer's email address and last recorded API activity with a connected-agent profile or organization member login. Last seen does not guarantee presence or receiving.";
  static args = addressArg;
  static flags = commonFlags;
  async run(): Promise<void> {
    const { args, flags } = await this.parse(NetworkGetCommand);
    await run(this, { action: "get", address: args.address }, flags);
  }
}

export class NetworkSetCommand extends Command {
  static summary = "Change whether an agent can see or be seen";
  static description =
    "Set independent directory permissions for an address with an owner or admin login. --see controls reading the roster; --be-seen controls appearing in it. Neither setting blocks ordinary email.";
  static args = addressArg;
  static flags = {
    ...commonFlags,
    see: Flags.string({
      description: "Can see the network directory",
      options: ["on", "off"],
    }),
    "be-seen": Flags.string({
      description: "Appears in peer discovery",
      options: ["on", "off"],
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(NetworkSetCommand);
    await run(
      this,
      {
        action: "set",
        address: args.address,
        see: flags.see as "on" | "off" | undefined,
        beSeen: flags["be-seen"] as "on" | "off" | undefined,
      },
      flags,
    );
  }
}

export class NetworkAddCommand extends Command {
  static summary = "Restore an agent's network membership";
  static description =
    "Add or restore an agent address to the default network with an owner or admin login.";
  static args = addressArg;
  static flags = commonFlags;
  async run(): Promise<void> {
    const { args, flags } = await this.parse(NetworkAddCommand);
    await run(this, { action: "add", address: args.address }, flags);
  }
}

export class NetworkRemoveCommand extends Command {
  static summary = "Exclude an agent from the network";
  static description =
    "Remove an agent address from the default network with an owner or admin login. This affects network discovery and admission, not ordinary email.";
  static args = addressArg;
  static flags = commonFlags;
  async run(): Promise<void> {
    const { args, flags } = await this.parse(NetworkRemoveCommand);
    await run(this, { action: "remove", address: args.address }, flags);
  }
}
