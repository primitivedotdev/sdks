import { Command, Flags } from "@oclif/core";
import type { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import { extractErrorPayload, writeErrorWithHints } from "../api-command.js";
import { resolveCliAuth } from "../auth.js";
import { currentMailSessionKey } from "../mail-session.js";
import {
  muteThread,
  readThreadMutes,
  type ThreadMute,
  unmuteThread,
} from "../thread-mutes.js";

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const security = [{ scheme: "bearer" as const, type: "http" as const }];

type Client = PrimitiveApiClient["client"];

const idFlag = Flags.string({
  required: true,
  description: "Thread ID (the thread_id of any email in the conversation)",
});
const allSessionsFlag = Flags.boolean({
  description:
    "For a local mute, apply to every session on this profile instead of only the current runtime session",
  exclusive: ["session-only"],
});
const sessionOnlyFlag = Flags.boolean({
  description:
    "Keep the change local to the current Claude Code or Codex session instead of muting the thread for this address on the server",
  exclusive: ["all-sessions"],
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

/** The current runtime session, or null for a profile-wide local mute. */
function muteSession(allSessions: boolean): string | null {
  if (allSessions) return null;
  return currentMailSessionKey();
}

function requireSession(command: Command): string {
  const session = currentMailSessionKey();
  if (!session)
    command.error(
      "--session-only needs a Claude Code or Codex session. Run it from inside the session, or omit it to mute the thread for this address.",
    );
  return session;
}

function threadId(command: Command, value: string): string {
  if (!UUID.test(value)) command.error("--id must be a thread UUID.");
  return value.toLowerCase();
}

function scopeLabel(mute: ThreadMute): string {
  return mute.session ?? "all sessions";
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function errorMessage(payload: unknown): string | null {
  const body = record(payload);
  const message = record(body?.error)?.message ?? body?.message;
  return typeof message === "string" ? message : null;
}

type ServerResult =
  | { kind: "ok"; data: unknown }
  | { kind: "unsupported" }
  | { kind: "thread_not_found"; payload: unknown }
  | { kind: "error"; payload: unknown };

/**
 * Call a thread mute endpoint. A server that predates them answers with a
 * route-level 404 (or 405/501), which is reported as unsupported so the
 * caller can fall back to a local mute. A 404 for an unknown thread names
 * the thread and is reported separately.
 */
async function callMuteApi(
  client: Client,
  method: "put" | "delete",
  id: string,
): Promise<ServerResult> {
  const response = await client[method]({
    security,
    url: "/threads/{id}/mute",
    path: { id },
    responseStyle: "fields",
  });
  if (response.error === undefined)
    return { kind: "ok", data: record(response.data)?.data };
  const status = response.response?.status;
  if (status === 405 || status === 501) return { kind: "unsupported" };
  if (status === 404)
    return /^thread not found/i.test(errorMessage(response.error) ?? "")
      ? { kind: "thread_not_found", payload: response.error }
      : { kind: "unsupported" };
  return { kind: "error", payload: response.error };
}

async function apiClient(command: Command): Promise<Client> {
  const { apiClient } = await createAuthenticatedCliApiClient({
    configDir: command.config.configDir,
  });
  return apiClient.client;
}

function failWith(payload: unknown): void {
  writeErrorWithHints(extractErrorPayload(payload));
  process.exitCode = 1;
}

const UNSUPPORTED_NOTE =
  "This server does not keep thread mutes yet, so the mute is stored locally for this profile.";

export class ThreadsMuteCommand extends Command {
  static summary = "Stop wakes for one thread";
  static description =
    "Mutes the thread for this connected agent's address on the server, so no session or runtime using the address is woken by it. Mail in it is still received and readable, reads report it as muted, and its delivery event is completed so it is not redelivered. With --session-only the mute is stored locally and applies only to the current Claude Code or Codex session. A server without thread mutes gets a local mute instead: the current runtime session's, or with --all-sessions (or outside a session) every session on the profile.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads mute --id <thread-id>",
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads mute --id <thread-id> --session-only",
  ];
  static flags = {
    id: idFlag,
    "session-only": sessionOnlyFlag,
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsMuteCommand);
    const id = threadId(this, flags.id);
    const profile = profileName(this);
    if (!flags["session-only"]) {
      const result = await callMuteApi(await apiClient(this), "put", id);
      if (result.kind === "ok") {
        const data = record(result.data);
        this.log(
          JSON.stringify(
            {
              thread_id: id,
              muted: true,
              scope: "address",
              stored: "server",
              address: typeof data?.address === "string" ? data.address : null,
              muted_at:
                typeof data?.muted_at === "string" ? data.muted_at : null,
            },
            null,
            2,
          ),
        );
        return;
      }
      if (result.kind !== "unsupported") return failWith(result.payload);
      process.stderr.write(`${UNSUPPORTED_NOTE}\n`);
    }
    const session = flags["session-only"]
      ? requireSession(this)
      : muteSession(flags["all-sessions"]);
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
          stored: "local",
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
    "Removes the server mute for this address and this session's local mute for the thread, or every local mute on the profile with --all-sessions (also the default outside a runtime session). With --session-only only this session's local mute is removed. Reports any local mute that still applies.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads unmute --id <thread-id>",
  ];
  static flags = {
    id: idFlag,
    "session-only": sessionOnlyFlag,
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsUnmuteCommand);
    const id = threadId(this, flags.id);
    const profile = profileName(this);
    let server: "unmuted" | "unsupported" | "not_found" | null = null;
    if (!flags["session-only"]) {
      const result = await callMuteApi(await apiClient(this), "delete", id);
      if (result.kind === "error") return failWith(result.payload);
      server =
        result.kind === "ok"
          ? "unmuted"
          : result.kind === "thread_not_found"
            ? "not_found"
            : "unsupported";
    }
    const session = flags["session-only"]
      ? requireSession(this)
      : muteSession(flags["all-sessions"]);
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
          ...(server === null ? {} : { server }),
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
  static summary = "List muted threads for this address and session";
  static description =
    "Lists the server mutes for this connected agent's address and the local mutes that apply to the current runtime session (its own and profile-wide ones). Outside a runtime session, or with --all-sessions, lists every local mute on the profile. With --session-only only local mutes are listed. Each entry says whether it is stored on the server or locally.";
  static examples = [
    "PRIMITIVE_AGENT_PROFILE=work <%= config.bin %> threads muted",
  ];
  static flags = {
    "session-only": sessionOnlyFlag,
    "all-sessions": allSessionsFlag,
    json: jsonFlag,
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ThreadsMutedCommand);
    const profile = profileName(this);
    const entries: Record<string, unknown>[] = [];
    if (!flags["session-only"]) {
      const response = await (await apiClient(this)).get({
        security,
        url: "/threads/muted",
        responseStyle: "fields",
      });
      const rows = record(response.data)?.data;
      if (response.error === undefined && Array.isArray(rows)) {
        for (const row of rows.map(record))
          if (row && typeof row.thread_id === "string")
            entries.push({
              thread_id: row.thread_id,
              scope: "address",
              stored: "server",
              ...(typeof row.address === "string"
                ? { address: row.address }
                : {}),
              muted_at: typeof row.muted_at === "string" ? row.muted_at : null,
            });
      } else if (
        // An older server reads "muted" as a thread id (400 or 404).
        ![400, 404, 405, 501].includes(response.response?.status ?? 0)
      ) {
        return failWith(response.error);
      }
    }
    const session = flags["session-only"]
      ? requireSession(this)
      : muteSession(flags["all-sessions"]);
    for (const mute of readThreadMutes(this.config.configDir, profile))
      if (session === null || mute.session === null || mute.session === session)
        entries.push({
          thread_id: mute.thread_id,
          scope: scopeLabel(mute),
          stored: "local",
          muted_at: mute.muted_at,
        });
    this.log(JSON.stringify(entries, null, 2));
  }
}
