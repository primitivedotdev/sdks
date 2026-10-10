import { Command, Errors, Flags } from "@oclif/core";
import {
  agentConnectionStatus,
  agentInvitationHash,
  connectAgent,
  readAgentInvitation,
  refusalAfterReplacement,
} from "../agent-connect.js";
import {
  connectWarnings,
  defaultAgentProfileName,
  invitationProfileName,
  runAgentConnect,
} from "../agent-connect-flow.js";
import {
  claimOverRevokedSetup,
  clearRevokedAddresses,
  disconnectAgent,
} from "../agent-disconnect.js";
import {
  connectNextSteps,
  identitySuggestions,
} from "../agent-identity-suggestions.js";
import {
  RECEIVER_MODES,
  type ReceiverMode,
  verificationReplySubmitted,
} from "../agent-setup.js";
import { installedConnectSkillFile } from "../connect-skill.js";
import {
  AGENT_PROFILE_ENV,
  AgentConnectionSetupError,
} from "../connected-agent-profile.js";
import { SESSION_UUID } from "../notify-session-native.js";
import { withOwnerMemberAddress } from "../owner-member-address.js";
import {
  ALREADY_CONNECTED_EXIT_CODE,
  alreadyConnected,
  type BoundAddress,
  guardedSession,
  inspectSessionAddresses,
  replaceSessionAddresses,
  statusProfile,
  statusProfileMissingDetail,
  targetContinuation,
} from "../session-address-guard.js";

/** npx runs the CLI from its cache; resume through npx too so the command works without a global install. */
function invocation(entry: string | undefined): string {
  return entry && /[\\/]_npx[\\/]/.test(entry)
    ? "npx -y primitive@latest"
    : "primitive";
}

/**
 * Names the addresses this run cleared as already revoked, so a later
 * refusal or failure that says nothing changed is not taken literally.
 */
function withClearedNote(message: string, cleared: BoundAddress[]): string {
  if (!cleared.length) return message;
  const list = cleared
    .map((row) => `${row.address} (profile ${row.profile})`)
    .join(", ");
  return `${message} Before that, this run cleared ${list} on this machine because Primitive confirmed ${cleared.length === 1 ? "its credential was" : "their credentials were"} already revoked; ${cleared.length === 1 ? "it stays" : "they stay"} disconnected.`;
}

