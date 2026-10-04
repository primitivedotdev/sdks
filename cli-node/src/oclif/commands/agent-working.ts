import { readSync } from "node:fs";
import { Args, Command, Flags } from "@oclif/core";
import {
  AddressNotesApiError,
  addressNoteTarget,
  runAddressNotesRequest,
} from "../address-notes.js";
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
  buildWorkingClaim,
  CLAIM_MAX_LENGTH,
  formatWorkingClaim,
  readWorkingClaim,
  WORKING_NOTE_NAME,
} from "../working-claim.js";

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

const writeAddressFlag = Flags.string({
  description:
    "Address whose claim to change. A connected profile defaults to, and can change only, its own address; owner logins must pass it.",
});

type CommonFlags = {
  address?: string;
  json?: boolean;
  "api-key"?: string;
  "api-base-url"?: string;
  time?: boolean;
};

type WorkingAction = (context: {
  client: Parameters<typeof runAddressNotesRequest>[0];
  address: string;
}) => Promise<void>;

async function run(
  command: Command,
  flags: CommonFlags,
  write: boolean,
  action: WorkingAction,
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

/** Where `set --stdin` reads the claim from; replaced in tests. */
export const workingClaimStdin = {
  read: (): string => {
    if (process.stdin.isTTY)
      throw new Error(
        "--stdin needs the claim piped in, not typed at a terminal.",
      );
    // A claim is at most CLAIM_MAX_LENGTH characters; stop reading well
    // before a large file or endless stream can use memory or hang.
    const limit = CLAIM_MAX_LENGTH * 4 + 2;
    const buffer = Buffer.alloc(limit + 1);
    let length = 0;
    while (length <= limit) {
      let read = 0;
      try {
        read = readSync(0, buffer, length, limit + 1 - length, null);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EAGAIN") continue;
        if ((error as NodeJS.ErrnoException).code === "EOF") break;
        throw error;
      }
      if (read === 0) break;
      length += read;
    }
    if (length > limit)
      throw new Error(
        `The claim must be at most ${CLAIM_MAX_LENGTH} characters.`,
      );
    return buffer.subarray(0, length).toString("utf8");
  },
};

function isNotFound(error: unknown): boolean {
  return error instanceof AddressNotesApiError && error.status === 404;
}

export class AgentWorkingSetCommand extends Command {
  static summary = "Set this agent's work claim";
  static description =
    `Record what this agent is working on, with an expiry, in the ${WORKING_NOTE_NAME} address note. A claim is one short line naming the task and the files or areas being changed. Pass it as an argument, or with --stdin to keep it out of process listings and shell history. Set it when work starts and clear it when work ends; peers read it before editing a shared file. Claims are advisory, not locks. The claim expires 4 hours from now unless --until is given. The note is stored as JSON { claim, until }. New notes are private to the organization; an update keeps the note's visibility unless --public or --private is given.`;
  static examples = [
    '<%= config.bin %> agent working set "phone composer: apps/mobile/src/message-composer.tsx"',
    '<%= config.bin %> agent working set "billing export: src/billing/" --until 2026-10-01T18:00:00Z',
    "<%= config.bin %> agent working set --stdin < ./private-claim.txt",
  ];
  static args = {
    claim: Args.string({
      description:
        "One line naming the task and the files or areas changed (or use --stdin)",
      required: false,
      // Only --stdin reads stdin, through the bounded reader below; oclif's
      // own stdin fallback would race a 10 ms timeout and read without limit.
      ignoreStdin: true,
    }),
  };
  static flags = {
    ...commonFlags,
    address: writeAddressFlag,
    stdin: Flags.boolean({
      description:
        "Read the claim from stdin instead of an argument, so it stays out of process listings and shell history",
    }),
    until: Flags.string({
      description:
        "Expiry as an ISO 8601 time with a timezone (default: 4 hours from now)",
    }),
    public: Flags.boolean({
      description: "Make the claim note public",
      exclusive: ["private"],
    }),
    private: Flags.boolean({
      description: "Keep the claim note private to the organization",
      exclusive: ["public"],
    }),
  };
  async run(): Promise<void> {
    const { args, flags } = await this.parse(AgentWorkingSetCommand);
    if (flags.stdin && args.claim !== undefined)
      this.error("Pass the claim as an argument or with --stdin, not both.", {
        exit: 2,
      });
    if (!flags.stdin && args.claim === undefined)
      this.error("Pass the claim as an argument, or pipe it in with --stdin.", {
        exit: 2,
      });
    // A trailing newline from a pipe or heredoc is not part of the claim.
    const claim = flags.stdin
      ? workingClaimStdin.read().replace(/\r?\n$/, "")
      : (args.claim as string);
    const value = buildWorkingClaim({ claim, until: flags.until });
    await run(this, flags, true, async ({ client, address }) => {
      const note = (await runAddressNotesRequest(client, {
        action: "set",
        address,
        name: WORKING_NOTE_NAME,
        value,
        visibility: flags.public
          ? "public"
          : flags.private
            ? "private"
            : undefined,
      })) as { visibility?: string };
      if (flags.json)
        this.log(
          JSON.stringify(
            {
              address,
              state: "active",
              claim: value.claim,
              until: value.until,
              visibility: note.visibility ?? null,
            },
            null,
            2,
          ),
        );
      else this.log(`Working claim set until ${value.until}.`);
    });
  }
}

export class AgentWorkingGetCommand extends Command {
  static summary = "Show an agent's active work claim";
  static description =
    `Read the ${WORKING_NOTE_NAME} claim for an address. Prints the claim and its expiry, or "none" when there is no claim or it has expired. A plain-text value written before claims had an expiry is shown as-is. A connected profile defaults to its own address; use --address to check a peer before editing a shared file.`;
  static examples = [
    "<%= config.bin %> agent working get",
    "<%= config.bin %> agent working get --address peer@example.com --json",
  ];
  static flags = {
    ...commonFlags,
    address: Flags.string({
      description:
        "Address to check. A connected profile defaults to its own address.",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentWorkingGetCommand);
    await run(this, flags, false, async ({ client, address }) => {
      let value: unknown = null;
      try {
        const note = (await runAddressNotesRequest(client, {
          action: "get",
          address,
          name: WORKING_NOTE_NAME,
        })) as { value: unknown };
        value = note.value;
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      const view = readWorkingClaim(value);
      if (flags.json) {
        const shown = view.state === "expired" ? "none" : view.state;
        this.log(
          JSON.stringify(
            {
              address,
              state: shown,
              claim: shown === "none" ? null : view.claim,
              until: shown === "none" ? null : view.until,
              ...(view.state === "expired"
                ? { expired_claim: { claim: view.claim, until: view.until } }
                : {}),
            },
            null,
            2,
          ),
        );
      } else this.log(formatWorkingClaim(view));
    });
  }
}

export class AgentWorkingClearCommand extends Command {
  static summary = "Clear this agent's work claim";
  static description =
    `End the ${WORKING_NOTE_NAME} claim when work ends. The claim is rewritten with its expiry set to now, so it reads as none from then on; this works for connected agents, which may write their own notes but not delete them. If that write is refused, the note is deleted instead when the credential allows it. Succeeds when there is no active claim to clear.`;
  static examples = ["<%= config.bin %> agent working clear"];
  static flags = { ...commonFlags, address: writeAddressFlag };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentWorkingClearCommand);
    await run(this, flags, true, async ({ client, address }) => {
      let current: { value: unknown; version: string } | null = null;
      try {
        current = (await runAddressNotesRequest(client, {
          action: "get",
          address,
          name: WORKING_NOTE_NAME,
        })) as { value: unknown; version: string };
      } catch (error) {
        if (!isNotFound(error)) throw error;
      }
      const view = current ? readWorkingClaim(current.value) : null;
      let method: "expired" | "deleted" | null = null;
      if (current && (view?.state === "active" || view?.state === "legacy")) {
        try {
          await runAddressNotesRequest(client, {
            action: "set",
            address,
            name: WORKING_NOTE_NAME,
            value: {
              claim: endedClaimText(view.claim),
              until: new Date().toISOString(),
            },
            ifVersion: current.version,
          });
          method = "expired";
        } catch (error) {
          if (!(error instanceof AddressNotesApiError)) throw error;
          try {
            await runAddressNotesRequest(client, {
              action: "delete",
              address,
              name: WORKING_NOTE_NAME,
              ifVersion: current.version,
            });
            method = "deleted";
          } catch (deleteError) {
            if (!isNotFound(deleteError)) {
              // Report both: why the claim could not be expired, then why
              // the fallback delete failed too.
              writeErrorWithHints(extractErrorPayload(error.payload));
              throw deleteError;
            }
            method = "deleted";
          }
        }
      }
      const cleared = method !== null;
      if (flags.json)
        this.log(JSON.stringify({ address, cleared, method }, null, 2));
      else
        this.log(
          cleared ? "Working claim cleared." : "No working claim to clear.",
        );
    });
  }
}

/** The ended claim keeps its text when that is still a valid one-line claim. */
function endedClaimText(claim: string): string {
  const text = claim.trim();
  return text !== "" && !/[\r\n]/.test(text) && text.length <= CLAIM_MAX_LENGTH
    ? text
    : "cleared";
}
