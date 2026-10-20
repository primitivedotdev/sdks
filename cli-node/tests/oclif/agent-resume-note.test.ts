import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearProfileResumeNote,
  clearResumeNote,
  NOTE_REQUEST_TIMEOUT_MS,
  publishResumeNote,
  RESUME_NOTE_NAME,
  resumeNoteValue,
} from "../../src/oclif/agent-resume-note.js";
import {
  type ConnectedAgentProfile,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";

const own = "agent@example.test";
const session = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const profile: ConnectedAgentProfile = {
  version: 1,
  auth_method: "agent_connection",
  api_key: ["pconn", "fixture", "resume"].join("_"),
  api_base_url: "https://api.primitive-staging-1.com/v1",
  org_id: "22222222-2222-4222-8222-222222222222",
  agent_address: own,
  owner_address: "owner@example.test",
  invitation_hash: "a".repeat(64),
  created_at: "2026-01-01T00:00:00.000Z",
};

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function configDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "primitive-resume-note-"));
  directories.push(directory);
  saveConnectedAgentProfile(directory, "work", profile);
  return directory;
}

function note(value: unknown, version = "4") {
  return {
    address: own,
    name: RESUME_NOTE_NAME,
    value,
    visibility: "private",
    version,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-02T00:00:00Z",
  };
}
type Reply = { body: unknown; status?: number };
const ok = (data: unknown): Reply => ({ body: { success: true, data } });
const missing: Reply = {
  status: 404,
  body: { success: false, error: { code: "not_found", message: "Not found" } },
};

function fixture(...responses: Reply[]) {
  const calls: { method: string; url: URL; body: unknown }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const request = new Request(input, init);
    const body = await request.text();
    calls.push({
      method: request.method,
      url: new URL(request.url),
      body: body ? JSON.parse(body) : undefined,
    });
    const next = responses.shift();
    if (!next) throw new Error("Unexpected extra API request");
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { fetch, calls };
}

describe("AGENT_RESUME value", () => {
  it("is the resume command for Claude Code and Codex sessions", () => {
    expect(resumeNoteValue("claude", session)).toBe(
      `claude --resume ${session}`,
    );
    expect(resumeNoteValue("codex", session)).toBe(`codex resume ${session}`);
  });

  it("lowercases an uppercase session ID", () => {
    expect(resumeNoteValue("claude", ` ${session.toUpperCase()} `)).toBe(
      `claude --resume ${session}`,
    );
  });

  it("has no value for an invalid ID or another runtime", () => {
    expect(resumeNoteValue("claude", "not-a-uuid")).toBeNull();
    expect(resumeNoteValue("codex", `${session}x`)).toBeNull();
    expect(resumeNoteValue("claude", "")).toBeNull();
    expect(resumeNoteValue("claude", undefined)).toBeNull();
    expect(resumeNoteValue("omp", session)).toBeNull();
  });
});

