import { resolveCliAuth } from "./auth.js";
import { loadConnectedAgentProfile } from "./connected-agent-profile.js";
import { currentMailSessionKey } from "./mail-session.js";
import {
  pendingMailProfiles,
  recordPendingNotFoundRead,
} from "./pending-mail.js";
import { wakeReadCommand, wakeRecipientField } from "./wake-context.js";

function currentProfile(configDir: string): string | null {
  try {
    return resolveCliAuth({ configDir }).connectedAgent?.profileName ?? null;
  } catch {
    return null;
  }
}

function profileAddress(configDir: string, profileName: string): string {
  try {
    return wakeRecipientField(
      loadConnectedAgentProfile(configDir, profileName)?.agent_address,
    ).replace(/^ to=/, "");
  } catch {
    return "";
  }
}

/**
 * Explain a not_found read of an email this session was told about. One
 * session can carry several connected profiles, each receiving its own
 * address, and an email is visible only to the profile that received it.
 *
 * - When the email is a pending notice for another profile in this session,
 *   print one line naming that profile and the command that reads it, so
 *   the miss is not mistaken for a message that does not exist.
 * - When it is a pending notice for the current profile, count the miss and
 *   drop the notice after consecutive misses, with a line saying why, so an
 *   email that was deleted or is no longer visible stops being announced.
 *
 * Writes only to stderr and never throws; the read already failed.
 */
export async function explainPendingMailNotFound(
  configDir: string,
  emailId: string,
  write: (line: string) => void = (line) => {
    process.stderr.write(line);
  },
): Promise<void> {
  try {
    const runtime = currentMailSessionKey();
    if (!runtime) return;
    const session = runtime.slice(runtime.indexOf(":") + 1);
    const id = emailId.toLowerCase();
    const holders = pendingMailProfiles(configDir, session, id);
    if (holders.length === 0) return;
    const current = currentProfile(configDir);
    for (const profile of holders) {
      if (profile === current) continue;
      const address = profileAddress(configDir, profile);
      write(
        `Email ${id} is a pending notice for profile ${profile}${address ? ` (${address})` : ""}, not the profile this command used. Read it with ${wakeReadCommand(id, profile)}.\n`,
      );
    }
    if (!current || !holders.includes(current)) return;
    const outcome = await recordPendingNotFoundRead(
      configDir,
      current,
      session,
      id,
    );
    if (outcome.kind === "dropped")
      write(
        `Dropped the pending notice for ${id} from profile ${current} after ${outcome.reads} consecutive not_found reads; the email is no longer visible to this profile.\n`,
      );
  } catch {
    // Diagnostics only; the read already reported its error.
  }
}
