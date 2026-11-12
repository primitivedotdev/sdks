// A generated command's boolean flag that has a --no- form also takes true or
// false as its value: `--enabled false` and `--enabled=false` are
// `--no-enabled`, and `--enabled true` is `--enabled`. The bare flag still
// means true.
//
// oclif reads a boolean flag as taking no value, so without this the `false`
// of `--enabled false` was left over as an argument. On a command whose path
// id is also its first argument (`endpoints update`), that argument was read
// as the id. `--enabled=false` was worse: oclif split it into `--enabled`,
// which is true, and a `false` argument.
//
// Only flags with a --no- form are read this way, since true and false then
// map onto flags the command already has. Such a flag followed by another
// yes or no word (yes, no, y, n, on, off, 1, 0), and its --no- form followed
// by any of those or by true or false, are refused, since what they mean
// would be a guess and the word would otherwise be read as the path id.
// Other flags and arguments are left as typed, and the value of a flag that
// takes one (`--description false`) is never read as a boolean's.
//
// One difference from oclif is wanted. oclif reads every word after a
// repeatable flag (`--event-types a b`) as its value until the next flag that
// takes one, so `--event-types a --enabled false` used to add `false` to the
// event types; it now sends enabled false. Any other word there still goes
// to the repeatable flag, as before: in `--event-types a --enabled <id>`, the
// id is read as an event type, so give the id first or with --id.

import { Errors } from "@oclif/core";

type FlagDefinition = {
  aliases?: unknown;
  allowNo?: unknown;
  char?: unknown;
  charAliases?: unknown;
  type?: unknown;
};

// Words read as a yes or no that are not true or false: refused after a
// boolean flag rather than read as an argument.
const OTHER_BOOLEAN_WORDS = new Set([
  "yes",
  "no",
  "y",
  "n",
  "on",
  "off",
  "1",
  "0",
]);

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function booleanValue(text: string | undefined): boolean | undefined {
  const word = text?.toLowerCase();
  return word === "true" ? true : word === "false" ? false : undefined;
}

function refuseOtherWord(flag: string, word: string | undefined): void {
  if (word !== undefined && OTHER_BOOLEAN_WORDS.has(word.toLowerCase()))
    throw new Errors.CLIError(
      `--${flag} takes true or false, or no value for true; got "${word}".`,
      { exit: 2 },
    );
}

/**
 * `argv` with each `--flag true|false` and `--flag=true|false` of a boolean
 * flag that has a --no- form written as `--flag` or `--no-flag`. Scanning
 * stops at `--`. Throws a usage error (exit 2) for such a flag given any
 * other value after `=`, or followed by another yes or no word, and for its
 * --no- form given a value, any of which oclif would otherwise read as an
 * argument.
 */
export function withBooleanFlagValues(
  argv: readonly string[],
  flags: Record<string, unknown>,
): string[] {
  // Every long name and alias, mapped to the flag's own name and definition.
  const byName = new Map<string, { name: string; flag: FlagDefinition }>();
  // Short names of flags that take a value, as `-x <value>`.
  const valueChars = new Set<string>();
  for (const [name, raw] of Object.entries(flags)) {
    const flag = (raw ?? {}) as FlagDefinition;
    for (const alias of [name, ...strings(flag.aliases)]) {
      byName.set(alias, { name, flag });
    }
    if (flag.type === "option") {
      for (const char of [flag.char, ...strings(flag.charAliases)]) {
        if (typeof char === "string") valueChars.add(char);
      }
    }
  }
  const negatable = (flag: FlagDefinition | undefined) =>
    flag?.type === "boolean" && flag.allowNo === true;

  const out: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      out.push(...argv.slice(index));
      break;
    }
    if (token.startsWith("--")) {
      const equals = token.indexOf("=");
      const typed = token.slice(2, equals === -1 ? undefined : equals);
      const given = equals === -1 ? undefined : token.slice(equals + 1);
      const found = byName.get(typed);
      if (found && negatable(found.flag)) {
        if (given !== undefined) {
          const value = booleanValue(given);
          if (value === undefined)
            throw new Errors.CLIError(
              `--${typed} takes true or false, or no value for true; got "${given}".`,
              { exit: 2 },
            );
          out.push(value ? `--${found.name}` : `--no-${found.name}`);
          continue;
        }
        const value = booleanValue(argv[index + 1]);
        if (value !== undefined) {
          out.push(value ? `--${found.name}` : `--no-${found.name}`);
          index += 1;
          continue;
        }
        refuseOtherWord(typed, argv[index + 1]);
        out.push(token);
        continue;
      }
      // A --no- form takes no value, and true or false after one is never an
      // argument: its meaning would be a guess.
      const positive = typed.startsWith("no-")
        ? byName.get(typed.slice(3))
        : undefined;
      if (
        !found &&
        positive &&
        negatable(positive.flag) &&
        (given !== undefined ||
          booleanValue(argv[index + 1]) !== undefined ||
          OTHER_BOOLEAN_WORDS.has(String(argv[index + 1]).toLowerCase()))
      )
        throw new Errors.CLIError(
          `--${typed} takes no value; use --${positive.name} true or false, or --${typed} alone.`,
          { exit: 2 },
        );
      out.push(token);
      // A flag that takes a value, given without `=`, takes the next token.
      if (
        found?.flag.type === "option" &&
        given === undefined &&
        index + 1 < argv.length
      ) {
        out.push(argv[index + 1]);
        index += 1;
      }
      continue;
    }
    out.push(token);
    if (
      token.length === 2 &&
      token[0] === "-" &&
      valueChars.has(token[1]) &&
      index + 1 < argv.length
    ) {
      out.push(argv[index + 1]);
      index += 1;
    }
  }
  return out;
}
