import { Command, Errors, Flags } from "@oclif/core";
import {
  agentConnectionStatus,
  connectAgent,
  readAgentInvitation,
} from "../agent-connect.js";
import {
  defaultAgentProfileName,
  invitationProfileName,
  runAgentConnect,
} from "../agent-connect-flow.js";
import {
  RECEIVER_MODES,
  type ReceiverMode,
  verificationReplySubmitted,
} from "../agent-setup.js";
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
    "Connect this coding session to Primitive in one call. With --session, the command checks this CLI's capabilities, installs or refreshes the matching primitive-connect skill for the detected runtime (Claude Code or Codex) from files bundled in this CLI, claims the owner's private setup invitation from piped stdin, answers one authenticated setup challenge, enables owner notifications, starts receiving, seeds a private AGENT_INFO note from --name and --info when absent, and prints one JSON result. The receiver defaults to external hooks in Claude Code and the native background listener elsewhere. Without a session (no --session, or an empty one) the receiver is poll: for runtimes with no local session ID or hooks, such as a cloud-hosted conversation whose commands run in a separate sandbox, the invitation is claimed and verified the same way, nothing is installed, and the result's receiving.checkCommand is the command the agent runs to check for new mail at the start of each turn and after it sends. Native receiving starts or reuses a supervised background listener and waits briefly for its first successful mail check; external receiving installs the exact Claude session's fail-open Stop hook and resume SessionStart hook after the verification reply; a real idle mail event must still verify wake. The profile defaults to session-<session>, or to connection-<invitation hash prefix> without a session. --resume continues saved progress without reading stdin or replaying a claim or uncertain verification send. After the reply is submitted it waits up to a minute for the server to confirm the connection and reports verification.state verified, or reply_submitted while confirmation is still pending. Verification is separate from receiver health. Both official production (https://api.primitive.dev/v1) and staging (https://api.primitive-staging-1.com/v1) invitations pin their API origin. Never pass an invitation as a command argument. Select the saved identity with PRIMITIVE_AGENT_PROFILE. Use --profile with --status --json to inspect saved identity and local receiver health offline.";
  static summary = "Connect and verify an agent address";
  static examples = [
    '<%= config.bin %> agent connect --session "$CODEX_THREAD_ID" --name Research --info "Reviews pull requests" --json < private-invitation.txt',
    '<%= config.bin %> agent connect --session "$CLAUDE_CODE_SESSION_ID" --contact-requests --json < private-invitation.txt',
    "<%= config.bin %> agent connect --receiver poll --name Research --json < private-invitation.txt",
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
        "Local agent profile name; defaults to session-<session> with --session, or connection-<invitation hash prefix> for poll receiving. Existing OAuth login is preserved",
    }),
    session: Flags.string({
      description:
        "Exact current session UUID; verify email and configure receiving after claiming. Omit it (or pass it empty) when the runtime exposes none, which selects poll receiving",
      exclusive: ["status"],
    }),
    receiver: Flags.string({
      description:
        "Native starts a supported session receiver; external installs the exact Claude session's fail-open Stop hook and resume SessionStart hook; poll installs nothing and the agent checks for mail itself with `agent check-mail`. Defaults to external in Claude Code, native elsewhere, and poll without a session",
      options: [...RECEIVER_MODES],
      exclusive: ["status"],
    }),
    resume: Flags.boolean({
      description:
        "Resume this session's saved setup without reading stdin, claiming again, or resending verification",
      exclusive: ["status"],
    }),
    "contact-requests": Flags.boolean({
      description:
        "Receive owner-enabled first contact requests in this session; grants no task authority",
      exclusive: ["status"],
    }),
    name: Flags.string({
      description:
        "Short agent name for a private AGENT_INFO note, written only when the note is absent",
      exclusive: ["status"],
    }),
    info: Flags.string({
      description:
        "Short role and capability description for a private AGENT_INFO note, written only when the note is absent",
      exclusive: ["status"],
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
      exclusive: ["status"],
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
    // Set once a sessionless setup has named its profile, so a failure can
    // print the exact resume command.
    let pollProfile: string | undefined;
    try {
      if (flags.status) {
        if (!flags.profile)
          throw new AgentConnectionSetupError("Pass --profile with --status.");
        const result = agentConnectionStatus(
          this.config.configDir,
          flags.profile,
        );
        if (flags.json) this.log(JSON.stringify(result));
        else if (result.status !== "configured")
          this.log(`Agent profile ${flags.profile} is not configured.`);
        else {
          const receiving: {
            state: string;
            reason: string | null;
            failureCode?: string | null;
            detail?: string | null;
          } = result.receiving;
          const why = [
            receiving.reason,
            receiving.failureCode !== receiving.reason
              ? receiving.failureCode
              : null,
          ].filter(Boolean);
          this.log(
            `Agent profile ${flags.profile} is configured for ${result.identity.agentAddress}. Local receiving: ${receiving.state}${why.length ? ` (${why.join(", ")})` : ""}.${receiving.detail ? ` ${receiving.detail}` : ""}`,
          );
        }
        return;
      }
      const session = flags.session?.trim() || undefined;
      // Claim-only keeps its meaning: a profile with no session and no other
      // setup option. Anything else runs the full setup, which without a
      // session receives by polling instead of refusing to claim.
      const claimOnly =
        !session &&
        flags.profile !== undefined &&
        flags.receiver === undefined &&
        !flags.resume &&
        !flags["contact-requests"] &&
        flags.name === undefined &&
        flags.info === undefined;
      if (!claimOnly) {
        let readInvitation = () =>
          readAgentInvitation(process.stdin, process.stdin.isTTY);
        if (!session && !flags.resume) {
          if (flags.profile) pollProfile = flags.profile;
          else {
            const text = await readInvitation();
            pollProfile = invitationProfileName(text);
            readInvitation = async () => text;
          }
        }
        const output = await runAgentConnect({
          configDir: this.config.configDir,
          packageRoot: this.config.root,
          cliVersion: this.config.version,
          cliPath: process.argv[1] ?? "",
          invocation: invocation(process.argv[1]),
          session,
          profileName: flags.profile ?? pollProfile,
          receiver: flags.receiver as ReceiverMode | undefined,
          resume: flags.resume,
          contactRequests: flags["contact-requests"],
          name: flags.name,
          info: flags.info,
          skill: flags.skill,
          project: flags.project,
          readInvitation,
        });
        const external = output.receiving.mode === "external";
        const poll = output.receiving.mode === "poll";
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
          if (poll && "checkCommand" in output.receiving)
            this.log(
              `Nothing wakes this session for new mail. Check it at the start of each turn and after sending with: ${output.receiving.checkCommand}`,
            );
          if (output.status !== "connected")
            this.log(`Resume: ${output.resumeCommand}`);
        }
        if (
          (external && output.externalHook !== "installed_unverified") ||
          (!external && !poll && output.receiving.state !== "healthy") ||
          !verificationReplySubmitted(output.verification.state)
        )
          process.exitCode = 2;
        return;
      }
      if (!flags.profile)
        throw new AgentConnectionSetupError("Pass --profile for claim-only.");
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
          : flags.session?.trim()
            ? `Setup paused. Preserve the private profile and run ${invocation(process.argv[1])} agent connect --profile ${flags.profile ?? defaultAgentProfileName(flags.session.trim())} --session ${flags.session.trim()}${flags.receiver ? ` --receiver ${flags.receiver}` : ""} --resume --json. Do not manually resend verification or reclaim the invitation.`
            : pollProfile
              ? `Setup paused. Preserve the private profile and run ${invocation(process.argv[1])} agent connect --profile ${pollProfile} --receiver poll --resume --json. Do not manually resend verification or reclaim the invitation.`
              : "Agent setup did not complete. Preserve the private profile and request a fresh owner invitation if a claim may have been submitted.",
        { exit: 1 },
      );
    }
  }
}
