import { Command, Flags } from "@oclif/core";
import {
  headlessClaudeRun,
  MACHINE_RUNTIMES,
  type MachineRuntime,
  readClaudeHookInput,
  registerSession,
  runDetached,
} from "../machine-session.js";

/** A hook waits this long for registration before letting the session start. */
const HOOK_BUDGET_MS = 3_000;

export default class AgentSessionRegisterCommand extends Command {
  static summary = "Register this coding session with Primitive, once";
  static description =
    "Gives the current Claude Code, Codex or omp session an address in your organization using the saved member login, without a browser. Safe to run on every start and resume: a session that already has a profile is only re-verified, and a session whose agent was disconnected or removed never gets a second address. The session ID comes from CLAUDE_CODE_SESSION_ID (Claude), CODEX_THREAD_ID or CODEX_SESSION_ID (Codex), or --session. omp does not expose a session ID to commands, so omp sessions use one generated ID per running omp process, and receiving mail is not supported for them. The agent is named <runtime>-<repository> and gets a private AGENT_INFO note naming the runtime and repository when it has none. Claude sessions receive mail through exact-session hooks; Codex through the native receiver. Non-interactive Claude runs (claude -p and SDK hosts, by CLAUDE_CODE_ENTRYPOINT) are skipped with status skipped_headless. Never blocks a session: every outcome, including no login or no network, exits 0 with a status. --hook reads Claude's or Codex's SessionStart hook input from stdin, returns within a few seconds and finishes slower work in the background.";
  static examples = [
    "<%= config.bin %> agent session-register --runtime codex --quiet",
    "<%= config.bin %> agent session-register --runtime claude --json",
    "<%= config.bin %> agent session-register --runtime omp --session 11111111-1111-4111-8111-111111111111 --json",
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
    cwd: Flags.string({
      description:
        "Working directory used for the agent's name and AGENT_INFO; defaults to the current directory",
    }),
    hook: Flags.boolean({
      description:
        "Read Claude or Codex SessionStart hook JSON from stdin and finish in the background if registration is slow",
    }),
    json: Flags.boolean({ description: "Print the result as JSON" }),
    quiet: Flags.boolean({ description: "Print nothing" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentSessionRegisterCommand);
    const runtime = flags.runtime as MachineRuntime;
    if (flags.hook) {
      // Hook output becomes session context, so a hook prints nothing.
      const input = await readClaudeHookInput(process.stdin);
      if (
        !input ||
        (runtime !== "claude" && runtime !== "codex") ||
        (runtime === "claude" && headlessClaudeRun(process.env))
      )
        return;
      await runDetached({
        node: process.execPath,
        entry: process.argv[1] ?? "",
        args: [
          "agent",
          "session-register",
          "--runtime",
          runtime,
          "--session",
          input.sessionId,
          ...(input.cwd ? ["--cwd", input.cwd] : []),
          "--quiet",
        ],
        // The runtime's own hook input names the exact loaded session.
        env: {
          ...process.env,
          ...(runtime === "claude"
            ? { CLAUDE_CODE_SESSION_ID: input.sessionId }
            : { CODEX_THREAD_ID: input.sessionId }),
        },
        cwd: input.cwd ?? undefined,
        waitMs: HOOK_BUDGET_MS,
      });
      return;
    }
    const result = await registerSession({
      configDir: this.config.configDir,
      runtime,
      session: flags.session,
      cwd: flags.cwd,
      cliPath: process.argv[1] ?? "",
    });
    // Status first, so a person reading the JSON sees the outcome at once.
    const { status, ...rest } = result;
    if (flags.json) this.log(JSON.stringify({ status, ...rest }));
    else if (!flags.quiet) this.log(`${result.status}: ${result.detail}`);
  }
}
