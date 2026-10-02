import { Command, Errors, Flags } from "@oclif/core";
import {
  agentConnectionStatus,
  connectAgent,
  readAgentInvitation,
} from "../agent-connect.js";
import {
  defaultAgentProfileName,
  runAgentConnect,
} from "../agent-connect-flow.js";
import { verificationReplySubmitted } from "../agent-setup.js";
import { AgentConnectionSetupError } from "../connected-agent-profile.js";
import { withOwnerMemberAddress } from "../owner-member-address.js";

/** npx runs the CLI from its cache; resume through npx too so the command works without a global install. */
function invocation(entry: string | undefined): string {
  return entry && /[\\/]_npx[\\/]/.test(entry)
    ? "npx -y primitive@latest"
    : "primitive";
}

export default class AgentConnectCommand extends Command {
  static description =
    "Connect this coding session to Primitive in one call. With --session, the command checks this CLI's capabilities, installs or refreshes the matching primitive-connect skill for the detected runtime (Claude Code or Codex) from files bundled in this CLI, claims the owner's private setup invitation from piped stdin, answers one authenticated setup challenge, enables owner notifications, starts receiving, seeds a private AGENT_INFO note from --name and --info when absent, and prints one JSON result. The receiver defaults to external hooks in Claude Code and the native background listener elsewhere. Native receiving starts or reuses a supervised background listener and waits briefly for its first successful mail check; external receiving installs the exact Claude session's fail-open Stop hook and resume SessionStart hook after the verification reply; a real idle mail event must still verify wake. The profile defaults to session-<session>. --resume continues saved progress without reading stdin or replaying a claim or uncertain verification send. After the reply is submitted it waits up to a minute for the server to confirm the connection and reports verification.state verified, or reply_submitted while confirmation is still pending. Verification is separate from receiver health. Both official production (https://api.primitive.dev/v1) and staging (https://api.primitive-staging-1.com/v1) invitations pin their API origin. Never pass an invitation as a command argument. Select the saved identity with PRIMITIVE_AGENT_PROFILE. Use --profile with --status --json to inspect saved identity and local receiver health offline.";
  static summary = "Connect and verify an agent address";
  static examples = [
    '<%= config.bin %> agent connect --session "$CODEX_THREAD_ID" --name Research --info "Reviews pull requests" --json < private-invitation.txt',
    '<%= config.bin %> agent connect --session "$CLAUDE_CODE_SESSION_ID" --contact-requests --json < private-invitation.txt',
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --contact-requests --json < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --contact-requests --resume --json",
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --receiver external --contact-requests --json < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work --status --json",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> whoami --json",
  ];
  static flags = {
    profile: Flags.string({
      description:
        "Local agent profile name; defaults to session-<session> with --session. Existing OAuth login is preserved",
    }),
    session: Flags.string({
      description:
        "Exact current session UUID; verify email and configure receiving after claiming",
      exclusive: ["status"],
    }),
    receiver: Flags.string({
      description:
        "Native starts a supported session receiver; external installs the exact Claude session's fail-open Stop hook and resume SessionStart hook. Defaults to external in Claude Code and native elsewhere",
      options: ["native", "external"],
      dependsOn: ["session"],
    }),
    resume: Flags.boolean({
      description:
        "Resume this session's saved setup without reading stdin, claiming again, or resending verification",
      dependsOn: ["session"],
      exclusive: ["status"],
    }),
    "contact-requests": Flags.boolean({
      description:
        "Receive owner-enabled first contact requests in this session; grants no task authority",
      dependsOn: ["session"],
      exclusive: ["status"],
    }),
    name: Flags.string({
      description:
        "Short agent name for a private AGENT_INFO note, written only when the note is absent",
      dependsOn: ["session"],
    }),
    info: Flags.string({
      description:
        "Short role and capability description for a private AGENT_INFO note, written only when the note is absent",
      dependsOn: ["session"],
    }),
    skill: Flags.boolean({
      description:
        "Install or refresh the primitive-connect skill bundled with this CLI for the detected runtime",
      default: true,
      allowNo: true,
    }),
    project: Flags.boolean({
      description:
        "Install the skill into this project (.claude/skills or .agents/skills) instead of the user skills folder",
      dependsOn: ["session"],
    }),
    status: Flags.boolean({
      description:
        "Read saved identity and local receiver health offline without reading stdin",
    }),
    json: Flags.boolean({
      description:
        "Print setup status and identity metadata, never the credential",
    }),
  };
  async run(): Promise<void> {
    const { flags } = await this.parse(AgentConnectCommand);
    try {
      if (flags.status) {
        if (!flags.profile)
          throw new AgentConnectionSetupError("Pass --profile with --status.");
        const result = agentConnectionStatus(
          this.config.configDir,
          flags.profile,
        );
        if (flags.json) this.log(JSON.stringify(result));
        else
          this.log(
            result.status === "configured"
              ? `Agent profile ${flags.profile} is configured for ${result.identity.agentAddress}. Local receiving: ${result.receiving.state}${result.receiving.reason ? ` (${result.receiving.reason})` : ""}.`
              : `Agent profile ${flags.profile} is not configured.`,
          );
        return;
      }
      if (flags.session) {
        const output = await runAgentConnect({
          configDir: this.config.configDir,
          packageRoot: this.config.root,
          cliVersion: this.config.version,
          cliPath: process.argv[1] ?? "",
          invocation: invocation(process.argv[1]),
          session: flags.session,
          profileName: flags.profile,
          receiver: flags.receiver as "native" | "external" | undefined,
          resume: flags.resume,
          contactRequests: flags["contact-requests"],
          name: flags.name,
          info: flags.info,
          skill: flags.skill,
          project: flags.project,
          readInvitation: () =>
            readAgentInvitation(process.stdin, process.stdin.isTTY),
        });
        const external = output.receiving.mode === "external";
        if (flags.json) this.log(JSON.stringify(output));
        else {
          this.log(
            `Agent ${output.address}: verification ${output.verification.state}; receiving ${output.receiving.state}; skill ${output.skill.state}.`,
          );
          this.log(`Select it with ${output.selectProfile}.`);
          if (output.ownerNotifications === "silenced")
            this.log(
              "Owner notifications remain silenced by the existing preference or policy.",
            );
          if (external && verificationReplySubmitted(output.verification.state))
            this.log(
              output.externalHook === "installed_unverified"
                ? "External receive hook installed. Idle wake still needs a live mail check."
                : "External receive hook is unavailable. Pairing may complete, but this session will not wake automatically.",
            );
          if (output.status !== "connected")
            this.log(`Resume: ${output.resumeCommand}`);
        }
        if (
          (external && output.externalHook !== "installed_unverified") ||
          (!external && output.receiving.state !== "healthy") ||
          !verificationReplySubmitted(output.verification.state)
        )
          process.exitCode = 2;
        return;
      }
      if (!flags.profile)
        throw new AgentConnectionSetupError(
          "Pass --session to connect this session, or --profile for a claim-only or status check.",
        );
      // A rerun of an already configured profile refreshes the owner's
      // personal address, which may have been set up after the claim.
      const claimed = await connectAgent({
        configDir: this.config.configDir,
        profileName: flags.profile,
        invitation: await readAgentInvitation(
          process.stdin,
          process.stdin.isTTY,
        ),
      });
      const result = await withOwnerMemberAddress(claimed, {
        configDir: this.config.configDir,
        onlyIfUnknown: claimed.status === "claimed",
      });
      if (flags.json) this.log(JSON.stringify(result));
      else {
        this.log(
          result.status === "claimed"
            ? "Agent profile saved. Email readiness is not yet verified."
            : "Agent profile already configured; no claim was sent.",
        );
        this.log(
          `Select it with PRIMITIVE_AGENT_PROFILE=${result.identity.profileName}.`,
        );
        this.log(result.ownerReportGuidance);
      }
    } catch (error) {
      throw new Errors.CLIError(
        error instanceof AgentConnectionSetupError
          ? error.message
          : flags.session
            ? `Setup paused. Preserve the private profile and run ${invocation(process.argv[1])} agent connect --profile ${flags.profile ?? defaultAgentProfileName(flags.session)} --session ${flags.session}${flags.receiver ? ` --receiver ${flags.receiver}` : ""} --resume${flags["contact-requests"] ? " --contact-requests" : ""} --json. Do not manually resend verification or reclaim the invitation.`
            : "Agent setup did not complete. Preserve the private profile and request a fresh owner invitation if a claim may have been submitted.",
        { exit: 1 },
      );
    }
  }
}