describe("publishResumeNote", () => {
  it("creates the note when the address has none", async () => {
    const directory = configDir();
    const api = fixture(missing, ok(note(`codex resume ${session}`, "1")));
    const outcome = await publishResumeNote({
      configDir: directory,
      profileName: "work",
      runtime: "codex",
      sessionId: session.toUpperCase(),
      fetch: api.fetch,
    });
    expect(outcome).toBe("written");
    expect(api.calls.map((call) => call.method)).toEqual(["GET", "PUT"]);
    expect(api.calls[1]?.url.pathname).toBe(
      `/v1/address-notes/${encodeURIComponent(own)}/${RESUME_NOTE_NAME}`,
    );
    expect(api.calls[1]?.body).toEqual({
      value: `codex resume ${session}`,
      if_absent: true,
      visibility: "private",
    });
  });

  it("replaces a different value at its current version", async () => {
    const directory = configDir();
    const other = "11111111-1111-4111-8111-111111111111";
    const api = fixture(
      ok(note(`claude --resume ${other}`, "7")),
      ok(note(`claude --resume ${session}`, "8")),
    );
    const outcome = await publishResumeNote({
      configDir: directory,
      profileName: "work",
      runtime: "claude",
      sessionId: session,
      fetch: api.fetch,
    });
    expect(outcome).toBe("written");
    expect(api.calls[1]?.body).toEqual({
      value: `claude --resume ${session}`,
      if_version: "7",
      visibility: "private",
    });
  });

  it("sends no write when the note already holds the value", async () => {
    const directory = configDir();
    const api = fixture(ok(note(`claude --resume ${session}`)));
    const outcome = await publishResumeNote({
      configDir: directory,
      profileName: "work",
      runtime: "claude",
      sessionId: session,
      fetch: api.fetch,
    });
    expect(outcome).toBe("unchanged");
    expect(api.calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("rewrites an unchanged note when asked, so a new claim refreshes it", async () => {
    const directory = configDir();
    const api = fixture(
      ok(note(`claude --resume ${session}`, "4")),
      ok(note(`claude --resume ${session}`, "5")),
    );
    const outcome = await publishResumeNote({
      configDir: directory,
      profileName: "work",
      runtime: "claude",
      sessionId: session,
      rewrite: true,
      fetch: api.fetch,
    });
    expect(outcome).toBe("written");
    expect(api.calls[1]?.body).toEqual({
      value: `claude --resume ${session}`,
      if_version: "4",
      visibility: "private",
    });
  });

  it("writes nothing for an invalid session ID", async () => {
    const directory = configDir();
    const api = fixture();
    const outcome = await publishResumeNote({
      configDir: directory,
      profileName: "work",
      runtime: "claude",
      sessionId: "session-1",
      fetch: api.fetch,
    });
    expect(outcome).toBe("skipped");
    expect(api.fetch).not.toHaveBeenCalled();
  });

  it("reports a failed write without throwing", async () => {
    const directory = configDir();
    const api = fixture(missing, {
      status: 500,
      body: { success: false, error: { code: "internal", message: "x" } },
    });
    await expect(
      publishResumeNote({
        configDir: directory,
        profileName: "work",
        runtime: "claude",
        sessionId: session,
        fetch: api.fetch,
      }),
    ).resolves.toBe("failed");
    const offline = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      publishResumeNote({
        configDir: directory,
        profileName: "work",
        runtime: "claude",
        sessionId: session,
        fetch: offline,
      }),
    ).resolves.toBe("failed");
  });
});

describe("clearResumeNote", () => {
  it("deletes the note at its current version", async () => {
    const api = fixture(ok(note(`claude --resume ${session}`, "9")), {
      body: { success: true, data: { deleted: true } },
    });
    await expect(clearResumeNote(profile, api.fetch)).resolves.toBe("cleared");
    expect(api.calls.map((call) => call.method)).toEqual(["GET", "DELETE"]);
    expect(api.calls[1]?.url.pathname).toBe(
      `/v1/address-notes/${encodeURIComponent(own)}/${RESUME_NOTE_NAME}`,
    );
    expect(api.calls[1]?.url.searchParams.get("if_version")).toBe("9");
  });

  it("sends no delete when there is no note", async () => {
    const api = fixture(missing);
    await expect(clearResumeNote(profile, api.fetch)).resolves.toBe("absent");
    expect(api.calls).toHaveLength(1);
  });

  it("reports a failure without throwing", async () => {
    const api = fixture({
      status: 503,
      body: { success: false, error: { code: "unavailable", message: "x" } },
    });
    await expect(clearResumeNote(profile, api.fetch)).resolves.toBe("failed");
  });
});

describe("clearProfileResumeNote", () => {
  it("deletes the note of a saved profile and skips a missing one", async () => {
    const directory = configDir();
    const api = fixture(missing);
    await expect(
      clearProfileResumeNote({
        configDir: directory,
        profileName: "work",
        fetch: api.fetch,
      }),
    ).resolves.toBe("absent");
    await expect(
      clearProfileResumeNote({
        configDir: directory,
        profileName: "none",
        fetch: api.fetch,
      }),
    ).resolves.toBe("skipped");
    expect(api.calls).toHaveLength(1);
  });
});

describe("AGENT_RESUME request deadlines", () => {
  /** Answers the read, then never answers the write until it is aborted. */
  function stalling(existing: boolean) {
    const methods: string[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const request = new Request(input, init);
      methods.push(request.method);
      if (request.method === "GET")
        return existing
          ? Response.json({
              success: true,
              data: note(`claude --resume ${session}`, "2"),
            })
          : Response.json(missing.body, { status: 404 });
      return new Promise<Response>((_resolve, reject) => {
        request.signal.addEventListener("abort", () =>
          reject(request.signal.reason),
        );
      });
    });
    return { fetch, methods };
  }

  it("gives up on a stalled write", async () => {
    const directory = configDir();
    const api = stalling(false);
    const started = Date.now();
    await expect(
      publishResumeNote({
        configDir: directory,
        profileName: "work",
        runtime: "claude",
        sessionId: session,
        fetch: api.fetch,
        timeoutMs: 50,
      }),
    ).resolves.toBe("failed");
    expect(api.methods).toEqual(["GET", "PUT"]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("gives up on a stalled delete", async () => {
    const api = stalling(true);
    const started = Date.now();
    await expect(clearResumeNote(profile, api.fetch, 50)).resolves.toBe(
      "failed",
    );
    expect(api.methods).toEqual(["GET", "DELETE"]);
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("defaults every request to a ten second deadline", () => {
    expect(NOTE_REQUEST_TIMEOUT_MS).toBe(10_000);
  });
});
