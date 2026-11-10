import type { Hook } from "@oclif/core";
import { jsonOutputRequested } from "./json-output.js";

/** What the hook needs to know about a command id. */
export type CommandLookup = {
  /** Whether a command has this id, and if so whether it takes arguments. */
  find(id: string): { takesArguments: boolean } | undefined;
  /** Whether any command id starts with `${id}:`. */
  hasSubcommands(id: string): boolean;
};

export type CommandNotFound = {
  code: "unexpected_argument" | "command_not_found";
  message: string;
};

/**
 * What to say for an id no command has. oclif joins every word before the
 * first flag into the id while no command along the way takes arguments, so
 * `emails list foo` arrives as `emails:list:foo`: when a leading part is a
 * real command, the rest was an argument it does not take.
 */
export function commandNotFoundMessage(
  id: string,
  lookup: CommandLookup,
): CommandNotFound {
  const parts = id.split(":");
  const typed = `primitive ${parts.join(" ")}`;
  for (let end = parts.length - 1; end > 0; end -= 1) {
    const known = parts.slice(0, end).join(":");
    const command = lookup.find(known);
    const topic = lookup.hasSubcommands(known);
    if (!command && !topic) continue;
    const shown = `primitive ${parts.slice(0, end).join(" ")}`;
    const rest = parts.slice(end).join(" ");
    // A topic, or a command that is also one: the word was most likely a
    // mistyped subcommand.
    if (topic || !command) {
      return {
        code: "command_not_found",
        message: `Unknown command "${typed}". Run "${shown} --help" to see the commands under it.`,
      };
    }
    // Typed in the colon form (`emails:get:<id>`), which oclif does not split.
    if (command.takesArguments) {
      return {
        code: "command_not_found",
        message: `Unknown command "${parts.join(":")}". To pass "${rest}" to "${shown}", run "${shown} ${rest}".`,
      };
    }
    return {
      code: "unexpected_argument",
      message: `Unexpected argument "${rest}" for "${shown}", which takes no arguments. Run "${shown} --help" to see the flags it takes.`,
    };
  }
  return {
    code: "command_not_found",
    message: `Unknown command "${typed}". Run "primitive --help" to see the commands.`,
  };
}

/**
 * Say what went wrong in plain words, and under --json as one JSON document
 * on stdout like every other failure, instead of oclif's "command <id> not
 * found" naming a command nobody typed.
 */
const hook: Hook<"command_not_found"> = async (options) => {
  const { config } = options;
  const { code, message } = commandNotFoundMessage(options.id, {
    find: (id) => {
      const command = config.findCommand(id);
      return command
        ? { takesArguments: Object.keys(command.args ?? {}).length > 0 }
        : undefined;
    },
    hasSubcommands: (id) =>
      config.commandIDs.some((other) => other.startsWith(`${id}:`)),
  });
  if (
    jsonOutputRequested([...process.argv.slice(2), ...(options.argv ?? [])])
  ) {
    process.stdout.write(
      `${JSON.stringify({ error: { code, message }, exit_code: 2 }, null, 2)}\n`,
    );
  } else {
    process.stderr.write(` ›   Error: ${message}\n`);
  }
  process.exitCode = 2;
  return message;
};

export default hook;
