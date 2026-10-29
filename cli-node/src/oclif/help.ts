import { type Command, Help } from "@oclif/core";

export const FULL_HELP_FLAG = "--help-full";

const NON_TTY_WIDTH = 100;
const MAX_FLAG_NAME_WIDTH = 32;
const EXAMPLE_LIMIT = 2;

/**
 * Commands whose `--help` text is read as a capability check by code already
 * on users' machines: the bundled primitive-connect skill's preflight and
 * agent guidance, and the Claude wake hook, match phrases from these
 * descriptions. They keep the full text on `--help` so those checks still pass.
 */
export const FULL_HELP_COMMANDS: ReadonlySet<string> = new Set([
  "agent:check-mail",
  "agent:connect",
  "agent:enroll",
  "listen",
  "signal",
]);

type ShortHelpFlag = {
  allowNo?: boolean;
  char?: string;
  description?: string;
  exactlyOne?: readonly string[];
  helpValue?: string | string[];
  hidden?: boolean;
  multiple?: boolean;
  required?: boolean;
  summary?: string;
  type: "boolean" | "option";
};

type ShortHelpExample = string | { command: string; description?: string };

type ShortHelpCommand = {
  args?: Record<string, { hidden?: boolean; required?: boolean }>;
  description?: string;
  examples?: readonly ShortHelpExample[];
  flags?: Record<string, ShortHelpFlag>;
  id: string;
  summary?: string;
};

type ShortHelpOptions = {
  bin: string;
  subcommands?: readonly { id: string; summary?: string }[];
  width: number;
};

function renderTemplate(text: string, bin: string): string {
  return text.replaceAll(/<%=\s*config\.bin\s*%>/g, bin);
}

/** The first sentence of the first paragraph, on one line. */
function firstSentence(text: string): string {
  const paragraph = text.trim().split(/\n\s*\n/, 1)[0] ?? "";
  const line = paragraph.replaceAll(/\s+/g, " ").trim();
  const end = /[.!?](?=\s+[A-Z`(]|$)/.exec(line);
  return end ? line.slice(0, end.index + 1) : line;
}

function clip(line: string, width: number): string {
  return line.length <= width
    ? line
    : `${line.slice(0, width - 3).trimEnd()}...`;
}

function flagName(name: string, flag: ShortHelpFlag): string {
  const long =
    flag.type === "boolean" && flag.allowNo
      ? `--${name}, --no-${name}`
      : `--${name}`;
  const value =
    flag.type === "option"
      ? `=${typeof flag.helpValue === "string" ? flag.helpValue : "<value>"}${flag.multiple ? "..." : ""}`
      : "";
  return `${flag.char ? `-${flag.char}, ` : ""}${long}${value}`;
}

function usageLine(command: ShortHelpCommand, bin: string): string {
  const args = Object.entries(command.args ?? {})
    .filter(([, arg]) => !arg.hidden)
    .map(([name, arg]) =>
      arg.required ? name.toUpperCase() : `[${name.toUpperCase()}]`,
    );
  return ["$", bin, command.id, ...args, "[flags]"].join(" ");
}

function exampleCommands(example: ShortHelpExample, bin: string): string[] {
  const lines =
    typeof example === "string"
      ? example.split("\n").map((line) => line.trim())
      : [example.command.trim()];
  return lines
    .map((line) => renderTemplate(line, bin))
    .filter((line) => line.startsWith(`${bin} `) || line.startsWith("$ "))
    .map((line) => (line.startsWith("$ ") ? line : `$ ${line}`));
}

function section(header: string, lines: readonly string[]): string[] {
  return lines.length === 0
    ? []
    : ["", header, ...lines.map((line) => `  ${line}`)];
}

/** A rule the parser enforces, kept in front so clipping never drops it. */
function flagRule(flag: ShortHelpFlag): string {
  if (flag.required) return "(required) ";
  if (flag.exactlyOne?.length)
    return `(exactly one of ${flag.exactlyOne.map((name) => `--${name}`).join(", ")}) `;
  return "";
}

/** One screen of help: what the command does, how to call it, and each flag in a line. */
function formatShortHelp(
  command: ShortHelpCommand,
  { bin, subcommands = [], width }: ShortHelpOptions,
): string {
  const render = (text: string) => renderTemplate(text, bin);
  const summary = render(
    command.summary ?? firstSentence(command.description ?? ""),
  );
  const flags = Object.entries(command.flags ?? {})
    .filter(([, flag]) => !flag.hidden)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, flag]) => ({
      name: flagName(name, flag),
      text:
        flagRule(flag) +
        render(firstSentence(flag.summary ?? flag.description ?? "")),
    }));
  const nameWidth = Math.min(
    MAX_FLAG_NAME_WIDTH,
    Math.max(0, ...flags.map(({ name }) => name.length)),
  );
  const listLine = (name: string, text: string) =>
    clip(
      text ? `  ${name.padEnd(nameWidth)}  ${text}` : `  ${name}`,
      width,
    ).slice(2);
  const examples = (command.examples ?? [])
    .flatMap((example) => exampleCommands(example, bin))
    .slice(0, EXAMPLE_LIMIT);
  return [
    ...(summary ? [summary] : []),
    ...section("USAGE", [usageLine(command, bin)]),
    ...section(
      "FLAGS",
      flags.map(({ name, text }) => listLine(name, text)),
    ),
    ...section(
      "COMMANDS",
      subcommands.map(({ id, summary: text }) =>
        listLine(id, render(firstSentence(text ?? ""))),
      ),
    ),
    ...section("EXAMPLES", examples),
    "",
    `Full help: ${bin} ${command.id} ${FULL_HELP_FLAG}`,
  ].join("\n");
}

function terminalWidth(): number {
  return process.stdout.isTTY && process.stdout.columns
    ? process.stdout.columns
    : NON_TTY_WIDTH;
}

/**
 * Command help is short by default because agents read it into their context.
 * `--help-full` prints oclif's full help.
 */
export default class PrimitiveHelp extends Help {
  private full = false;

  async showHelp(argv: string[]): Promise<void> {
    this.full = argv.includes(FULL_HELP_FLAG);
    await super.showHelp(argv);
  }

  async showCommandHelp(command: Command.Loadable): Promise<void> {
    if (this.full || FULL_HELP_COMMANDS.has(command.id)) {
      await super.showCommandHelp(command);
      return;
    }
    const depth = command.id.split(":").length;
    const subcommands = this.sortedCommands
      .filter(
        (sub) =>
          sub.id.startsWith(`${command.id}:`) &&
          sub.id.split(":").length === depth + 1,
      )
      .map((sub) => ({
        id: sub.id.replaceAll(":", " "),
        summary: sub.summary ?? sub.description,
      }));
    // The cached manifest drops `exactlyOne`, so read it from the command class.
    const loaded = await command.load();
    const flags = Object.fromEntries(
      Object.entries(command.flags ?? {}).map(([name, flag]) => [
        name,
        { ...flag, exactlyOne: loaded.flags?.[name]?.exactlyOne },
      ]),
    );
    this.log(
      formatShortHelp(
        { ...command, flags, id: command.id.replaceAll(":", " ") },
        { bin: this.config.bin, subcommands, width: terminalWidth() },
      ),
    );
  }
}
