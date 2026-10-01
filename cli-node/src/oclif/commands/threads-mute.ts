import { Command, Flags } from "@oclif/core";
import { resolveCliAuth } from "../auth.js";
import { currentMailSessionKey } from "../mail-session.js";
import {
  muteThread,
  readThreadMutes,
  type ThreadMute,
  unmuteThread,
} from "../thread-mutes.js";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

const idFlag = Flags.string({
  required: true,
  description: "Thread ID (the thread_id of any email in the conversation)",
});
const allSessionsFlag = Flags.boolean({
  description:
    "Apply to every session on this profile instead of only the current runtime session",
});
const jsonFlag = Flags.boolean({
  description: "Print JSON (already the default)",
});

function profileName(command: Command): string {
  const name = resolveCliAuth({ configDir: command.config.configDir })
    .connectedAgent?.profileName;
  if (!name)
    command.error(
      "Thread mutes belong to a connected agent profile. Set PRIMITIVE_AGENT_PROFILE to the profile whose wakes should change.",
    );
  return name;
}

/** The current runtime session, or null for a profile-wide mute. */
function muteSession(allSessions: boolean): string | null {
  if (allSessions) return null;
  return currentMailSessionKey();
}

function threadId(command: Command, value: string): string {
  if (!UUID.test(value)) command.error("--id must be a thread UUID.");
  return value.toLowerCase();
}

function scopeLabel(mute: ThreadMute): string {
  return mute.session ?? "all sessions";
}

export class ThreadsMuteCommand extends Command {
  static summary = "Stop wakes for one thread in this session";
  static description =
    "Muted threads never wake this session: mail in them is still received and readable, and its delivery event is completed so it is not redelivered. Inside a Claude Code or Codex session the mute applies to that session only; outside one, or with --all-sessions, it applies to every session on the profile. Stored locally beside the profile's listener state.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads mute --id <thread-id>",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads mute --id <thread-id> --all-sessions",
  ];
  static flags = {
    id: idFlag,
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsMuteCommand);
    const id = threadId(this, flags.id);
    const profile = profileName(this);
    const session = muteSession(flags["all-sessions"]);
    const { mute, changed } = await muteThread(
      this.config.configDir,
      profile,
      id,
      session,
    );
    this.log(
      JSON.stringify(
        {
          thread_id: mute.thread_id,
          muted: true,
          already_muted: !changed,
          scope: scopeLabel(mute),
          muted_at: mute.muted_at,
        },
        null,
        2,
      ),
    );
  }
}

export class ThreadsUnmuteCommand extends Command {
  static summary = "Resume wakes for one muted thread";
  static description =
    "Removes this session's mute for the thread, or the profile-wide mute with --all-sessions (also the default outside a runtime session). Reports any other mute that still applies.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads unmute --id <thread-id>",
  ];
  static flags = {
    id: idFlag,
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsUnmuteCommand);
    const id = threadId(this, flags.id);
    const profile = profileName(this);
    const session = muteSession(flags["all-sessions"]);
    const { removed, remaining } = await unmuteThread(
      this.config.configDir,
      profile,
      id,
      session,
    );
    const stillMuted = remaining.filter(
      (mute) => mute.session === null || mute.session === session,
    );
    this.log(
      JSON.stringify(
        {
          thread_id: id,
          removed,
          scope: session ?? "all sessions",
          muted: stillMuted.length > 0,
          ...(stillMuted.length
            ? { still_muted_by: stillMuted.map(scopeLabel) }
            : {}),
        },
        null,
        2,
      ),
    );
  }
}

export class ThreadsMutedCommand extends Command {
  static summary = "List threads muted for this session or profile";
  static description =
    "Lists the mutes that apply to the current runtime session (its own mutes and profile-wide ones). Outside a runtime session, or with --all-sessions, lists every mute on the profile.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads muted",
  ];
  static flags = {
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsMutedCommand);
    const profile = profileName(this);
    const session = muteSession(flags["all-sessions"]);
    const mutes = readThreadMutes(this.config.configDir, profile).filter(
      (mute) =>
        session === null || mute.session === null || mute.session === session,
    );
    this.log(
      JSON.stringify(
        mutes.map((mute) => ({
          thread_id: mute.thread_id,
          scope: scopeLabel(mute),
          muted_at: mute.muted_at,
        })),
        null,
        2,
      ),
    );
  }
}
