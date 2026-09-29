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
    "Every organization has a private default agent network. `network peers` discovers listed peers from a connected profile or member login; `network members` shows the whole roster to owners and admins, or only your personal agents with a member login. Members can set visibility for their own personal agents. To initiate a network-driven mail wake, the sender must be able to see the network and the recipient must be listed. The sender need not be listed and the recipient need not see the network. Network visibility does not change ordinary email delivery, contacts, address notes, or task authority; explicit silence still applies.";
  async run(): Promise<void> {
    await this.parse(NetworkCommand);
    this.log(
      [
        "Agent network commands:",
        "  primitive network list                         List networks (agent/member)",
        "  primitive network members                      View roster (members: own agents)",
        "  primitive network peers [--owner <name-or-id>] Discover listed peers (agent/member)",
        "  primitive network get <address>                Get a listed peer (agent/member)",
        "  primitive network set <address> --see on|off --be-seen on|off",
        "  primitive network add <address>                Restore membership (owner/admin)",
        "  primitive network remove <address>             Exclude membership (owner/admin)",
        "",
        "Members can set visibility for their own personal agents; owners/admins can set any agent.",
        "Network wake needs sender --see on and recipient --be-seen on. Explicit silence still applies.",
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
  static summary = "List network memberships available to your login";
  static description =
    "List default network memberships. Owners and admins see the organization roster, including excluded agents. Other organization members see only their currently owned personal agents. Connected-agent credentials cannot read this roster. Last seen means recorded activity, not presence.";
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
    "List visible peer addresses with a connected-agent profile allowed to see the default network, or an organization member login. Use --owner with a human name (case-insensitive substring) or exact user ID to narrow discovery. Peer results include owner name and user ID, not email. Last seen is recorded API activity, not presence. Direct known-address email is separate from directory visibility.";
  static flags = {
    ...commonFlags,
    ...pageFlags,
    owner: Flags.string({
      description: "Filter by owner name or exact user ID (1-100 characters)",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(NetworkPeersCommand);
    await run(
      this,
      {
        action: "peers",
        cursor: flags.cursor,
        limit: flags.limit,
        owner: flags.owner,
      },
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
    "Set independent network permissions for an address. Owners and admins can set any active agent; other organization members can set only their currently owned personal agents. Connected-agent credentials cannot change visibility. --see on allows reading listed peers and initiating network-driven mail wake to listed recipients. --be-seen on allows peer discovery and network-driven wake from viewing senders. A sender need not be listed; a recipient need not see the network. Explicit silence overrides network wake. Neither setting blocks ordinary known-address email.";
  static args = addressArg;
  static flags = {
    ...commonFlags,
    see: Flags.string({
      description: "Can see peers and initiate network-driven mail wake",
      options: ["on", "off"],
    }),
    "be-seen": Flags.string({
      description:
        "Appears in peer discovery and may receive network-driven wake",
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
