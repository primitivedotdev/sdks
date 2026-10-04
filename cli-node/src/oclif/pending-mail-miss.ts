import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { resolveCliAuth } from "./auth.js";
import {
  agentProfileDirectory,
  agentProfilesDirectory,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";
import { currentMailSessionKey } from "./mail-session.js";
import {
  pendingMailProfiles,
  recordPendingNotFoundRead,
} from "./pending-mail.js";
import { wakeReadCommand, wakeRecipientAddress } from "./wake-context.js";

type ProfileAddress = { profile: string; address: string };

/** At most this many other profiles are named in one hint line. */
const HINT_PROFILE_LIMIT = 3;

function currentProfile(configDir: string): ProfileAddress | null {
  try {
    const connected = resolveCliAuth({ configDir }).connectedAgent;
    return connected
      ? {
          profile: connected.profileName,
          address: wakeRecipientAddress(connected.agentAddress) ?? "",
        }
      : null;
  } catch {
    return null;
  }
}

function profileAddress(configDir: string, profileName: string): string {
  try {
    return (
      wakeRecipientAddress(
        loadConnectedAgentProfile(configDir, profileName)?.agent_address,
      ) ?? ""
    );
  } catch {
    return "";
  }
}

/**
 * Saved connected profiles on this machine other than `exclude`, skipping
 * profiles whose credential was disconnected. Offline and read-only.
 */
function savedConnectedProfiles(
  configDir: string,
  exclude: string,
): ProfileAddress[] {
  let names: string[];
  try {
    names = readdirSync(join(agentProfilesDirectory(configDir), "profiles"));
  } catch {
    return [];
  }
  const found: ProfileAddress[] = [];
  for (const name of names.sort()) {
    if (name === exclude) continue;
    try {
      const profile = loadConnectedAgentProfile(configDir, name);
      if (
        profile &&
        !existsSync(
          join(
            agentProfileDirectory(configDir, name),
            `disconnected-${profile.invitation_hash}.json`,
          ),
        )
      )
        found.push({ profile: name, address: profile.agent_address });
    } catch {
      /* An invalid profile is not a connected address. */
    }
  }
  return found;
}

/**
 * Other connected profiles that could hold the email. Inside a runtime
 * session only the profiles bound to that session count: a profile from
 * another session would send the agent to a second failed read. Outside a
 * session, every other saved connected profile. Never makes a network call
 * and never reads a credential out.
 */
async function otherProfiles(
  configDir: string,
  session: string | null,
  current: string,
): Promise<{ inSession: boolean; profiles: ProfileAddress[] }> {
  if (session) {
    try {
      const { connectedProfilesForSession } = await import(
        "./machine-session.js"
      );
      return {
        inSession: true,
        profiles: connectedProfilesForSession(configDir, session, current),
      };
    } catch {
      return { inSession: true, profiles: [] };
    }
  }
  return {
    inSession: false,
    profiles: savedConnectedProfiles(configDir, current),
  };
}

/**
 * The hint for a not_found read under a connected profile, naming the other
 * connected profiles the email may have been delivered to. Empty when there
 * are none.
 */
export function otherProfilesHint(
  emailId: string,
  current: ProfileAddress,
  others: { inSession: boolean; profiles: ProfileAddress[] },
): string {
  const named = others.profiles
    .map((other) => ({
      profile: other.profile,
      address: wakeRecipientAddress(other.address) ?? "",
    }))
    .slice(0, HINT_PROFILE_LIMIT);
  if (named.length === 0) return "";
  // Which profile received the email is unknown, so each one named gets its
  // own command rather than one guess.
  const list = named
    .map(
      (other) =>
        `${other.address ? `${other.address} (profile ${other.profile})` : `profile ${other.profile}`}: ${wakeReadCommand(emailId, other.profile)}`,
    )
    .join("; ");
  const more =
    others.profiles.length > named.length
      ? ` and ${others.profiles.length - named.length} more`
      : "";
  const self = current.address
    ? `${current.address} (profile ${current.profile})`
    : `profile ${current.profile}`;
  const where = others.inSession
    ? "This session also receives for"
    : "Other connected profiles saved on this machine";
  return `Email ${emailId} was not found for ${self}; an email is readable only under the profile that received it. ${where}: ${list}${more}.\n`;
}

/**
 * Explain a not_found read under a connected profile. One session can carry
 * several connected profiles, each receiving its own address, and an email
 * is visible only to the profile that received it.
 *
 * - When the email is a pending notice for another profile in this session,
 *   print one line naming that profile and the command that reads it, so
 *   the miss is not mistaken for a message that does not exist.
 * - When it is a pending notice for the current profile, count the miss and
 *   drop the notice after consecutive misses, with a line saying why, so an
 *   email that was deleted or is no longer visible stops being announced.
 * - Otherwise, when other connected profiles are bound to this session (or,
 *   outside a session, saved on this machine), print one line naming each
 *   with the command that reads under it. No other credential is used
 *   automatically.
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
    const session = runtime ? runtime.slice(runtime.indexOf(":") + 1) : null;
    const id = emailId.toLowerCase();
    const current = currentProfile(configDir);
    const holders = session ? pendingMailProfiles(configDir, session, id) : [];
    for (const profile of holders) {
      if (profile === current?.profile) continue;
      const address = profileAddress(configDir, profile);
      write(
        `Email ${id} is a pending notice for profile ${profile}${address ? ` (${address})` : ""}, not the profile this command used. Read it with ${wakeReadCommand(id, profile)}.\n`,
      );
    }
    if (!current) return;
    if (holders.length === 0) {
      const hint = otherProfilesHint(
        id,
        current,
        await otherProfiles(configDir, session, current.profile),
      );
      if (hint) write(hint);
      return;
    }
    if (!session || !holders.includes(current.profile)) return;
    const outcome = await recordPendingNotFoundRead(
      configDir,
      current.profile,
      session,
      id,
    );
    if (outcome.kind === "dropped")
      write(
        `Dropped the pending notice for ${id} from profile ${current.profile} after ${outcome.reads} consecutive not_found reads; the email is no longer visible to this profile.\n`,
      );
  } catch {
    // Diagnostics only; the read already reported its error.
  }
}
