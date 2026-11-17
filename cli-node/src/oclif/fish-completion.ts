import type { Command } from "@oclif/core";

function fishEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Complete executable names and flags from the same registry that routes them. */
export function renderFishCompletion(
  binName: string,
  commands: Readonly<Record<string, typeof Command>>,
  topics: readonly { name: string; hidden?: boolean }[] = [],
): string {
  const lines = [
    `function __fish_${binName}_needs_command`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -le 1",
    "end",
    "",
    `function __fish_${binName}_topic_needs_subcommand`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -eq (math (count $argv) + 1); or return 1",
    "  for i in (seq (count $argv))",
    '    test "$cmd[(math $i + 1)]" = "$argv[$i]"; or return 1',
    "  end",
    "end",
    "",
    `function __fish_${binName}_using_operation`,
    "  set -l cmd (commandline -opc)",
    "  test (count $cmd) -ge (math (count $argv) + 1); or return 1",
    "  for i in (seq (count $argv))",
    '    test "$cmd[(math $i + 1)]" = "$argv[$i]"; or return 1',
    "  end",
    "end",
    "",
  ];
  const hiddenTopics = new Set(
    topics.filter((topic) => topic.hidden).map((topic) => topic.name),
  );
  const commandIds = Object.keys(commands);
  const seen = new Set<string>();
  for (const [id, command] of Object.entries(commands)) {
    if (command.hidden) continue;
    const words = id.split(":");
    for (let end = 1; end <= words.length; end += 1) {
      const prefix = words.slice(0, end - 1).join(" ");
      const key = words.slice(0, end).join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      // A visible descendant does not advertise a hidden parent at the root.
      // An actual command owns its own visibility, even on a hidden topic.
      if (commands[key] ? commands[key].hidden : hiddenTopics.has(key))
        continue;
      const condition = prefix
        ? `__fish_${binName}_topic_needs_subcommand ${prefix}`
        : `__fish_${binName}_needs_command`;
      const description =
        end === words.length
          ? (command.summary ?? command.description?.split("\n")[0] ?? id)
          : (words[end - 1] ?? id);
      lines.push(
        `complete -c ${binName} -f -n '${fishEscape(condition)}' -a '${fishEscape(words[end - 1] ?? "")}' -d '${fishEscape(description)}'`,
      );
    }
    const descendants = commandIds.filter((other) =>
      other.startsWith(`${id}:`),
    );
    const children = descendants.filter(
      (other) =>
        !descendants.some(
          (parent) => parent !== other && other.startsWith(`${parent}:`),
        ),
    );
    // Only the longest registered path contributes flags. A parent may also
    // take arguments, so unknown words must continue to use the parent.
    const condition = [
      `__fish_${binName}_using_operation ${words.join(" ")}`,
      ...children.map(
        (child) =>
          `not __fish_${binName}_using_operation ${child.replaceAll(":", " ")}`,
      ),
    ].join("; and ");
    for (const [name, flag] of Object.entries(command.flags ?? {})) {
      if (flag.hidden) continue;
      const description =
        typeof flag.description === "string" ? flag.description : name;
      const value = flag.type === "boolean" ? "" : " -r";
      lines.push(
        `complete -c ${binName} -n '${fishEscape(condition)}' -l '${fishEscape(name)}'${value} -d '${fishEscape(description)}'`,
      );
      if (flag.type === "boolean" && flag.allowNo)
        lines.push(
          `complete -c ${binName} -n '${fishEscape(condition)}' -l 'no-${fishEscape(name)}' -d '${fishEscape(description)}'`,
        );
    }
  }
  for (const [id, description] of [
    ["help", "Display command help"],
    ["autocomplete", "Install or display shell autocomplete"],
  ]) {
    lines.push(
      `complete -c ${binName} -f -n '__fish_${binName}_needs_command' -a '${id}' -d '${description}'`,
    );
  }
  lines.push(
    `complete -c ${binName} -n '__fish_${binName}_using_operation completion' -a 'bash zsh powershell fish' -d 'Shell type'`,
    `complete -c ${binName} -l help -d 'Show help for ${binName}'`,
    `complete -c ${binName} -l version -d 'Show version for ${binName}'`,
  );
  return `${lines.join("\n")}\n`;
}
