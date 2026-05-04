import { Args, Command } from "@oclif/core";
import {
  operationManifest,
  type PrimitiveOperationManifest,
} from "../openapi/index.js";
import { createOperationCommand } from "./api-command.js";
import SendCommand from "./commands/send.js";
import WhoamiCommand from "./commands/whoami.js";
import { renderFishCompletion } from "./fish-completion.js";

class ListOperationsCommand extends Command {
  static description = "List all generated API operations";

  static summary = "List all generated API operations";

  async run(): Promise<void> {
    this.log(JSON.stringify(operationManifest, null, 2));
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
  // `send` is the agent-grade shortcut for sending:send-email with
  // sensible defaults (auto from-address, auto subject). The full
  // operation stays available under sending:send-email for callers
  // who want every flag.
  send: SendCommand,
  // `whoami` is the credentials smoke test. Prints the account the
  // current API key authenticates as. AGX walkthroughs kept
  // wanting this before risking a real call against a possibly-
  // bad key.
  whoami: WhoamiCommand,
  ...generatedCommands,
};
