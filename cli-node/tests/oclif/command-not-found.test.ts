import { describe, expect, it, vi } from "vitest";
import hook, {
  type CommandLookup,
  commandNotFoundMessage,
} from "../../src/oclif/command-not-found.js";

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

  it("treats a word after a command with subcommands as a mistyped subcommand", () => {
    expect(commandNotFoundMessage("network:lst", lookup)).toEqual({
      code: "command_not_found",
      message:
        'Unknown command "primitive network lst". Run "primitive network --help" to see the commands under it.',
    });
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
