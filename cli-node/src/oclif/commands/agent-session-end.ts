import { Command, Flags } from "@oclif/core";
import {
  endSession,
  HOOK_END_GRACE_MS,
  headlessClaudeRun,
  MACHINE_RUNTIMES,
  type MachineRuntime,
  readClaudeHookInput,
  runDetached,
} from "../machine-session.js";

export default class AgentSessionEndCommand extends Command {
  static summary = "Record that a registered session ended";
  static description =
    "Marks this session ended and removes its exact-session receive hooks. The agent that `primitive agent session-register` created for the session stays connected, with its credential and profile, so resuming the session (for example `claude --resume`) re-verifies it and reinstalls the hooks at the same address. Its presence lapses on its own once the session stops running. An agent whose session has not started again for 30 days is disconnected by `primitive machine doctor --fix` or the next `agent session-register` on this machine. --revoke disconnects the agent now instead. Agents connected any other way are never disconnected, including an agent later connected into the same profile with `primitive agent connect`. Never blocks or fails a session: every outcome exits 0 with a status. --hook reads Claude's SessionEnd hook input from stdin and finishes in the background after a grace period: Claude reports the same end for a restart, a switch to another session and a real exit, so a start of the same session within the grace period cancels the end.";
  static examples = [
    "<%= config.bin %> agent session-end --runtime claude --json",
    "<%= config.bin %> agent session-end --runtime codex --session 11111111-1111-4111-8111-111111111111",
    "<%= config.bin %> agent session-end --runtime claude --session 11111111-1111-4111-8111-111111111111 --revoke",
  ];
  static flags = {
    runtime: Flags.string({
      required: true,
      options: [...MACHINE_RUNTIMES],
      description: "The coding agent runtime this session runs in",
    }),
    session: Flags.string({
      description:
        "Exact session UUID; defaults to the runtime's own session ID",
    }),
    grace: Flags.integer({
      min: 0,
      max: 3600,
      description:
        "Seconds to wait before the end takes effect; a start of the same session meanwhile cancels it",
    }),
    revoke: Flags.boolean({
      description:
        "Disconnect the agent session-register created for this session instead of keeping it for a resume",
    }),
    reason: Flags.string({
      description: "The runtime's reason for the end, recorded with it",
    }),
    hook: Flags.boolean({
      description:
        "Read Claude hook JSON from stdin and finish in the background",
    }),
    json: Flags.boolean({ description: "Print the result as JSON" }),
    quiet: Flags.boolean({ description: "Print nothing" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentSessionEndCommand);
    const runtime = flags.runtime as MachineRuntime;
    if (flags.hook) {
      const input = await readClaudeHookInput(process.stdin);
      if (!input || (runtime === "claude" && headlessClaudeRun(process.env)))
        return;
      await runDetached({
        node: process.execPath,
        entry: process.argv[1] ?? "",
        args: [
          "agent",
          "session-end",
          "--runtime",
          runtime,
          "--session",
          input.sessionId,
          "--grace",
          String(HOOK_END_GRACE_MS / 1000),
          ...(input.reason ? ["--reason", input.reason] : []),
          ...(flags.revoke ? ["--revoke"] : []),
          "--quiet",
        ],
        env: process.env,
        waitMs: 0,
      });
      return;
    }
    const result = await endSession({
      configDir: this.config.configDir,
      runtime,
      session: flags.session,
      graceMs: (flags.grace ?? 0) * 1000,
      reason: flags.reason ?? null,
      revoke: flags.revoke === true,
    });
    // Status first, so a person reading the JSON sees the outcome at once.
    const { status, ...rest } = result;
    if (flags.json) this.log(JSON.stringify({ status, ...rest }));
    else if (!flags.quiet) this.log(`${result.status}: ${result.detail}`);
  }
}
