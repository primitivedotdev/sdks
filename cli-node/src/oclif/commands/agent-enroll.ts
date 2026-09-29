import { Command, Errors, Flags } from "@oclif/core";
import { enrollAgent } from "../agent-enroll.js";
import { AgentConnectionSetupError } from "../connected-agent-profile.js";

export default class AgentEnrollCommand extends Command {
  static summary =
    "Give this coding session an address in the signed-in owner's organization";
  static description =
    "On this trusted machine, use only the saved owner/admin OAuth login to create one address for the exact loaded session, claim its one-use invitation privately, answer the email challenge, and start receiving. With --contact-requests, the owner login conditionally enables first-contact intake for this exact address after verification, preserving existing policy rules and refusing an explicit disable or conflict. The address is fixed before creation. An uncertain creation or claim is held for owner recovery, never repeated automatically. Requires a verified Primitive-managed domain. This command does not accept API keys, a connection profile, or an invitation argument.";
  static examples = [
    "<%= config.bin %> agent enroll --session 11111111-1111-4111-8111-111111111111 --name Research --contact-requests --json",
    "<%= config.bin %> agent enroll --session 11111111-1111-4111-8111-111111111111 --receiver external --name Research --json",
  ];
  static flags = {
    session: Flags.string({
      required: true,
      description: "Exact current coding session UUID",
    }),
    name: Flags.string({
      description:
        "Short agent display name; defaults to a stable session name",
    }),
    receiver: Flags.string({
      options: ["native", "external"],
      description: "Native session receiver, or external runtime event hook",
    }),
    "contact-requests": Flags.boolean({
      description:
        "Enable this agent's first-contact policy with the saved owner login, then receive relevant requests",
    }),
    json: Flags.boolean({
      description: "Print status without credentials or invitation",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentEnrollCommand);
    try {
      const result = await enrollAgent({
        configDir: this.config.configDir,
        session: flags.session,
        name: flags.name,
        receiverMode: flags.receiver as "native" | "external" | undefined,
        contactRequests: flags["contact-requests"],
      });
      if (flags.json) this.log(JSON.stringify(result));
      else {
        this.log(
          `Agent ${result.identity.agentAddress}: verification ${result.verification.state}; receiving ${result.receiving.state}.`,
        );
        this.log(
          `Select it with PRIMITIVE_AGENT_PROFILE=${result.identity.profileName}.`,
        );
        if (flags["contact-requests"])
          this.log(`Contact requests: ${result.contactRequestPolicy}.`);
        if (result.receiving.state !== "healthy")
          this.log(
            "Rerun this command with the same options to resume the saved session.",
          );
      }
      if (
        result.verification.state !== "reply_submitted" ||
        (flags.receiver !== "external" && result.receiving.state !== "healthy")
      )
        process.exitCode = 2;
    } catch (error) {
      throw new Errors.CLIError(
        error instanceof AgentConnectionSetupError
          ? error.message
          : "Enrollment paused. Preserve this session's private profile and inspect the pending agent in the app before retrying. No second address was requested automatically.",
        { exit: 1 },
      );
    }
  }
}
