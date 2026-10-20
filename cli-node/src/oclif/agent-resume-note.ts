import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import {
  AddressNotesApiError,
  runAddressNotesRequest,
} from "./address-notes.js";
import {
  type ConnectedAgentProfile,
  loadConnectedAgentProfile,
} from "./connected-agent-profile.js";

/**
 * The address note holding the command that resumes the coding session an
 * agent is bound to, so an app can offer to reopen that exact session.
 */
export const RESUME_NOTE_NAME = "AGENT_RESUME";

/**
 * Each note request gets this long. The note is best effort and runs inside
 * registration, connect, disconnect and their hooks, so a stalled request
 * must never hold them up.
 */
export const NOTE_REQUEST_TIMEOUT_MS = 10_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The AGENT_RESUME value for a session: `claude --resume <uuid>` for Claude
 * Code or `codex resume <uuid>` for Codex, with the ID lowercased. Any other
 * runtime, or an ID that is not a UUID, has no value.
 */
export function resumeNoteValue(
  runtime: string,
  sessionId: string | null | undefined,
): string | null {
  const id = sessionId?.trim().toLowerCase() ?? "";
  if (!UUID.test(id)) return null;
  if (runtime === "claude") return `claude --resume ${id}`;
  if (runtime === "codex") return `codex resume ${id}`;
  return null;
}

/**
 * `skipped`: nothing to write (no value for this runtime or ID, or no
 * connected profile). `unchanged`: the note already holds this value, so no
 * write was sent.
 */
export type ResumeNoteWrite = "written" | "unchanged" | "skipped" | "failed";

export type ResumeNoteClear = "cleared" | "absent" | "failed";

type Note = { value?: unknown; version?: string };

function client(profile: ConnectedAgentProfile, fetchImpl?: typeof fetch) {
  return new PrimitiveApiClient({
    apiKey: profile.api_key,
    apiBaseUrl: profile.api_base_url,
    ...(fetchImpl ? { fetch: fetchImpl } : {}),
  }).client;
}

/** The current note, or null when the address has none. */
async function currentNote(
  api: ReturnType<typeof client>,
  address: string,
  timeoutMs: number,
): Promise<Note | null> {
  try {
    return (await runAddressNotesRequest(api, {
      action: "get",
      address,
      name: RESUME_NOTE_NAME,
      signal: AbortSignal.timeout(timeoutMs),
    })) as Note;
  } catch (error) {
    if (error instanceof AddressNotesApiError && error.status === 404)
      return null;
    throw error;
  }
}

/**
 * Write the AGENT_RESUME note for a connected profile's address. Skips the
 * write when the note already holds the same value, so a resume hook that
 * runs on every start does not rewrite it. `rewrite` writes it anyway, so a
 * new claim leaves the note no older than the connection it belongs to.
 * Never throws.
 */
export async function publishResumeNote(options: {
  configDir: string;
  profileName: string;
  runtime: string;
  sessionId: string | null | undefined;
  rewrite?: boolean;
  fetch?: typeof fetch;
  /** Deadline for each request; defaults to NOTE_REQUEST_TIMEOUT_MS. */
  timeoutMs?: number;
}): Promise<ResumeNoteWrite> {
  const timeoutMs = options.timeoutMs ?? NOTE_REQUEST_TIMEOUT_MS;
  const value = resumeNoteValue(options.runtime, options.sessionId);
  if (value === null) return "skipped";
  try {
    const profile = loadConnectedAgentProfile(
      options.configDir,
      options.profileName,
    );
    if (!profile) return "skipped";
    const api = client(profile, options.fetch);
    const address = profile.agent_address;
    const current = await currentNote(api, address, timeoutMs);
    if (current?.value === value && !options.rewrite) return "unchanged";
    await runAddressNotesRequest(api, {
      action: "set",
      address,
      name: RESUME_NOTE_NAME,
      value,
      visibility: "private",
      signal: AbortSignal.timeout(timeoutMs),
      ...(current?.version
        ? { ifVersion: current.version }
        : { ifAbsent: true }),
    });
    return "written";
  } catch {
    return "failed";
  }
}

/**
 * Delete the AGENT_RESUME note with this credential, before it is revoked.
 * Never throws.
 */
export async function clearResumeNote(
  profile: ConnectedAgentProfile,
  fetchImpl?: typeof fetch,
  timeoutMs: number = NOTE_REQUEST_TIMEOUT_MS,
): Promise<ResumeNoteClear> {
  try {
    const api = client(profile, fetchImpl);
    const current = await currentNote(api, profile.agent_address, timeoutMs);
    if (!current) return "absent";
    await runAddressNotesRequest(api, {
      action: "delete",
      address: profile.agent_address,
      name: RESUME_NOTE_NAME,
      signal: AbortSignal.timeout(timeoutMs),
      ...(current.version ? { ifVersion: current.version } : {}),
    });
    return "cleared";
  } catch {
    return "failed";
  }
}

/**
 * Delete the AGENT_RESUME note of a connected profile's address, for a
 * connection that binds no resumable session, so a command left by an older
 * session never points at the wrong conversation. Never throws.
 */
export async function clearProfileResumeNote(options: {
  configDir: string;
  profileName: string;
  fetch?: typeof fetch;
}): Promise<ResumeNoteClear | "skipped"> {
  try {
    const profile = loadConnectedAgentProfile(
      options.configDir,
      options.profileName,
    );
    if (!profile) return "skipped";
    return await clearResumeNote(profile, options.fetch);
  } catch {
    return "failed";
  }
}
