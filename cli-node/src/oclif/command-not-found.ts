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
  /** Visible command ids, used for nearby spelling and topic matches. */
  visible?: readonly string[];
  /** Explicitly visible root commands and topics, never inferred from children. */
  roots?: readonly string[];
};

/** At most this many commands are suggested for one word. */
const MOST_SUGGESTED = 3;

/**
 * The commands in another group named by the word typed where a subcommand
 * was expected, said as a question (`email-rules list-email-rule-objections`
 * is `email-rule-oversight list-email-rule-objections`), or none when there are
 * none or too many to be a likely meaning. Only those words are looked up,
 * never a value typed after them, which can be any word at all.
 */
function elsewhere(words: readonly string[], lookup: CommandLookup): string[] {
  for (const word of words) {
    const ids = lookup.named?.(word) ?? [];
    if (ids.length === 0) continue;
    return ids.length > MOST_SUGGESTED ? [] : [...ids];
  }
  return [];
}

/** Damerau distance also catches adjacent transpositions such as `lsit`. */
function distance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, i) => i);
  let before = previous;
  for (let i = 0; i < left.length; i += 1) {
    const current = [i + 1];
    for (let j = 0; j < right.length; j += 1) {
      current[j + 1] = Math.min(
        (current[j] ?? 0) + 1,
        (previous[j + 1] ?? 0) + 1,
        (previous[j] ?? 0) + (left[i] === right[j] ? 0 : 1),
      );
      if (
        i > 0 &&
        j > 0 &&
        left[i] === right[j - 1] &&
        left[i - 1] === right[j]
      )
        current[j + 1] = Math.min(
          current[j + 1] ?? 0,
          (before[j - 1] ?? 0) + 1,
        );
    }
    before = previous;
    previous = current;
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function nearby(word: string, ids: readonly string[]): string[] {
  // Long input is more likely a value than a command, and must not make a
  // suggestion's edit-distance work unbounded.
  if (!word || word.length > 80) return [];
  const singular = (value: string) =>
    value.length > 3 ? value.replace(/s$/, "") : value;
  const name = singular(word.toLowerCase());
  const maximum = Math.max(1, Math.min(2, Math.floor(name.length / 3)));
  return ids
    .map((id) => {
      const candidate = id.split(":").at(-1) ?? id;
      const score =
        name.length >= 3 && candidate.startsWith(`${word.toLowerCase()}-`)
          ? 0.5
          : distance(name, singular(candidate));
      return { id, score };
    })
    .filter(({ score }) => score <= maximum)
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, MOST_SUGGESTED)
    .map(({ id }) => id);
}

function suggestions(
  words: readonly string[],
  lookup: CommandLookup,
  topic?: string,
): string[] {
  const visible = lookup.visible ?? [];
  if (topic) {
    const depth = topic.split(":").length + 1;
    const siblings = visible.filter(
      (id) => id.startsWith(`${topic}:`) && id.split(":").length === depth,
    );
    const matches = nearby(words[0] ?? "", siblings);
    if (matches.length > 0) return matches;
  }
  const exact = elsewhere(words, lookup);
  if (exact.length > 0) return exact;
  const roots = (
    lookup.roots ?? visible.filter((id) => !id.includes(":"))
  ).filter((id) => id !== topic);
  return nearby(topic ?? words[0] ?? "", roots);
}

function unknown(
  typed: string,
  ids: readonly string[],
  help: string,
  lookup: CommandLookup,
): CommandNotFound {
  const commands = ids.map(
    (id) =>
      `primitive ${id.split(":").join(" ")}${lookup.find(id) ? "" : " --help"}`,
  );
  const hint = commands.length
    ? ` Did you mean ${commands.map((command) => `"${command}"`).join(" or ")}?`
    : "";
  return {
    code: "command_not_found",
    message: `Unknown command "${typed}".${hint} ${help}`,
    ...(commands.length ? { details: { suggestions: commands } } : {}),
  };
}

/** A command owns its visibility; topic visibility applies only without one. */
function visibleRoots(
  commands: readonly { id: string; hidden?: boolean }[],
  topics: readonly { name: string; hidden?: boolean }[],
): string[] {
  const rootCommands = commands.filter((command) => !command.id.includes(":"));
  const declared = new Set(rootCommands.map((command) => command.id));
  return [
    ...new Set([
      ...rootCommands
        .filter((command) => !command.hidden)
        .map((command) => command.id),
      ...topics
        .filter(
          (topic) =>
            !topic.name.includes(":") &&
            !declared.has(topic.name) &&
            !topic.hidden,
        )
        .map((topic) => topic.name),
    ]),
  ];
}

export type CommandNotFound = {
  code: "unexpected_argument" | "command_not_found";
  message: string;
  details?: { suggestions: string[] };
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
      return unknown(
        typed,
        suggestions(parts.slice(end, end + 1), lookup, known),
        `Run "${shown} --help" to see the commands under it.`,
        lookup,
      );
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
  // A mistyped group, or a command typed without one.
  return unknown(
    typed,
    suggestions(parts.slice(0, 2), lookup),
    'Run "primitive --help" to see the commands.',
    lookup,
  );
}

/**
 * Say what went wrong in plain words, and under --json as one JSON document
 * on stdout like every other failure, instead of oclif's "command <id> not
 * found" naming a command nobody typed.
 */
const hook: Hook<"command_not_found"> = async (options) => {
  const { config } = options;
  const visible = config.commands
    .filter((command) => !command.hidden)
    .map((command) => command.id);
  const roots = visibleRoots(config.commands, config.topics);
  const error = commandNotFoundMessage(options.id, {
    find: (id) => {
      const command = config.findCommand(id);
      return command
        ? { takesArguments: Object.keys(command.args ?? {}).length > 0 }
        : undefined;
    },
    hasSubcommands: (id) =>
      config.commandIDs.some((other) => other.startsWith(`${id}:`)),
    named: (word) =>
      visible.filter((id) => id.split(":").at(-1) === word).sort(),
    visible,
    roots,
  });
  if (
    jsonOutputRequested([...process.argv.slice(2), ...(options.argv ?? [])])
  ) {
    process.stdout.write(
      `${JSON.stringify({ error, exit_code: 2 }, null, 2)}\n`,
    );
  } else {
    process.stderr.write(` ›   Error: ${error.message}\n`);
  }
  process.exitCode = 2;
  return error.message;
};

export default hook;
