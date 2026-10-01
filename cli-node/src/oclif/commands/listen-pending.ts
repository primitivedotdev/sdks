import { Command, Flags } from "@oclif/core";
import { resolveCliAuth } from "../auth.js";
import { currentMailSessionKey } from "../mail-session.js";
import {
  pendingMailPath,
  readPendingMail,
  removePendingMail,
} from "../pending-mail.js";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export default class ListenPendingCommand extends Command {
  static summary =
    "List mail a session's wake listener accepted but not yet read";
  static description =
    "Prints the durable pending notices for one Claude Code session of the selected connected profile. A notice is written before its wake event is acknowledged and is removed when the session reads that exact email with `primitive emails get --id <id>`. Notices carry only server-derived metadata (sender, thread, whether this profile sent in the thread, newer-mail count), never subject or body. Status notices (kind status) name a peer signal on a message this session sent and have nothing to read; clear them with --clear after delivering them. Reading never takes the writer lock, so it works while a listener holds it.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> listen pending --session <claude-session-id>",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> listen pending --session <claude-session-id> --clear <email-id>",
  ];
  static flags = {
    session: Flags.string({
      description:
        "Claude Code session ID (defaults to CLAUDE_CODE_SESSION_ID in a Claude session)",
    }),
    clear: Flags.string({
      multiple: true,
      description:
        "Remove these exact email IDs after delivering them (repeatable)",
    }),
    json: Flags.boolean({ description: "Print JSON (already the default)" }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ListenPendingCommand);
    const profileName = resolveCliAuth({ configDir: this.config.configDir })
      .connectedAgent?.profileName;
    if (!profileName)
      this.error(
        "Pending notices belong to a connected agent profile. Set PRIMITIVE_AGENT_PROFILE.",
      );
    const runtime = currentMailSessionKey();
    const session =
      flags.session ??
      (runtime?.startsWith("claude:") ? runtime.slice(7) : undefined);
    if (!session || !UUID.test(session))
      this.error("Pass --session with the Claude Code session UUID.");
    const clear = flags.clear ?? [];
    if (clear.some((id) => !UUID.test(id)))
      this.error("--clear takes exact email UUIDs.");
    const notices = clear.length
      ? await removePendingMail(
          this.config.configDir,
          profileName,
          session,
          clear,
        )
      : readPendingMail(this.config.configDir, profileName, session);
    this.log(
      JSON.stringify(
        {
          session_id: session.toLowerCase(),
          path: pendingMailPath(this.config.configDir, profileName, session),
          notices,
        },
        null,
        2,
      ),
    );
  }
}