export default class AgentConnectCommand extends Command {
  static description =
    `Connect this coding session to Primitive in one call. With --session, the command checks this CLI's capabilities, installs or refreshes the matching primitive-connect skill for the detected runtime (Claude Code or Codex) from files bundled in this CLI, claims the owner's private setup invitation from piped stdin, answers one authenticated setup challenge, enables owner notifications, starts receiving, seeds a private AGENT_INFO note from --name and --info when absent, and prints one JSON result. The receiver defaults to external hooks in Claude Code and the native background listener elsewhere. When the native default cannot work because this machine has no local session socket (for example Codex older than 0.158.0), the command connects with poll receiving instead and reports receiving.fallbackReason and receiving.fallbackDetail. Without a session (no --session, or an empty one) the receiver is poll: for runtimes with no local session ID or hooks, such as a cloud-hosted conversation whose commands run in a separate sandbox, the invitation is claimed and verified the same way, nothing is installed, and the result's receiving.checkCommand is the command the agent runs to check for new mail at the start of each turn and after it sends. Native receiving starts or reuses a supervised background listener and waits briefly for its first successful mail check; external receiving installs the exact Claude session's fail-open Stop hook and resume SessionStart hook after the verification reply; a real idle mail event must still verify wake. The profile defaults to session-<session>, or to connection-<invitation hash prefix> without a session. --resume continues saved progress without reading stdin or replaying a claim or uncertain verification send. After the reply is submitted it waits up to a minute for the server to confirm the connection and reports verification.state verified, or reply_submitted while confirmation is still pending. Verification is separate from receiver health. Both official production (https://api.primitive.dev/v1) and staging (https://api.primitive-staging-1.com/v1) invitations pin their API origin. Never pass an invitation as a command argument. One address per session: an address whose credential Primitive confirms was already revoked (for example, revoked in the app before the owner reconnected it) no longer counts; it is disconnected locally, reported in clearedRevoked, and its saved setup is moved aside so the new invitation can be claimed into the same profile. Otherwise, if this session already has a connected Primitive address, including one saved in the profile being connected, the command claims nothing, leaves stdin unread, and exits ${ALREADY_CONNECTED_EXIT_CODE} with status already_connected. Its detail names how to continue that profile's own connection when that is the only one: --resume for a setup with saved progress, or --keep-existing to refresh a claim-only profile from the same invitation. Otherwise ask the user whether to keep the existing address or disconnect it first, then rerun with --keep-existing or --replace-existing. Never choose for the user. Select the saved identity with PRIMITIVE_AGENT_PROFILE. Use --status --json with --profile, with PRIMITIVE_AGENT_PROFILE set, or with --session (the address connected for that session) to inspect saved identity and local receiver health offline; it exits 1 when nothing is configured. A status check before connecting is optional: connect itself claims nothing and exits ${ALREADY_CONNECTED_EXIT_CODE} when the session already has an address. A completed connection's result carries nextSteps, in order: report to the owner in two short sentences, make one offer to rename a generated name and record where the agent runs, and load the primitive-connect skill before handling mail. When the claim reported one, the result also carries the connection's name and nameIsDefault.`;
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
        "Exact current session UUID; verify email and configure receiving after claiming. Omit it (or pass it empty) when the runtime exposes none, which selects poll receiving. With --status, reads the address connected for that session",
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
    "replace-existing": Flags.boolean({
      description:
        "Only after the user chose it: disconnect the agent already connected for this session, then connect the new invitation",
      exclusive: ["status", "keep-existing"],
    }),
    "keep-existing": Flags.boolean({
      description:
        "Only after the user chose it: keep the agent already connected for this session and connect a second address too",
      exclusive: ["status", "replace-existing"],
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
    // Addresses disconnected by --replace-existing, so a later refusal can
    // say so instead of claiming nothing changed.
    let replaced: BoundAddress[] = [];
    // Addresses whose credential Primitive confirmed was already revoked,
    // cleared locally so they no longer count as this session's address.
    let cleared: BoundAddress[] = [];
    try {
      if (flags.status) {
        // Status only reads, so the selected profile may come from the
        // environment or the session's one connected address. Disconnect
        // still requires an explicit --profile.
        // An empty --session means a sessionless connection to connect, whose
        // profile no session names, so status needs the profile instead.
        const statusSession = flags.session?.trim();
        if (statusSession !== undefined && !SESSION_UUID.test(statusSession))
          throw new AgentConnectionSetupError(
            statusSession === ""
              ? "--status with an empty --session has no session to look in. Pass --profile <name> for a sessionless connection."
              : "--session requires the exact loaded session UUID.",
          );
        const picked = statusProfile({
          configDir: this.config.configDir,
          profile: flags.profile,
          session: statusSession,
        });
        if (picked.profile === null && picked.session === null)
          throw new AgentConnectionSetupError(
            `Pass --profile <name>, --session <id> or set ${AGENT_PROFILE_ENV}.`,
          );
        if (picked.profile === null) {
          const detail = statusProfileMissingDetail(picked.bound);
          this.log(
            flags.json
              ? JSON.stringify({
                  status: "not_configured",
                  profileName: null,
                  session: picked.session,
                  ...(picked.bound.length > 1
                    ? { profiles: picked.bound }
                    : {}),
                  detail,
                })
              : detail,
          );
          process.exitCode = 1;
          return;
        }
        const profileName = picked.profile;
        const result = agentConnectionStatus(
          this.config.configDir,
          profileName,
        );
        if (result.status !== "configured") {
          const detail = `Agent profile ${profileName} is not configured. Run \`primitive agent connect\` with the owner's invitation to connect it.`;
          this.log(flags.json ? JSON.stringify({ ...result, detail }) : detail);
          process.exitCode = 1;
          return;
        }
        if (flags.json) this.log(JSON.stringify(result));
        else {
          const receiving: {
            state: string;
            reason: string | null;
            failureCode?: string | null;
            detail?: string | null;
            lastFiredAt?: string | null;
            lastSuccessfulMailCheckAt?: string | null;
          } = result.receiving;
          const why = [
            receiving.reason,
            receiving.failureCode !== receiving.reason
              ? receiving.failureCode
              : null,
          ].filter(Boolean);
          this.log(
            `Agent profile ${profileName} is configured for ${result.identity.agentAddress}. Local receiving: ${receiving.state}${why.length ? ` (${why.join(", ")})` : ""}.${receiving.detail ? ` ${receiving.detail}` : ""}${receiving.lastFiredAt ? ` Receive hook last ran at ${receiving.lastFiredAt}.` : ""}${receiving.lastSuccessfulMailCheckAt ? ` Last completed mail check at ${receiving.lastSuccessfulMailCheckAt}.` : ""}`,
          );
        }
        return;
      }
      const session = flags.session?.trim() || undefined;
      // The session is validated before anything else, so the address guard
      // below checks exactly the session this connection binds.
      if (session !== undefined && !SESSION_UUID.test(session))
        throw new AgentConnectionSetupError(
          "--session requires the exact loaded session UUID. No invitation was claimed and nothing was changed.",
        );
      // Claim-only keeps its meaning: a profile with no --session at all and
      // no other setup option. Anything else, including an explicitly empty
      // --session, runs the full setup, which without a session receives by
      // polling instead of refusing to claim.
      const claimOnly =
        flags.session === undefined &&
        flags.profile !== undefined &&
        flags.receiver === undefined &&
        !flags.resume &&
        !flags["contact-requests"] &&
        flags.name === undefined &&
        flags.info === undefined;
      // Refuse before stdin is read, so a wrong receiver never waits on or
      // consumes the invitation.
      if (
        !claimOnly &&
        !session &&
        (flags.receiver === "native" || flags.receiver === "external")
      )
        throw new AgentConnectionSetupError(
          `--receiver ${flags.receiver} requires the exact loaded session UUID. Without one, use --receiver poll. No invitation was claimed.`,
        );
      let invitationText: string | undefined;
      const readInvitationOnce = async () => {
        invitationText ??= await readAgentInvitation(
          process.stdin,
          process.stdin.isTTY,
        );
        return invitationText;
      };
      // One address per session. A resume continues a claim that already
      // happened, so it is never refused. An explicit --session (even an
      // empty one) is the session this connection binds; only with no
      // --session at all does the runtime's own session apply.
      let replaceExisting: (() => Promise<void>) | undefined;
      const guardSession = flags.resume
        ? null
        : flags.session !== undefined
          ? (session?.toLowerCase() ?? null)
          : guardedSession(undefined);
      if (guardSession && !flags["keep-existing"]) {
        const targetProfile =
          flags.profile ??
          (session ? defaultAgentProfileName(session) : undefined);
        const check = inspectSessionAddresses({
          configDir: this.config.configDir,
          session: guardSession,
          targetProfile,
        });
        let bound: BoundAddress[] = check.others;
        // A refusal is decided before stdin is read, so the invitation stays
        // unread and unclaimed for a retry after the user chooses. A
        // connection already in the target profile counts as the session's
        // address whatever invitation it came from: continuing the same
        // setup is what --resume (or, for a claim-only profile,
        // --keep-existing) is for, and the refusal names which. Only a
        // replacement reads the
        // invitation first, so a malformed one fails before anything is
        // disconnected and a same-invitation target is left to resume.
        if (flags["replace-existing"]) {
          const hash = agentInvitationHash(await readInvitationOnce());
          if (check.target && check.target.invitationHash !== hash)
            bound = [
              ...bound,
              { profile: check.target.profile, address: check.target.address },
            ];
        } else if (check.target)
          bound = [
            ...bound,
            { profile: check.target.profile, address: check.target.address },
          ];
        // An address revoked in the app or elsewhere is no longer this
        // session's address. Only a confirmed revocation clears it; a live
        // credential, or one whose state is unknown, still refuses below.
        if (bound.length > 0 && !flags["replace-existing"]) {
          const result = await clearRevokedAddresses({
            configDir: this.config.configDir,
            rows: bound,
            disconnect: disconnectAgent,
          });
          bound = result.remaining;
          cleared = result.cleared;
          if (!flags.json)
            for (const row of cleared)
              this.log(
                `Cleared ${row.address} (profile ${row.profile}): Primitive confirmed its credential was already revoked.`,
              );
        }
        if (bound.length > 0 && !flags["replace-existing"]) {
          const continuation =
            check.target &&
            bound.some((row) => row.profile === check.target?.profile) &&
            targetContinuation(
              this.config.configDir,
              check.target.profile,
              claimOnly,
            );
          const refusal = alreadyConnected(
            guardSession,
            bound,
            "connect",
            continuation || undefined,
          );
          // The refusal still says nothing was claimed; an address cleared
          // above as already revoked is reported alongside it.
          const detail = withClearedNote(refusal.detail, cleared);
          if (flags.json)
            this.log(
              JSON.stringify(
                cleared.length
                  ? { ...refusal, detail, clearedRevoked: cleared }
                  : refusal,
              ),
            );
          else this.log(detail);
          process.exitCode = ALREADY_CONNECTED_EXIT_CODE;
          return;
        }
        if (bound.length > 0)
          replaceExisting = async () => {
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
          };
      }
      if (!claimOnly) {
        if (!session && !flags.resume) {
          if (flags.profile) pollProfile = flags.profile;
          else pollProfile = invitationProfileName(await readInvitationOnce());
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
          readInvitation: readInvitationOnce,
          ...(replaceExisting ? { beforeSetup: replaceExisting } : {}),
        });
        const external = output.receiving.mode === "external";
        const poll = output.receiving.mode === "poll";
        // The owner names the connection in the invitation; a rename is
        // suggested only when that name is a generated default.
        const identity = identitySuggestions({
          invocation: invocation(process.argv[1]),
          profile: output.profile,
          ...("nameIsDefault" in output
            ? { nameIsDefault: output.nameIsDefault }
            : {}),
          connectedNow: output.status === "connected",
        });
        // Agents act on this output even before loading the skill, so a
        // completed connection carries what to do next, in order.
        const nextSteps =
          output.status === "connected"
            ? connectNextSteps({
                address: output.address,
                receiving: output.receiving,
                ...("name" in output ? { name: output.name } : {}),
                suggestions: identity.suggestions,
                skillFile: installedConnectSkillFile({
                  runtime: output.skill.runtime,
                  installedPath: output.skill.path,
                }),
              })
            : [];
        const suggested = {
          ...output,
          ...identity,
          ...(nextSteps.length
            ? {
                nextSteps,
                guidance: `${output.guidance} Next: ${nextSteps.join(" ")}`,
              }
            : {}),
        };
        if (flags.json)
          this.log(
            JSON.stringify({
              ...suggested,
              ...(replaced.length ? { replacedExisting: replaced } : {}),
              ...(cleared.length ? { clearedRevoked: cleared } : {}),
            }),
          );
        else {
          this.log(
            `Agent ${output.address}: verification ${output.verification.state}; receiving ${output.receiving.state}; skill ${output.skill.state}.`,
          );
          this.log(`Select it with ${output.selectProfile}.`);
          for (const warning of output.warnings) this.log(warning.message);
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
          if (poll && "fallbackDetail" in output.receiving)
            this.log(String(output.receiving.fallbackDetail));
          if (poll && "checkCommand" in output.receiving)
            this.log(
              `Nothing wakes this session for new mail. Check it at the start of each turn and after sending with: ${output.receiving.checkCommand}`,
            );
          if (output.status !== "connected")
            this.log(`Resume: ${output.resumeCommand}`);
          if (nextSteps.length) {
            this.log("Next steps:");
            nextSteps.forEach((step, index) => {
              this.log(`${index + 1}. ${step}`);
            });
          }
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
      const invitation = await readInvitationOnce();
      const invitationHash = agentInvitationHash(invitation);
      await replaceExisting?.();
      const profileName = flags.profile;
      // A setup left by a credential confirmed revoked (cleared above, or
      // earlier) is moved aside under the claim lock before claiming.
      const claimed = await claimOverRevokedSetup(
        {
          configDir: this.config.configDir,
          profileName,
          invitationHash,
        },
        (claimLockHeld) =>
          connectAgent({
            configDir: this.config.configDir,
            profileName,
            invitation,
            claimLockHeld,
          }),
      );
      const result = await withOwnerMemberAddress(claimed, {
        configDir: this.config.configDir,
        onlyIfUnknown: claimed.status === "claimed",
      });
      const warnings = connectWarnings(
        this.config.configDir,
        result.identity.profileName,
      );
      if (flags.json)
        this.log(
          JSON.stringify({
            ...result,
            warnings,
            ...(replaced.length ? { replacedExisting: replaced } : {}),
            ...(cleared.length ? { clearedRevoked: cleared } : {}),
          }),
        );
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
        for (const warning of warnings) this.log(warning.message);
      }
    } catch (caught) {
      const error = refusalAfterReplacement(caught, replaced);
      throw new Errors.CLIError(
        withClearedNote(
          error instanceof AgentConnectionSetupError
            ? error.message
            : flags.session?.trim()
              ? `Setup paused. Preserve the private profile and run ${invocation(process.argv[1])} agent connect --profile ${flags.profile ?? defaultAgentProfileName(flags.session.trim())} --session ${flags.session.trim()}${flags.receiver ? ` --receiver ${flags.receiver}` : ""} --resume --json. Do not manually resend verification or reclaim the invitation.`
              : pollProfile
                ? `Setup paused. Preserve the private profile and run ${invocation(process.argv[1])} agent connect --profile ${pollProfile} --receiver poll --resume --json. Do not manually resend verification or reclaim the invitation.`
                : "Agent setup did not complete. Preserve the private profile and request a fresh owner invitation if a claim may have been submitted.",
          cleared,
        ),
        { exit: 1 },
      );
    }
  }
}
