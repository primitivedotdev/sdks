import { Command, Errors, Flags } from "@oclif/core";
import {
  agentConnectionStatus,
  connectAgent,
  readAgentInvitation,
} from "../agent-connect.js";
import { AgentConnectionSetupError } from "../connected-agent-profile.js";

export default class AgentConnectCommand extends Command {
  static description =
    "Claim an owner's private setup invitation from stdin and save a separate connected-agent profile. Claiming does not prove that a listener is ready or that the email setup challenge has been completed.";
  static summary = "Save a private connected-agent profile from an invitation";
  static examples = [
    "<%= config.bin %> agent connect --profile work < private-invitation.txt",
  ];
  static flags = {
    profile: Flags.string({
      required: true,
      description:
        "Local agent profile name; existing OAuth login is preserved",
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
          : "Agent setup did not complete. Preserve the private profile and request a fresh owner invitation if a claim may have been submitted.",
        { exit: 1 },
      );
    }
  }
}
