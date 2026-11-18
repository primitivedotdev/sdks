import type { Command, Hook } from "@oclif/core";

/** Only a command's explicit body, secret or hook reader may consume stdin. */
export function ignoreArgumentStdin(
  command: Pick<typeof Command, "args">,
): void {
  for (const argument of Object.values(command.args ?? {})) {
    argument.ignoreStdin = true;
  }
}

// Plugin commands are loaded outside the local registry. Apply the same policy
// before they run and parse their arguments.
const prerun: Hook.Prerun = async ({ Command: command }) => {
  ignoreArgumentStdin(command);
};

export default prerun;
