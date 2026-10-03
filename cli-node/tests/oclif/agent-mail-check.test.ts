import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  checkAgentMail,
  MAIL_CHECK_PAGE_SIZE,
  MailCheckApiError,
  type MailCheckResult,
} from "../../src/oclif/agent-mail-check.js";
import { agentProfileDirectory } from "../../src/oclif/connected-agent-profile.js";

const apiBaseUrl = "https://api.primitive.dev/v1";
const identity = {
  profileName: "connection-0123456789ab",
  orgId: randomUUID(),
  agentAddress: "agent@example.com",
  ownerAddress: "owner@example.com",
  apiBaseUrl,
};

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function email(sender: string, extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    sender,
    recipient: identity.agentAddress,
    domain: "example.com",
    status: "accepted",
    created_at: "2026-10-01T00:00:00.000Z",
    received_at: "2026-10-01T00:00:00.000Z",
    webhook_attempt_count: 0,
    reply_count: 0,
    last_replied_at: null,
    thread_id: randomUUID(),
    subject: "private subject",
    ...extra,
  };
}

type Page = { rows: ReturnType<typeof email>[]; cursor: string | null };

function harness(pages: Array<Page | Response>) {
  const configDir = mkdtempSync(join(tmpdir(), "agent-mail-check-"));
  directories.push(configDir);
  const queries: URLSearchParams[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) => {
    const request = input instanceof Request ? input : new Request(input);
    queries.push(new URL(request.url).searchParams);
    const page = pages.shift();
    if (!page) throw new Error("unexpected request");
    if (page instanceof Response) return page;
    return Response.json({
      success: true,
      data: page.rows,
      meta: { total: page.rows.length, limit: 100, cursor: page.cursor },
    });
  });
  const client = new PrimitiveApiClient({
    apiKey: ["pconn", "b".repeat(48)].join("_"),
    apiBaseUrl,
    fetch,
  });
  const emitted: MailCheckResult[] = [];
  const check = (emit = (result: MailCheckResult) => emitted.push(result)) =>
    checkAgentMail({
      configDir,
      identity,
      client,
      emit: (result) => {
        emit(result);
      },
    });
  const cursorFile = join(
    agentProfileDirectory(configDir, identity.profileName),
    "mail-check.json",
  );
  const savedCursor = () =>
    existsSync(cursorFile)
      ? (JSON.parse(readFileSync(cursorFile, "utf8")) as { cursor: string })
          .cursor
      : null;
  return { check, queries, emitted, savedCursor, fetch };
}

describe("agent check-mail", () => {
  it("tails from the start, skips control mail, and resumes from the saved cursor", async () => {
    const peer = email("peer@example.com");
    const h = harness([
      {
        rows: [
          email(identity.ownerAddress),
          email("other@example.com", { presence_control: { kind: "probe" } }),
          peer,
        ],
        cursor: "c1",
      },
      { rows: [], cursor: null },
      { rows: [], cursor: null },
    ]);
    const first = await h.check();
    expect(h.queries[0].get("since")).toBe("start");
    expect(h.queries[0].get("exclude_fyi")).toBe("true");
    expect(h.queries[0].get("exclude_muted")).toBe("true");
    expect(first).toEqual({
      outcome: "mail",
      emails: [
        {
          id: peer.id,
          received_at: peer.received_at,
          sender: peer.sender,
          thread_id: peer.thread_id,
        },
      ],
      more: false,
      control_skipped: 2,
      read_command: `PRIMITIVE_AGENT_PROFILE=${identity.profileName} primitive emails get --id <id> --brief`,
    });
    expect(JSON.stringify(first)).not.toContain("private subject");
    expect(h.emitted).toEqual([first]);
    expect(h.savedCursor()).toBe("c1");

    // An empty page returns a null cursor; the saved one is kept.
    const second = await h.check();
    expect(h.queries[1].get("since")).toBe("c1");
    expect(second.outcome).toBe("empty");
    expect(h.savedCursor()).toBe("c1");
  });

  it("keeps the cursor when the result could not be delivered or a later page fails", async () => {
    const h = harness([
      { rows: [email("peer@example.com")], cursor: "c1" },
      {
        rows: Array.from({ length: MAIL_CHECK_PAGE_SIZE }, () =>
          email("peer@example.com"),
        ),
        cursor: "c2",
      },
      Response.json(
        { success: false, error: { code: "internal_error", message: "down" } },
        { status: 500 },
      ),
    ]);
    await expect(
      h.check(() => {
        throw new Error("stdout closed");
      }),
    ).rejects.toThrow("stdout closed");
    expect(h.savedCursor()).toBeNull();
    // The next check starts from the beginning again, and a failed page
    // leaves the cursor where it was.
    await expect(h.check()).rejects.toBeInstanceOf(MailCheckApiError);
    expect(h.queries[1].get("since")).toBe("start");
    expect(h.queries[2].get("since")).toBe("c2");
    expect(h.savedCursor()).toBeNull();
  });

  it("stops after the page limit and reports that more mail remains", async () => {
    const full = () => ({
      rows: Array.from({ length: MAIL_CHECK_PAGE_SIZE }, () =>
        email("peer@example.com"),
      ),
      cursor: randomUUID(),
    });
    const pages = Array.from({ length: 5 }, full);
    const last = pages[4].cursor;
    const h = harness(pages);
    const result = await h.check();
    expect(result.emails).toHaveLength(5 * MAIL_CHECK_PAGE_SIZE);
    expect(result.more).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(5);
    expect(h.savedCursor()).toBe(last);
  });
});
