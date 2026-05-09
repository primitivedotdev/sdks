import { Args, Command, Errors } from "@oclif/core";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "../openapi/index.js";
import { createOperationCommand } from "./api-command.js";
import EmailsLatestCommand from "./commands/emails-latest.js";
import EmailsWaitCommand from "./commands/emails-wait.js";
import EmailsWatchCommand from "./commands/emails-watch.js";
import LoginCommand from "./commands/login.js";
import LogoutCommand from "./commands/logout.js";
import SendCommand from "./commands/send.js";
import WhoamiCommand from "./commands/whoami.js";
import { renderFishCompletion } from "./fish-completion.js";

class ListOperationsCommand extends Command {
  static description =
    "List all generated API operations as JSON. Useful for piping to `jq` to discover available commands, their request/response schemas, and per-field descriptions. For inspecting a single operation in detail, prefer `primitive describe <command>`.";

  static summary = "List all generated API operations (JSON)";

  async run(): Promise<void> {
    this.log(JSON.stringify(operationManifest, null, 2));
  }
}

// Looks up an operation manifest entry by its `<topic>:<command>` id
// (e.g. `emails:get-email`). On miss, returns up to 5 closest
// candidates by substring match so the caller can render a
// "did you mean" hint. Pure function: no oclif config dependency,
// so it's also unit-testable in isolation.
export function lookupOperation(id: string): {
  match: PrimitiveOperationManifest | null;
  candidates: string[];
} {
  const trimmed = id.trim();
  const sep = trimmed.indexOf(":");
  const tag = sep === -1 ? "" : trimmed.slice(0, sep);
  const cmd = sep === -1 ? trimmed : trimmed.slice(sep + 1);

  const match =
    operationManifest.find(
      (op) => op.command === cmd && op.tagCommand === tag,
    ) ?? null;

  if (match) return { match, candidates: [] };

  const candidates = operationManifest
    .filter((op) => op.command.includes(cmd) || op.tagCommand.includes(tag))
    .slice(0, 5)
    .map((op) =>
      op.tagCommand ? `${op.tagCommand}:${op.command}` : op.command,
    );

  return { match: null, candidates };
}

// `primitive describe <command>` is the operation-detail inspector
// the AGX walkthrough kept wanting. The information is already in
// the operation manifest emitted by `list-operations`, but agents
// don't intuitively reach for `list-operations | jq '.[] | select(...)'`
// when they want to know "what does the from_email field on this
// response actually mean." A direct command is more discoverable.
//
// Lookup is by the colon-joined command id (e.g. `emails:get-email`,
// `sending:send-email`, `account:get-account`). For top-level
// generated commands (without a topic), pass the bare command id.
class DescribeCommand extends Command {
  static args = {
    command: Args.string({
      description:
        "Command id to describe, in `<topic>:<command>` form (e.g. `emails:get-email`). Run `primitive list-operations | jq -r '.[] | \"\\(.tagCommand):\\(.command)\"'` to enumerate.",
      required: true,
    }),
  };

  static description =
    `Print the full operation manifest entry for a single API command, including the path, request schema, response schema, and per-field descriptions sourced from the OpenAPI spec.

  The manifest entry's \`responseSchema\` carries the inlined JSON Schema for the operation's 200/201 \`data\` envelope contents (\`$ref\`s resolved). Use it to look up what specific response fields mean. Examples:

      # Which of EmailDetail's sender-shaped fields is canonical?
      primitive describe emails:get-email | jq '.responseSchema.properties | keys'
      primitive describe emails:get-email | jq -r '.responseSchema.properties.from_email.description'

      # What does each value of SentEmailStatus mean?
      primitive describe sending:get-sent-email | jq -r '.responseSchema.properties.status.description'

  \`requestSchema\` is the same shape for the request body when one exists. For a single field across many operations at once, use \`primitive list-operations | jq\` instead.`;

  static summary = "Describe a single API operation in detail";

  static examples = [
    "<%= config.bin %> describe emails:get-email",
    "<%= config.bin %> describe sending:send-email",
  ];

  async run(): Promise<void> {
    const { args } = await this.parse(DescribeCommand);
    const { match, candidates } = lookupOperation(args.command);

    if (!match) {
      const hint =
        candidates.length > 0
          ? `Did you mean: ${candidates.join(", ")}?`
          : "Run `primitive list-operations` to enumerate.";

      throw new Errors.CLIError(
        `Unknown operation \`${args.command.trim()}\`. ${hint}`,
        { exit: 1 },
      );
    }

    this.log(JSON.stringify(match, null, 2));
  }
}

class CompletionCommand extends Command {
  static args = {
    shell: Args.string({
      description: "Shell type",
      options: ["bash", "zsh", "powershell", "fish"],
      required: true,
    }),
  };

  static description =
    "Show shell completion output or installation instructions for supported shells";

  static summary = "Show shell completion output or installation instructions";

  async run(): Promise<void> {
    const { args } = await this.parse(CompletionCommand);

    if (args.shell === "fish") {
      this.log(renderFishCompletion(this.config.bin));
      return;
    }

    await this.config.runCommand("autocomplete", [args.shell]);
  }
}

function commandId(operation: PrimitiveOperationManifest): string {
  return `${operation.tagCommand}:${operation.command}`;
}

const generatedCommands = Object.fromEntries(
  operationManifest.map((operation) => [
    commandId(operation),
    createOperationCommand(operation),
  ]),
);

export const COMMANDS: Record<string, typeof Command> = {
  completion: CompletionCommand,
  "list-operations": ListOperationsCommand,
  // `describe` prints a single operation's full manifest entry
  // (path, request schema, response schema, per-field descriptions).
  // The same data is in `list-operations` but agents don't reach for
  // `list-operations | jq` when they want to clarify a field meaning.
  describe: DescribeCommand,
  // `send` is the agent-grade shortcut for sending:send-email with
  // sensible defaults (auto from-address, auto subject). The full
  // operation stays available under sending:send-email for callers
  // who want every flag.
  send: SendCommand,
  // `login` creates and stores an org-scoped CLI API key via browser approval.
  login: LoginCommand,
  // `logout` revokes the saved CLI API key and removes local credentials.
  logout: LogoutCommand,
  // `whoami` is the credentials smoke test. Prints the account the
  // current API key authenticates as. AGX walkthroughs kept
  // wanting this before risking a real call against a possibly-
  // bad key.
  whoami: WhoamiCommand,
  // `emails:latest` is the inbox-triage shortcut: the most recent N
  // inbound emails as a compact text table. emails:list-emails stays
  // available for the full JSON envelope + cursor pagination.
  "emails:latest": EmailsLatestCommand,
  // `emails:watch` and `emails:wait` poll the search API for new matching
  // inbound mail. `watch` defaults to a human table; `wait` defaults to JSONL.
  "emails:watch": EmailsWatchCommand,
  "emails:wait": EmailsWaitCommand,
  ...generatedCommands,
};
