import { type Command, Errors, Flags } from "@oclif/core";
import { getEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorCode,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import {
  dispatchAutoWorking,
  haltAutoWorking,
  isSentSignal,
} from "../auto-signals.js";
import { buildEmailBrief, renderEmailBrief } from "../email-brief.js";
import { withFlagSuggestion } from "../flag-suggestions.js";
import { currentMailSessionKey } from "../mail-session.js";
import { clearReadPendingMail } from "../pending-mail.js";
import { explainPendingMailNotFound } from "../pending-mail-miss.js";
import { followUpCommandPrefix } from "../send-outcome.js";

const EMAIL_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const BRIEF_DESCRIPTION =
  "Print a compact brief instead of the raw email: a trusted envelope (sender, relationship, verification, thread, whether you have sent in the thread, newer messages when the API reports them, attachments, the sender's active work claim, the sender's latest signal on your last message, and for a repeating message its cadence and how to stop it), then the sender-authored subject and body_text fenced and labelled untrusted. With --json, prints one object with `envelope`, `subject` and `body_text`.";

/**
 * Remove the email from the current profile's pending wake notices once the
 * session has read it. Never fails the read.
 */
export async function clearPendingAfterRead(
  configDir: string,
  emailId: string,
): Promise<void> {
  try {
    const profileName = resolveCliAuth({ configDir }).connectedAgent
      ?.profileName;
    if (!profileName) return;
    const runtime = currentMailSessionKey();
    await clearReadPendingMail(
      configDir,
      profileName,
      runtime ? runtime.slice(runtime.indexOf(":") + 1) : null,
      emailId,
    );
  } catch {
    // Clearing a notice is best effort; the read itself succeeded.
  }
}

const NO_SIGNAL_DESCRIPTION =
  "With --brief, do not report working to the sender, and stop a working report an earlier read of this email started; nothing is sent. By default, reading mail from the verified owner or a same-organization member (not another agent) that a receiver surfaced to this session reports working in the background until you answer (also disabled by PRIMITIVE_NO_AUTO_SIGNALS=1).";

/**
 * The line a brief ends with once it has started reporting working: the
 * agent only knows whether it will act after reading, so the way out has to
 * come after the content.
 */
export function workingStopCommand(emailId: string, prefix: string): string {
  return `${prefix} emails get --id ${emailId} --brief --no-signal`;
}
export function workingStopLine(command: string): string {
  return `The sender now sees you working on this until you answer. If you will not act on it, stop that with ${command} (it sends nothing).`;
}

type BriefFlags = {
  id: string;
  "no-signal"?: boolean;
  json?: boolean;
  time?: boolean;
  "api-key"?: string;
  "api-base-url"?: string;
};

async function runBrief(command: Command, flags: BriefFlags): Promise<void> {
  await runWithTiming(flags.time === true, async () => {
    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        configDir: command.config.configDir,
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
      });
    const result = await getEmail({
      client: apiClient.client,
      path: { id: flags.id },
      responseStyle: "fields",
    });
    const detail = result.data?.data;
    if (result.error || !detail) {
      const payload = extractErrorPayload(result.error);
      writeErrorWithHints(payload);
      surfaceUnauthorizedHint({
        auth,
        baseUrlOverridden,
        configDir: command.config.configDir,
        payload,
      });
      if (extractErrorCode(payload) === "not_found")
        await explainPendingMailNotFound(command.config.configDir, flags.id);
      process.exitCode = 1;
      return;
    }
    const connected = auth.connectedAgent
      ? {
          agentAddress: auth.connectedAgent.agentAddress,
          ownerAddress: auth.connectedAgent.ownerAddress,
        }
      : undefined;
    const brief = await buildEmailBrief({
      client: apiClient.client,
      detail,
      connected,
      isOwnSignal: (sentId) => isSentSignal(command.config.configDir, sentId),
      signal: AbortSignal.timeout(30_000),
    });
    // --no-signal also ends a working report an earlier read started: an
    // agent decides whether to act only after reading the body.
    if (flags["no-signal"])
      await haltAutoWorking(
        command.config.configDir,
        { emailIds: [detail.id] },
        "not_acting",
      );
    // Detached and silent, so stdout stays one document and stderr empty.
    // Recheck the sender here: a claim saved before agent senders stopped
    // qualifying must not start Working toward another agent.
    const working =
      !flags["no-signal"] &&
      detail.sender_connected_agent_verified !== true &&
      dispatchAutoWorking({
        configDir: command.config.configDir,
        emailId: detail.id,
      });
    const stop = working
      ? workingStopCommand(detail.id, followUpCommandPrefix())
      : null;
    command.log(
      flags.json
        ? JSON.stringify(
            stop ? { ...brief, working_signal: { stop_command: stop } } : brief,
            null,
            2,
          )
        : `${renderEmailBrief(brief)}${stop ? `\n${workingStopLine(stop)}` : ""}`,
    );
    await clearPendingAfterRead(command.config.configDir, detail.id);
  });
}

/**
 * Wrap the generated `emails get` command: identical output without
 * --brief, plus the brief view and clearing of pending wake notices.
 */
export function createEmailsGetCommand(base: typeof Command): typeof Command {
  const baseFlags = (base as unknown as { flags: Record<string, unknown> })
    .flags;
  class EmailsGetCommand extends base {
    static description =
      `${base.description ?? ""}\n\nAdd --brief for a trusted envelope followed by the fenced, untrusted sender text: the recommended way for an agent to read one received email.`;
    static flags = {
      ...baseFlags,
      brief: Flags.boolean({ description: BRIEF_DESCRIPTION }),
      "no-signal": Flags.boolean({
        description: NO_SIGNAL_DESCRIPTION,
        dependsOn: ["brief"],
      }),
    } as never;

    async run(): Promise<void> {
      const { flags } = await this.parse(EmailsGetCommand as never).catch(
        (error: unknown) => {
          throw withFlagSuggestion(
            error,
            Object.keys(EmailsGetCommand.flags as Record<string, unknown>),
          );
        },
      );
      const parsed = flags as BriefFlags & { brief?: boolean };
      if (typeof parsed.id !== "string")
        throw new Errors.CLIError("Missing required flag --id.");
      // The API answers a malformed id with a misleading scope error, so
      // reject it here before any request is made.
      if (!EMAIL_ID.test(parsed.id))
        throw new Errors.CLIError(
          "--id must be an email UUID (for example the id in a wake line, agent check-mail output, or emails latest).",
          { exit: 1 },
        );
      if (parsed.brief) {
        await runBrief(this, parsed);
        return;
      }
      const before = process.exitCode;
      await (base.prototype as Command).run.call(this);
      if (process.exitCode === before || process.exitCode === 0)
        await clearPendingAfterRead(this.config.configDir, parsed.id);
    }
  }
  return EmailsGetCommand;
}
