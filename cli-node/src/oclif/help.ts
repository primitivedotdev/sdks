import {
  type Command,
  CommandHelp,
  Help,
  type HelpSectionRenderer,
} from "@oclif/core";
import {
  HELP_GROUP_HEADERS,
  HELP_GROUPS,
  type HelpGroup,
  type HelpInputs,
  helpFlagGroup,
} from "./help-inputs.js";

export const FULL_HELP_FLAG = "--help-full";

const NON_TTY_WIDTH = 100;
const MAX_FLAG_NAME_WIDTH = 32;
const EXAMPLE_LIMIT = 2;
const SHORT_HELP_MAX_LINES = 40;
const SHORT_HELP_MAX_BYTES = 3000;

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
  helpGroup?: HelpGroup;
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
  helpInputs?: HelpInputs;
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

/** A shell line that runs the CLI, alone, after a pipe, or after env assignments. */
function runsBin(line: string, bin: string): boolean {
  return line.split("|").some((part) =>
    part
      .trim()
      .replace(/^(?:[A-Z_][A-Z0-9_]*=\S*\s+)*/, "")
      .startsWith(`${bin} `),
  );
}

function exampleCommands(example: ShortHelpExample, bin: string): string[] {
  const lines =
    typeof example === "string"
      ? example.split("\n").map((line) => line.trim())
      : [example.command.trim()];
  return lines
    .map((line) => renderTemplate(line, bin))
    .filter((line) => line.startsWith("$ ") || runsBin(line, bin))
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
      group: flag.helpGroup ?? "command",
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
  // When the description goes on past its first sentence, the pointer to the full help is said under the summary,
  // where it is read, rather than as a closing line.
  const described = (command.description ?? "").replaceAll(/\s+/g, " ").trim();
  const more =
    summary !== "" &&
    described.length > firstSentence(command.description ?? "").length;
  const fullHelp = `${bin} ${command.id} ${FULL_HELP_FLAG}`;
  const renderSections = (compactCommon: boolean) =>
    HELP_GROUPS.flatMap((group) => {
      const members = flags.filter((flag) => flag.group === group);
      const rows = members.map(({ name, text }) => listLine(name, text));
      if (group === "required") {
        rows.push(
          ...jsonInputRows(command.helpInputs).map(([name, text]) =>
            listLine(name, text),
          ),
        );
      }
      const lines = section(
        HELP_GROUP_HEADERS[group],
        group === "common" && compactCommon
          ? compactFlagNames(
              members.map((flag) => flag.name),
              width - 2,
            )
          : rows,
      );
      return group === "common" && compactCommon ? lines.slice(1) : lines;
    });
  const renderPage = (compactCommon: boolean) =>
    [
      ...(summary ? [summary] : []),
      ...(more ? [`Summary only. Full description: \`${fullHelp}\`.`] : []),
      ...section("USAGE", [usageLine(command, bin)]),
      ...renderSections(compactCommon),
      ...section(
        "COMMANDS",
        subcommands.map(({ id, summary: text }) =>
          listLine(id, render(firstSentence(text ?? ""))),
        ),
      ),
      ...section("EXAMPLES", examples),
      ...(more ? [] : ["", `Full help: ${fullHelp}`]),
    ].join("\n");
  const page = renderPage(false);
  return page.split("\n").length > SHORT_HELP_MAX_LINES ||
    Buffer.byteLength(page) + 1 > SHORT_HELP_MAX_BYTES
    ? renderPage(true)
    : page;
}

function jsonInputRows(
  inputs: HelpInputs | undefined,
): Array<[string, string]> {
  return (inputs?.requiredJsonFields ?? []).map((path) => [
    path,
    path === "$"
      ? "Request body: use command fields or JSON."
      : "JSON field: supply via --raw-body or --body-file.",
  ]);
}

function compactFlagNames(names: readonly string[], width: number): string[] {
  const lines: string[] = [];
  for (const name of names) {
    const last = lines.length - 1;
    if (last < 0 || (lines[last]?.length ?? 0) + name.length + 2 > width)
      lines.push(name);
    else lines[last] += `  ${name}`;
  }
  return lines;
}

class GroupedCommandHelp extends CommandHelp {
  protected override sections(): Array<{
    generate: HelpSectionRenderer;
    header: string;
  }> {
    return super.sections().map((section) =>
      section.header !== "FLAGS"
        ? section
        : {
            ...section,
            generate: ({ flags }) =>
              HELP_GROUPS.map((group) => {
                const rows =
                  this.flags(
                    flags.filter((flag) => flag.helpGroup === group),
                  ) ?? [];
                if (group === "required")
                  rows.push(
                    ...jsonInputRows(
                      (
                        this.command as Command.Loadable & {
                          helpInputs?: HelpInputs;
                        }
                      ).helpInputs,
                    ),
                  );
                return rows.length
                  ? { header: HELP_GROUP_HEADERS[group], body: rows }
                  : undefined;
              }),
          },
    );
  }
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

  protected override CommandHelpClass = GroupedCommandHelp;

  async showHelp(argv: string[]): Promise<void> {
    this.full = argv.includes(FULL_HELP_FLAG);
    await super.showHelp(argv);
  }

  async showCommandHelp(command: Command.Loadable): Promise<void> {
    const loaded = await command.load();
    const helpInputs = (loaded as typeof Command & { helpInputs?: HelpInputs })
      .helpInputs;
    const flagNames = new Set(Object.keys(command.flags ?? {}));
    // Rendering mutates flag names; keep both parser and cached definitions intact.
    const flags = Object.fromEntries(
      Object.entries(command.flags ?? {}).map(([name, flag]) => {
        const exactlyOne = loaded.flags?.[name]?.exactlyOne;
        return [
          name,
          {
            ...flag,
            exactlyOne,
            helpGroup: helpFlagGroup(
              name,
              { ...flag, exactlyOne },
              helpInputs,
              flagNames,
            ),
          },
        ];
      }),
    );
    const grouped = { ...command, flags, helpInputs };
    if (this.full || FULL_HELP_COMMANDS.has(command.id)) {
      await super.showCommandHelp(grouped);
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
    this.log(
      formatShortHelp(
        { ...grouped, id: command.id.replaceAll(":", " ") },
        { bin: this.config.bin, subcommands, width: terminalWidth() },
      ),
    );
  }
}
