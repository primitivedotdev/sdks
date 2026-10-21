import { Command, Flags } from "@oclif/core";
import {
  cliInvocation,
  identitySuggestions,
} from "../agent-identity-suggestions.js";
import {
  connectedProfilesForSession,
  headlessClaudeRun,
  MACHINE_RUNTIMES,
  type MachineRuntime,
  readClaudeHookInput,
  registerSession,
  revokeStaleSessionAgents,
  runDetached,
} from "../machine-session.js";
import {
  CLAUDE_ENV_FILE_ENV,
  exportSessionAgentEnv,
} from "../session-agent-env.js";

/** A hook waits this long for registration before letting the session start. */
const HOOK_BUDGET_MS = 3_000;

/** Outcomes whose profile is saved and connected, or was and is only unchecked. */
const EXPORTABLE_STATUSES = new Set([
  "registered",
  "already_registered",
  "offline",
]);

export default class AgentSessionRegisterCommand extends Command {
  static summary = "Register this coding session with Primitive, once";
  static description =
    "Gives the current Claude Code, Codex or omp session an address in your organization using the saved member login, without a browser. Safe to run on every start and resume: a session that already has a profile is only re-verified, and a session that ended and starts again (for example `claude --resume`) keeps its agent and address, and a session whose agent was disconnected or removed never gets a second address. Each run also disconnects the agents of sessions on this machine that ended more than 30 days ago without starting again, only while their profile still holds the credential this command created. The session ID comes from CLAUDE_CODE_SESSION_ID (Claude), CODEX_THREAD_ID or CODEX_SESSION_ID (Codex), or --session. omp does not expose a session ID to commands, so omp sessions use one generated ID per running omp process, and receiving mail is not supported for them. The agent is named <runtime>-<repository> and gets a private AGENT_INFO note naming the runtime and repository when it has none. A connected Claude Code or Codex session also gets a private AGENT_RESUME note holding the one-line command that resumes it (`claude --resume <session>` or `codex resume <session>`), rewritten only when it changes; a failure to write it is reported as a warning and never fails the registration. Claude sessions receive mail through exact-session hooks; Codex through the native receiver. Non-interactive Claude runs (claude -p and SDK hosts, by CLAUDE_CODE_ENTRYPOINT) are skipped with status skipped_headless. Never blocks a session: every outcome, including no login or no network, exits 0 with a status. --hook reads Claude's or Codex's SessionStart hook input from stdin, returns within a few seconds and finishes slower work in the background. For Claude, once the session's profile is saved and connected, --hook also appends `export PRIMITIVE_AGENT_PROFILE=<profile>` and `export PRIMITIVE_AGENT_ADDRESS=<address>` to the file named by CLAUDE_ENV_FILE, so later commands in the session run as the session's agent; it writes nothing when the session already sets PRIMITIVE_AGENT_PROFILE (an empty value keeps the member login) or the file already assigns either variable.";
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
    // Set by --hook for Claude: once the session's profile is saved, append
    // PRIMITIVE_AGENT_PROFILE and PRIMITIVE_AGENT_ADDRESS to CLAUDE_ENV_FILE.
    "export-env": Flags.boolean({ hidden: true }),
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
          // Claude runs CLAUDE_ENV_FILE before every later Bash command, so
          // the export still applies when registration finishes after this
          // hook has returned.
          ...(runtime === "claude" && process.env[CLAUDE_ENV_FILE_ENV]?.trim()
            ? ["--export-env"]
            : []),
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
    if (
      flags["export-env"] &&
      runtime === "claude" &&
      result.session &&
      result.profile &&
      result.address &&
      EXPORTABLE_STATUSES.has(result.status) &&
      // The session's identity is ambiguous while another connected profile
      // receives or is bound to it, so nothing is exported then.
      !result.receiverHeld &&
      connectedProfilesForSession(
        this.config.configDir,
        result.session,
        result.profile,
      ).length === 0
    )
      exportSessionAgentEnv({
        configDir: this.config.configDir,
        profileName: result.profile,
        address: result.address,
      });
    // Status first, so a person reading the JSON sees the outcome at once.
    const { status, ...rest } = result;
    const identity =
      status === "registered" && result.profile
        ? identitySuggestions({
            invocation: cliInvocation(process.argv[1]),
            profile: result.profile,
            nameIsDefault: result.nameIsDefault,
            connectedNow: true,
          })
        : {};
    if (flags.json) this.log(JSON.stringify({ status, ...rest, ...identity }));
    else if (!flags.quiet) {
      this.log(`${result.status}: ${result.detail}`);
      if (result.resumeNote === "failed")
        this.warn(
          "The AGENT_RESUME note could not be written. The session is registered; the next start retries it.",
        );
    }
    // Hygiene after the result, so it never delays this session's own.
    try {
      await revokeStaleSessionAgents(this.config.configDir, {
        exclude: result.session,
      });
    } catch {
      /* Best effort; `machine doctor --fix` reports and retries it. */
    }
  }
}
