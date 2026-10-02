import { type Command, Errors, Flags } from "@oclif/core";
import { getEmail } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  writeErrorWithHints,
} from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import { buildEmailBrief, renderEmailBrief } from "../email-brief.js";
import { currentMailSessionKey } from "../mail-session.js";
import { clearReadPendingMail } from "../pending-mail.js";

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

type BriefFlags = {
  id: string;
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
      signal: AbortSignal.timeout(30_000),
    });
    command.log(
      flags.json ? JSON.stringify(brief, null, 2) : renderEmailBrief(brief),
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
    } as never;

    async run(): Promise<void> {
      const { flags } = await this.parse(EmailsGetCommand as never);
      const parsed = flags as BriefFlags & { brief?: boolean };
      if (typeof parsed.id !== "string")
        throw new Errors.CLIError("Missing required flag --id.");
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
