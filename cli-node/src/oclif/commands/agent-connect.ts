import { Command, Errors, Flags } from "@oclif/core";
import {
  agentConnectionStatus,
  connectAgent,
  readAgentInvitation,
} from "../agent-connect.js";
import { setupAgent } from "../agent-setup.js";
import { installClaudeWakeHook } from "../claude-wake-install.js";
import { AgentConnectionSetupError } from "../connected-agent-profile.js";

export default class AgentConnectCommand extends Command {
  static description =
    "Claim an owner's private setup invitation from piped stdin and save a separate connected-agent profile. Add --session to answer one authenticated setup challenge and enable owner notifications. The default receiver preflights and starts a native session listener; --receiver external requires the exact Claude session and installs a fail-open Stop hook and resume SessionStart hook after the verification reply. A real idle mail event must still verify wake. --resume continues saved progress without reading stdin or replaying a claim or uncertain verification send. Verification reply submission is separate from delivery and receiver health. Both official production (https://api.primitive.dev/v1) and staging (https://api.primitive-staging-1.com/v1) invitations pin their API origin. Never pass an invitation as a command argument. Select the saved identity with PRIMITIVE_AGENT_PROFILE. Use --status --json to inspect saved identity offline.";
  static summary = "Connect and verify an agent address";
  static examples = [
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --contact-requests --json < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --contact-requests --resume --json",
    "<%= config.bin %> agent connect --profile work --session 11111111-1111-4111-8111-111111111111 --receiver external --contact-requests --json < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work < private-invitation.txt",
    "<%= config.bin %> agent connect --profile work --status --json",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> whoami --json",
  ];
  static flags = {
    profile: Flags.string({
      required: true,
      description:
        "Local agent profile name; existing OAuth login is preserved",
    }),
    session: Flags.string({
      description:
        "Exact current session UUID; verify email and configure receiving after claiming",
      exclusive: ["status"],
    }),
    receiver: Flags.string({
      description:
        "Native starts a supported session receiver; external installs the exact Claude session's fail-open Stop hook and resume SessionStart hook",
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
    status: Flags.boolean({
      description:
        "Read saved identity metadata offline without reading stdin or verifying receiving readiness",
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
        const result = agentConnectionStatus(
          this.config.configDir,
          flags.profile,
        );
        if (flags.json) this.log(JSON.stringify(result));
        else
          this.log(
            result.status === "configured"
              ? `Agent profile ${flags.profile} is configured for ${result.identity.agentAddress}. Receiving readiness is not verified by this offline check.`
              : `Agent profile ${flags.profile} is not configured.`,
          );
        return;
      }
      if (flags.session) {
        if (
          flags.receiver === "external" &&
          process.env.CLAUDE_CODE_SESSION_ID !== flags.session
        )
          throw new AgentConnectionSetupError(
            "External receiving requires this exact Claude session ID. No invitation was claimed.",
          );
        const result = await setupAgent({
          configDir: this.config.configDir,
          profileName: flags.profile,
          session: flags.session,
          receiverMode: flags.receiver as "native" | "external",
          resume: flags.resume,
          contactRequests: flags["contact-requests"],
          ...(flags.resume
            ? {}
            : {
                invitation: await readAgentInvitation(
                  process.stdin,
                  process.stdin.isTTY,
                ),
              }),
        });
        const externalHook =
          flags.receiver === "external" &&
          result.verification.state === "reply_submitted"
            ? installClaudeWakeHook({
                cliPath: process.argv[1] ?? "",
                configDir: this.config.configDir,
                profileName: result.identity.profileName,
                agentAddress: result.identity.agentAddress,
                sessionId: flags.session,
              })
            : null;
        const output = { ...result, externalHook };
        if (flags.json) this.log(JSON.stringify(output));
        else {
          this.log(
            `Agent ${result.identity.agentAddress}: verification ${result.verification.state}; receiving ${result.receiving.state}.`,
          );
          this.log(
            `Select it with PRIMITIVE_AGENT_PROFILE=${result.identity.profileName}.`,
          );
          if (result.ownerNotifications === "silenced")
            this.log(
              "Owner notifications remain silenced by the existing preference or policy.",
            );
          if (result.receiving.state === "external_setup_required")
            this.log(
              externalHook === "installed_unverified"
                ? "External receive hook installed. Idle wake still needs a live mail check."
                : "External receive hook is unavailable. Pairing may complete, but this session will not wake automatically.",
            );
          if (result.receiving.state === "not_ready")
            this.log(`Resume: ${result.resumeCommand}`);
        }
        if (
          externalHook === "unavailable" ||
          (flags.receiver !== "external" &&
            result.receiving.state !== "healthy") ||
          result.verification.state !== "reply_submitted"
        )
          process.exitCode = 2;
        return;
      }
      const result = await connectAgent({
        configDir: this.config.configDir,
        profileName: flags.profile,
        invitation: await readAgentInvitation(
          process.stdin,
          process.stdin.isTTY,
        ),
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
      }
    } catch (error) {
      throw new Errors.CLIError(
        error instanceof AgentConnectionSetupError
          ? error.message
          : flags.session
            ? `Setup paused. Preserve the private profile and run primitive agent connect --profile ${flags.profile} --session ${flags.session}${flags.receiver === "external" ? " --receiver external" : ""} --resume${flags["contact-requests"] ? " --contact-requests" : ""} --json. Do not manually resend verification or reclaim the invitation.`
            : "Agent setup did not complete. Preserve the private profile and request a fresh owner invitation if a claim may have been submitted.",
        { exit: 1 },
      );
    }
  }
}
