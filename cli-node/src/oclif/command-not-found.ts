import type { Hook } from "@oclif/core";
import { jsonOutputRequested } from "./json-output.js";

/** What the hook needs to know about a command id. */
export type CommandLookup = {
  /** Whether a command has this id, and if so whether it takes arguments. */
  find(id: string): { takesArguments: boolean } | undefined;
  /** Whether any command id starts with `${id}:`. */
  hasSubcommands(id: string): boolean;
  /** The ids of the commands shown in help whose last word is `word`. */
  named?(word: string): readonly string[];
};

/** At most this many commands are suggested for one word. */
const MOST_SUGGESTED = 3;

/**
 * The commands in another group with the word typed where a subcommand was
 * expected, said as a question (`email-rules list-email-rule-objections` is
 * `email-rule-oversight list-email-rule-objections`), or "" when there are
 * none or too many to be a likely meaning. The first word that names one is
 * used, so a mistyped group still finds the command after it.
 */
function elsewhere(words: readonly string[], lookup: CommandLookup): string {
  for (const word of words) {
    const ids = lookup.named?.(word) ?? [];
    if (ids.length === 0) continue;
    if (ids.length > MOST_SUGGESTED) return "";
    const shown = ids.map((id) => `"primitive ${id.split(":").join(" ")}"`);
    return ` Did you mean ${shown.join(" or ")}?`;
  }
  return "";
}

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
      const suggestion = elsewhere(parts.slice(end), lookup);
      return {
        code: "command_not_found",
        message: suggestion
          ? `Unknown command "${typed}".${suggestion}`
          : `Unknown command "${typed}". Run "${shown} --help" to see the commands under it.`,
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
  const suggestion = elsewhere(parts, lookup);
  return {
    code: "command_not_found",
    message: suggestion
      ? `Unknown command "${typed}".${suggestion}`
      : `Unknown command "${typed}". Run "primitive --help" to see the commands.`,
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
    named: (word) =>
      config.commands
        .filter(
          (command) => !command.hidden && command.id.split(":").at(-1) === word,
        )
        .map((command) => command.id)
        .sort(),
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
