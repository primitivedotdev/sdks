import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import hook, {
  type CommandLookup,
  commandNotFoundMessage,
} from "../../src/oclif/command-not-found.js";
import { COMMANDS } from "../../src/oclif/index.js";

// `emails list` takes no arguments, `emails get` takes one, and `network` is
// a command with subcommands of its own.
const commands: Record<string, { takesArguments: boolean }> = {
  "emails:list": { takesArguments: false },
  "emails:get": { takesArguments: true },
  network: { takesArguments: false },
  "network:list": { takesArguments: false },
};
const lookup: CommandLookup = {
  find: (id) => commands[id],
  hasSubcommands: (id) =>
    Object.keys(commands).some((other) => other.startsWith(`${id}:`)),
};

describe("command not found", () => {
  it("names the argument a command does not take, not a joined command id", () => {
    expect(commandNotFoundMessage("emails:list:abc", lookup)).toEqual({
      code: "unexpected_argument",
      message:
        'Unexpected argument "abc" for "primitive emails list", which takes no arguments. Run "primitive emails list --help" to see the flags it takes.',
    });
    expect(commandNotFoundMessage("emails:list:a:b", lookup).message).toContain(
      'Unexpected argument "a b"',
    );
    expect(commandNotFoundMessage("nosuch:thing", lookup)).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "primitive nosuch thing". Run "primitive --help" to see the commands.',
    });
  });

  it("treats a word after a topic or a command with subcommands as a mistyped subcommand", () => {
    expect(commandNotFoundMessage("network:lst", lookup)).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "primitive network lst". Run "primitive network --help" to see the commands under it.',
    });
    // `emails` is a topic with no command of its own.
    expect(commandNotFoundMessage("emails:lst", lookup)).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "primitive emails lst". Run "primitive emails --help" to see the commands under it.',
    });
    expect(commandNotFoundMessage("emails:get-it:now", lookup).message).toBe(
      'Unknown command "primitive emails get-it now". Run "primitive emails --help" to see the commands under it.',
    );
  });

  it("asks whether a command under another group was meant, when one has the word typed", () => {
    const grouped: Record<string, { takesArguments: boolean }> = {
      "email-rules:list": { takesArguments: false },
      "email-rule-oversight:list-objections": {
        takesArguments: false,
      },
      "a:dup": { takesArguments: false },
      "b:dup": { takesArguments: false },
      "c:dup": { takesArguments: false },
      "d:dup": { takesArguments: false },
      "x:two": { takesArguments: false },
      "y:two": { takesArguments: false },
    };
    const siblings: CommandLookup = {
      find: (id) => grouped[id],
      hasSubcommands: (id) =>
        Object.keys(grouped).some((other) => other.startsWith(`${id}:`)),
      named: (word) =>
        Object.keys(grouped)
          .filter((id) => id.split(":").at(-1) === word)
          .sort(),
      visible: Object.keys(grouped),
    };
    expect(
      commandNotFoundMessage("email-rules:list-objections", siblings),
    ).toEqual({
      code: "command_not_found",
      details: {
        suggestions: ["primitive email-rule-oversight list-objections"],
      },
      message:
        'Unknown command "primitive email-rules list-objections". Did you mean "primitive email-rule-oversight list-objections"? Run "primitive email-rules --help" to see the commands under it.',
    });
    // A mistyped group, or none at all, still finds it.
    expect(
      commandNotFoundMessage("email-rule:list-objections", siblings).message,
    ).toBe(
      'Unknown command "primitive email-rule list-objections". Did you mean "primitive email-rule-oversight list-objections"? Run "primitive --help" to see the commands.',
    );
    expect(
      commandNotFoundMessage("list-objections", siblings).message,
    ).toContain(
      'Did you mean "primitive email-rule-oversight list-objections"?',
    );
    // Two are both named; more than three are no likely meaning.
    expect(commandNotFoundMessage("email-rules:two", siblings).message).toBe(
      'Unknown command "primitive email-rules two". Did you mean "primitive x two" or "primitive y two"? Run "primitive email-rules --help" to see the commands under it.',
    );
    // A value typed after the unknown word is never looked up: it can be any word.
    expect(
      commandNotFoundMessage("email-rules:nosuch:two", siblings).message,
    ).toBe(
      'Unknown command "primitive email-rules nosuch two". Run "primitive email-rules --help" to see the commands under it.',
    );
    expect(commandNotFoundMessage("email-rules:dup", siblings).message).toBe(
      'Unknown command "primitive email-rules dup". Run "primitive email-rules --help" to see the commands under it.',
    );
    // A word no command has keeps the pointer to help.
    expect(commandNotFoundMessage("email-rules:nosuch", siblings).message).toBe(
      'Unknown command "primitive email-rules nosuch". Run "primitive email-rules --help" to see the commands under it.',
    );
  });

  it("finds the objection commands from the email rules group in the real command list", () => {
    const registered = COMMANDS as Record<string, { hidden?: boolean }>;
    const ids = Object.keys(registered);
    const real: CommandLookup = {
      find: (id) => (registered[id] ? { takesArguments: false } : undefined),
      hasSubcommands: (id) => ids.some((other) => other.startsWith(`${id}:`)),
      named: (word) =>
        ids
          .filter(
            (id) => !registered[id]?.hidden && id.split(":").at(-1) === word,
          )
          .sort(),
    };
    for (const name of [
      "list-objections",
      "decline-objection",
      "list-covering-me",
    ]) {
      expect(commandNotFoundMessage(`email-rules:${name}`, real).message).toBe(
        `Unknown command "primitive email-rules ${name}". Did you mean "primitive email-rule-oversight ${name}"? Run "primitive email-rules --help" to see the commands under it.`,
      );
    }
  });

  it("shows the spaced form for an id typed with colons on a command that takes an argument", () => {
    expect(commandNotFoundMessage("emails:get:abc", lookup)).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "emails:get:abc". To pass "abc" to "primitive emails get", run "primitive emails get abc".',
    });
  });

  it("suggests nearby visible commands in the current topic before other topics", () => {
    const local = {
      ...lookup,
      visible: [...Object.keys(commands), "other:latest"],
    };
    for (const word of ["lst", "lsit"]) {
      expect(commandNotFoundMessage(`network:${word}`, local)).toMatchObject({
        code: "command_not_found",
        details: { suggestions: ["primitive network list"] },
        message: expect.stringContaining(
          'Did you mean "primitive network list"?',
        ),
      });
    }
    expect(
      commandNotFoundMessage("emails:list:lst", local).details,
    ).toBeUndefined();
    expect(
      commandNotFoundMessage("emails:get:a-list", local).details,
    ).toBeUndefined();
    expect(
      commandNotFoundMessage("emails:nosuch:list", local).details,
    ).toBeUndefined();
    expect(
      commandNotFoundMessage(`emails:${"l".repeat(1000)}`, local).details,
    ).toBeUndefined();
  });

  it("grounds short verbs and root spelling suggestions in the real registry", () => {
    const registered = COMMANDS as Record<string, { hidden?: boolean }>;
    const ids = Object.keys(registered);
    const real: CommandLookup = {
      find: (id) => (registered[id] ? { takesArguments: false } : undefined),
      hasSubcommands: (id) => ids.some((other) => other.startsWith(`${id}:`)),
      named: (word) =>
        ids.filter(
          (id) => !registered[id]?.hidden && id.split(":").at(-1) === word,
        ),
      visible: ids.filter((id) => !registered[id]?.hidden),
      roots: ["webhook-deliveries", "org", "emails"],
    };
    for (const [typed, expected] of [
      ["webhook-deliveries:get-delivery", "primitive webhook-deliveries get"],
      ["orgs", "primitive org list"],
      ["mail", "primitive emails --help"],
    ]) {
      const choices =
        commandNotFoundMessage(typed, real).details?.suggestions ?? [];
      expect(choices, typed).toContain(expected);
      expect(choices.length).toBeLessThanOrEqual(3);
      for (const suggestion of choices) {
        const id = suggestion
          .replace(/^primitive /, "")
          .replace(/ --help$/, "")
          .replaceAll(" ", ":");
        expect(
          registered[id] || real.hasSubcommands(id),
          suggestion,
        ).toBeTruthy();
        expect(registered[id]?.hidden, suggestion).not.toBe(true);
      }
    }
    // These remain mistakes, with no compatibility aliases installed.
    expect(registered["webhook-deliveries:get-delivery"]).toBeUndefined();
    expect(registered.orgs).toBeUndefined();
    expect(registered.mail).toBeUndefined();
  });

  it("bounds and orders equally close matches independently of registry ordering", () => {
    const ids = ["jobs:get-z", "jobs:get-c", "jobs:get-a", "jobs:get-b"];
    const local: CommandLookup = {
      find: (id) => (ids.includes(id) ? { takesArguments: false } : undefined),
      hasSubcommands: (id) => ids.some((other) => other.startsWith(`${id}:`)),
      visible: ids,
    };
    expect(commandNotFoundMessage("jobs:get", local).details).toEqual({
      suggestions: [
        "primitive jobs get-a",
        "primitive jobs get-b",
        "primitive jobs get-c",
      ],
    });
  });

  it("prefers a same-topic verb match over an exact verb from another topic", () => {
    const ids = ["jobs:get-record", "other:get"];
    const local: CommandLookup = {
      find: (id) => (ids.includes(id) ? { takesArguments: false } : undefined),
      hasSubcommands: (id) => ids.some((other) => other.startsWith(`${id}:`)),
      named: (word) => ids.filter((id) => id.split(":").at(-1) === word),
      visible: ids,
    };
    expect(commandNotFoundMessage("jobs:get", local).details).toEqual({
      suggestions: ["primitive jobs get-record"],
    });
  });

  it("emits structured suggestions from the hook without suggesting hidden commands", async () => {
    const config = {
      commandIDs: [
        "network:list",
        "network:lst-hidden",
        "config",
        "config:list",
      ],
      commands: [
        { id: "network:list" },
        { id: "network:lst-hidden", hidden: true },
        { id: "config", hidden: true },
        { id: "config:list" },
      ],
      topics: [{ name: "network" }, { name: "config", hidden: true }],
      findCommand: (id: string) =>
        id === "network:list" ? { args: {} } : undefined,
    };
    const out = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const exitCode = process.exitCode;
    try {
      await hook.call(
        {} as never,
        { id: "network:lst", argv: ["--json"], config, context: {} } as never,
      );
      const document = JSON.parse(String(out.mock.calls[0]?.[0]));
      expect(document.error.details.suggestions).toEqual([
        "primitive network list",
      ]);
      expect(document.error.code).toBe("command_not_found");
      expect(document.exit_code).toBe(2);
      expect(err).not.toHaveBeenCalled();
      out.mockClear();
      await hook.call(
        {} as never,
        { id: "confg", argv: ["--json"], config, context: {} } as never,
      );
      const hidden = JSON.parse(String(out.mock.calls[0]?.[0]));
      expect(hidden.error.details).toBeUndefined();
      expect(hidden.error.message).not.toContain("Did you mean");
    } finally {
      process.exitCode = exitCode;
      out.mockRestore();
      err.mockRestore();
    }
  });

  it.each(
    [
      { command: false, topic: false, expected: "primitive search" },
      { command: false, topic: true, expected: "primitive search" },
      { command: true, topic: false, expected: undefined },
      { command: true, topic: true, expected: undefined },
      { command: undefined, topic: false, expected: "primitive search --help" },
      { command: undefined, topic: true, expected: undefined },
      { command: undefined, topic: undefined, expected: undefined },
    ].flatMap((example) =>
      ["", "agent:", "agent:contacts:"].map((prefix) => ({
        ...example,
        prefix,
      })),
    ),
  )(
    "uses command visibility before topic visibility at $prefix ($command, $topic)",
    async ({ command, topic, expected, prefix }) => {
      const entries = [
        { id: `${prefix}search:list` },
        ...(command === undefined
          ? []
          : [{ id: `${prefix}search`, hidden: command }]),
      ];
      const config = {
        commands: entries,
        commandIDs: entries.map(({ id }) => id),
        topics:
          topic === undefined
            ? []
            : [{ name: `${prefix}search`, hidden: topic }],
        findCommand: (id: string) =>
          entries.some((entry) => entry.id === id) ? { args: {} } : undefined,
      };
      const out = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const err = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const exitCode = process.exitCode;
      try {
        await hook.call(
          {} as never,
          {
            id: `${prefix}serach`,
            argv: ["--json"],
            config,
            context: {},
          } as never,
        );
        const error = JSON.parse(String(out.mock.calls[0]?.[0])).error;
        expect(error.details?.suggestions).toEqual(
          expected
            ? [
                expected.replace(
                  "primitive search",
                  `primitive ${prefix.replaceAll(":", " ")}search`,
                ),
              ]
            : undefined,
        );
        expect(error.code).toBe("command_not_found");
        expect(err).not.toHaveBeenCalled();
      } finally {
        process.exitCode = exitCode;
        out.mockRestore();
        err.mockRestore();
      }
    },
  );

  it("suggests the real middle topic when a command group is misspelled", async () => {
    const registered = COMMANDS as Record<string, { hidden?: boolean }>;
    const packageJson = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { oclif: { topics: Record<string, { hidden?: boolean }> } };
    const config = {
      commands: Object.entries(registered).map(([id, command]) => ({
        id,
        hidden: command.hidden,
      })),
      commandIDs: Object.keys(registered),
      topics: Object.entries(packageJson.oclif.topics).map(([name, topic]) => ({
        name,
        hidden: topic.hidden,
      })),
      findCommand: (id: string) => (registered[id] ? { args: {} } : undefined),
    };
    const out = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
    const err = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    const exitCode = process.exitCode;
    try {
      await hook.call(
        {} as never,
        {
          id: "agent:contcts:list",
          argv: ["--json"],
          config,
          context: {},
        } as never,
      );
      const document = JSON.parse(String(out.mock.calls[0]?.[0]));
      expect(document.error.code).toBe("command_not_found");
      expect(document.error.details.suggestions[0]).toBe(
        "primitive agent contacts --help",
      );
      expect(document.exit_code).toBe(2);
      expect(err).not.toHaveBeenCalled();
    } finally {
      process.exitCode = exitCode;
      out.mockRestore();
      err.mockRestore();
    }
  });

  it("prints one JSON document on stdout under --json, and plain text on stderr otherwise", async () => {
    const config = {
      topics: [],
      commands: Object.keys(commands).map((id) => ({ id })),
      commandIDs: Object.keys(commands),
      findCommand: (id: string) =>
        commands[id]
          ? { args: commands[id].takesArguments ? { id: {} } : {} }
          : undefined,
    };
    for (const json of [true, false]) {
      const argv = process.argv;
      process.argv = [
        "node",
        "primitive",
        "emails",
        "list",
        "abc",
        ...(json ? ["--json"] : []),
      ];
      const out = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);
      const err = vi
        .spyOn(process.stderr, "write")
        .mockImplementation(() => true);
      const previousExitCode = process.exitCode;
      try {
        await hook.call(
          {} as never,
          {
            argv: [],
            config,
            context: {},
            id: "emails:list:abc",
          } as never,
        );
        expect(process.exitCode).toBe(2);
        if (json) {
          expect(err).not.toHaveBeenCalled();
          expect(JSON.parse(String(out.mock.calls[0]?.[0]))).toEqual({
            error: {
              code: "unexpected_argument",
              message: expect.stringContaining('Unexpected argument "abc"'),
            },
            exit_code: 2,
          });
        } else {
          expect(out).not.toHaveBeenCalled();
          expect(String(err.mock.calls[0]?.[0])).toContain(
            'Unexpected argument "abc" for "primitive emails list"',
          );
        }
      } finally {
        out.mockRestore();
        err.mockRestore();
        process.argv = argv;
        process.exitCode = previousExitCode;
      }
    }
  });
});
