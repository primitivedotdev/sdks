import { Command, Errors, Flags } from "@oclif/core";
import { pollCheckCommand } from "../agent-connect-flow.js";
import { enrollAgent, enrollmentResumes } from "../agent-enroll.js";
import { identitySuggestions } from "../agent-identity-suggestions.js";
import {
  RECEIVER_MODES,
  type ReceiverMode,
  verificationReplySubmitted,
} from "../agent-setup.js";
import { installClaudeWakeHook } from "../claude-wake-install.js";
import { AgentConnectionSetupError } from "../connected-agent-profile.js";
import { SESSION_UUID } from "../notify-session-native.js";
import {
  ALREADY_CONNECTED_EXIT_CODE,
  alreadyConnected,
  type BoundAddress,
  inspectSessionAddresses,
  replaceSessionAddresses,
} from "../session-address-guard.js";

/** npx runs the CLI from its cache; print follow-up commands the same way. */
function invocation(entry: string | undefined): string {
  return entry && /[\\/]_npx[\\/]/.test(entry)
    ? "npx -y primitive@latest"
    : "primitive";
}

export default class AgentEnrollCommand extends Command {
  static summary = "Give this coding session an address in your organization";
  static description =
    `On this trusted machine, use the saved member OAuth login to create one address for the exact loaded session, claim its one-use invitation privately, answer the email challenge, and poll the owner's connection list for confirmed pairing. Native receiving starts when supported. With --receiver external in the exact Claude session, install a fail-open Stop hook and resume SessionStart hook in that runtime's settings after the verification reply; idle wake remains unverified until tested with real mail. With --contact-requests, the login conditionally enables first-contact intake for this exact address after verification, preserving existing policy rules. An explicit disable or uncertain policy update is reported separately without losing pairing or receiver setup. The server allocates a readable address. An uncertain creation resumes the same saved request; recovered results do not include another invitation. Use --continue-setup once to explicitly continue a recovered pending connection. An uncertain continuation or claim is held for owner recovery, never repeated automatically. Requires a verified Primitive-managed domain. This command does not accept API keys, a connection profile, or an invitation argument. One address per session: if this session already has another connected Primitive address, nothing is created and the command exits ${ALREADY_CONNECTED_EXIT_CODE} with status already_connected; ask the user whether to keep the existing address or disconnect it first, then rerun with --keep-existing or --replace-existing. Never choose for the user.`;
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
      description: "Short agent display name; defaults to Coding agent",
    }),
    "continue-setup": Flags.boolean({
      description:
        "Explicitly issue one invitation only if the recovered agent is still pending; never reconnect a claimed agent",
    }),
    receiver: Flags.string({
      options: [...RECEIVER_MODES],
      description:
        "Native session receiver, external runtime event hook, or poll: nothing is installed and the agent checks for mail itself with `agent check-mail`",
    }),
    "contact-requests": Flags.boolean({
      description:
        "Enable this agent's first-contact policy with the saved member login, then receive relevant requests",
    }),
    "replace-existing": Flags.boolean({
      description:
        "Only after the user chose it: disconnect the other agent already connected for this session, then enroll",
      exclusive: ["keep-existing"],
    }),
    "keep-existing": Flags.boolean({
      description:
        "Only after the user chose it: keep the other agent already connected for this session and enroll a second address too",
      exclusive: ["replace-existing"],
    }),
    json: Flags.boolean({
      description: "Print status without credentials or invitation",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(AgentEnrollCommand);
    try {
      // One address per session, checked before anything is requested. The
      // session's own profile is this enrollment's resume target only when
      // it holds this session's enrollment; any other connection there is a
      // second address like any other profile bound to the session.
      const session = flags.session.trim().toLowerCase();
      if (!SESSION_UUID.test(session))
        throw new AgentConnectionSetupError(
          "Enrollment requires the exact current session UUID. Nothing was changed.",
        );
      const targetProfile = `session-${session}`;
      let bound: BoundAddress[] = [];
      if (!flags["keep-existing"]) {
        const check = inspectSessionAddresses({
          configDir: this.config.configDir,
          session,
          targetProfile,
        });
        bound =
          check.target && !enrollmentResumes(this.config.configDir, session)
            ? [
                ...check.others,
                {
                  profile: check.target.profile,
                  address: check.target.address,
                },
              ]
            : check.others;
      }
      if (bound.length > 0 && !flags["replace-existing"]) {
        const refusal = alreadyConnected(session, bound, "enroll");
        if (flags.json) this.log(JSON.stringify(refusal));
        else this.log(refusal.detail);
        process.exitCode = ALREADY_CONNECTED_EXIT_CODE;
        return;
      }
      // A replacement disconnects only once enrollment's own checks (saved
      // login, overrides, session preflight) pass, right before creation.
      let replaced: BoundAddress[] = [];
      const result = await enrollAgent({
        configDir: this.config.configDir,
        session: flags.session,
        name: flags.name,
        receiverMode: flags.receiver as ReceiverMode | undefined,
        contactRequests: flags["contact-requests"],
        continueSetup: flags["continue-setup"],
        ...(bound.length > 0
          ? {
              beforeCreate: async () => {
                replaced = await replaceSessionAddresses({
                  configDir: this.config.configDir,
                  rows: bound,
                  targetProfile,
                });
                if (!flags.json)
                  for (const row of replaced)
                    this.log(
                      `Disconnected the existing agent ${row.address} (profile ${row.profile}).`,
                    );
              },
            }
          : {}),
      });
      const externalHook =
        flags.receiver === "external" &&
        verificationReplySubmitted(result.verification.state) &&
        result.connection.status !== "owner_inactive"
          ? installClaudeWakeHook({
              cliPath: process.argv[1] ?? "",
              configDir: this.config.configDir,
              profileName: result.identity.profileName,
              agentAddress: result.identity.agentAddress,
              sessionId: flags.session,
            })
          : null;
      // Poll receiving wakes nothing: the agent runs this check itself, so
      // the structured result carries it as poll agent connect does.
      const output =
        result.receiving.state === "poll"
          ? {
              ...result,
              receiving: {
                ...result.receiving,
                mode: "poll" as const,
                checkCommand: pollCheckCommand(
                  invocation(process.argv[1]),
                  result.identity.profileName,
                ),
              },
              externalHook,
            }
          : { ...result, externalHook };
      const identity = identitySuggestions({
        invocation: invocation(process.argv[1]),
        profile: result.identity.profileName,
        name: result.name,
        cwd: process.cwd(),
        connectedNow: result.connection.status === "connected",
      });
      const printed = replaced.length
        ? { ...output, ...identity, replacedExisting: replaced }
        : { ...output, ...identity };
      if (flags.json) this.log(JSON.stringify(printed));
      else {
        this.log(
          `Agent ${result.identity.agentAddress}: pairing ${result.connection.status}; verification ${result.verification.state}; receiving ${result.receiving.state}.`,
        );
        this.log(
          `Select it with PRIMITIVE_AGENT_PROFILE=${result.identity.profileName}.`,
        );
        if (flags["contact-requests"])
          this.log(`Contact requests: ${result.contactRequestPolicy}.`);
        if (result.contactRequestPolicy === "owner_disabled")
          this.log(
            "The owner disabled contact requests for this address. Review the policy in the app if you want them enabled.",
          );
        if (result.contactRequestPolicy === "unavailable")
          this.log(
            "Contact-request policy could not be confirmed. Receiving can still be configured; rerun this exact enrollment after policy access is restored.",
          );
        if (externalHook === "installed_unverified")
          this.log(
            "External receive hook installed for this runtime. Idle wake still needs a live mail check.",
          );
        else if (externalHook === "unavailable")
          this.log(
            "Could not install the external receive hook. Pairing is confirmed, but later mail will not wake this session automatically.",
          );
        if (result.connection.status !== "connected")
          this.log(
            "Pairing is not yet confirmed. Rerun this command with the same options to resume the saved session; do not create another address.",
          );
        else if ("checkCommand" in output.receiving)
          this.log(
            `Nothing wakes this session for new mail. Check it at the start of each turn and after sending with: ${output.receiving.checkCommand}`,
          );
        else if (result.receiving.state !== "healthy")
          this.log(
            "Pairing is confirmed; receiving needs separate setup or recovery.",
          );
      }
      if (
        externalHook === "unavailable" ||
        (flags["contact-requests"] &&
          result.contactRequestPolicy !== "enabled") ||
        result.connection.status !== "connected" ||
        (flags.receiver !== "external" &&
          flags.receiver !== "poll" &&
          result.receiving.state !== "healthy")
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
