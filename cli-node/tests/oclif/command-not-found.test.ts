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
      "email-rules:list-email-rules": { takesArguments: false },
      "email-rule-oversight:list-email-rule-objections": {
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
    };
    expect(
      commandNotFoundMessage(
        "email-rules:list-email-rule-objections",
        siblings,
      ),
    ).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "primitive email-rules list-email-rule-objections". Did you mean "primitive email-rule-oversight list-email-rule-objections"? Run "primitive email-rules --help" to see the commands under it.',
    });
    // A mistyped group, or none at all, still finds it.
    expect(
      commandNotFoundMessage("email-rule:list-email-rule-objections", siblings)
        .message,
    ).toBe(
      'Unknown command "primitive email-rule list-email-rule-objections". Did you mean "primitive email-rule-oversight list-email-rule-objections"? Run "primitive --help" to see the commands.',
    );
    expect(
      commandNotFoundMessage("list-email-rule-objections", siblings).message,
    ).toContain(
      'Did you mean "primitive email-rule-oversight list-email-rule-objections"?',
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
      "list-email-rule-objections",
      "decline-email-rule-objection",
      "list-email-rules-covering-me",
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

  it("prints one JSON document on stdout under --json, and plain text on stderr otherwise", async () => {
    const config = {
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
