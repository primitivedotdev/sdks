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

function harness(
  pages: Array<Page | Response>,
  ownerMemberAddress: () => Promise<string | null> = async () => null,
) {
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
      ownerMemberAddress,
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
          email(identity.ownerAddress, {
            subject: "Connect your agent to Primitive",
          }),
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
          // Each email names the address that received it and the command
          // that reads it under that profile, ready to run.
          to: identity.agentAddress,
          read_command: `PRIMITIVE_AGENT_PROFILE=${identity.profileName} primitive emails get --id ${peer.id} --brief`,
        },
      ],
      more: false,
      control_skipped: 2,
      owner_member_address: null,
      profile: identity.profileName,
      to: identity.agentAddress,
      read_command: `PRIMITIVE_AGENT_PROFILE=${identity.profileName} primitive emails get --id <id> --brief`,
    });
    expect(JSON.stringify(first)).not.toContain("private subject");
    expect(h.emitted).toEqual([first]);
    expect(h.savedCursor()).toBe("c1");

    // The first check followed c1 to an empty page, which returns a null
    // cursor; the saved one is kept and the next check starts there.
    expect(h.queries[1].get("since")).toBe("c1");
    const second = await h.check();
    expect(h.queries[2].get("since")).toBe("c1");
    expect(second.outcome).toBe("empty");
    expect(h.savedCursor()).toBe("c1");
  });

  it("keeps the cursor when the result could not be delivered or a later page fails", async () => {
    const failure = () =>
      Response.json(
        { success: false, error: { code: "internal_error", message: "down" } },
        { status: 500 },
      );
    const h = harness([
      { rows: [email("peer@example.com")], cursor: "c1" },
      { rows: [], cursor: null },
      { rows: [email("peer@example.com")], cursor: "c1" },
      failure(),
    ]);
    await expect(
      h.check(() => {
        throw new Error("stdout closed");
      }),
    ).rejects.toThrow("stdout closed");
    expect(h.savedCursor()).toBeNull();
    // The next check starts from the beginning again, and a failed later
    // page leaves the cursor where it was.
    await expect(h.check()).rejects.toBeInstanceOf(MailCheckApiError);
    expect(h.queries[2].get("since")).toBe("start");
    expect(h.queries[3].get("since")).toBe("c1");
    expect(h.savedCursor()).toBeNull();
  });

  it("follows the cursor past a short page instead of stopping on page length", async () => {
    const a = email("peer@example.com");
    const b = email("peer@example.com");
    const h = harness([
      { rows: [a], cursor: "c1" },
      { rows: [b], cursor: "c2" },
      { rows: [], cursor: null },
    ]);
    const result = await h.check();
    expect(result.emails.map((row) => row.id)).toEqual([a.id, b.id]);
    expect(result.more).toBe(false);
    expect(h.queries.map((query) => query.get("since"))).toEqual([
      "start",
      "c1",
      "c2",
    ]);
    expect(h.savedCursor()).toBe("c2");
  });

  it("reports more when the page limit stops it on short pages that still carry a cursor", async () => {
    const h = harness(
      Array.from({ length: 5 }, (_, index) => ({
        rows: [email("peer@example.com")],
        cursor: `c${index + 1}`,
      })),
    );
    const result = await h.check();
    expect(result.emails).toHaveLength(5);
    expect(result.more).toBe(true);
    expect(h.fetch).toHaveBeenCalledTimes(5);
    expect(h.savedCursor()).toBe("c5");
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

  it("lists mail a person wrote from the control address and counts only setup and presence mail", async () => {
    // The owner wrote from the control address before they had a personal
    // one. That email awaits an answer, so it must never be hidden as
    // control mail; only the fixed-subject setup and presence mail is.
    const fromOwner = email(identity.ownerAddress.toUpperCase(), {
      subject: "Can you look at the deploy?",
    });
    const h = harness([
      {
        rows: [
          email(identity.ownerAddress, {
            subject: "Connect your agent to Primitive",
          }),
          email(identity.ownerAddress, { subject: "Receiver presence check" }),
          email(identity.ownerAddress, {
            subject: "Receiver presence check",
            presence_control: { status: "pending", valid_for_ms: 0 },
          }),
          fromOwner,
          email(identity.ownerAddress, { subject: null }),
        ],
        cursor: "c1",
      },
      { rows: [], cursor: null },
    ]);
    const result = await h.check();
    expect(result.outcome).toBe("mail");
    expect(result.control_skipped).toBe(3);
    expect(result.emails).toHaveLength(2);
    expect(result.emails[0]).toMatchObject({
      id: fromOwner.id,
      sender: fromOwner.sender,
    });
  });

  it("reports the owner's personal address read beside the mail", async () => {
    const h = harness(
      [{ rows: [], cursor: null }],
      async () => "ada@example.com",
    );
    const result = await h.check();
    expect(result.outcome).toBe("empty");
    expect(result.owner_member_address).toBe("ada@example.com");
  });

  it("still reports the mail when reading the owner address fails", async () => {
    const h = harness([{ rows: [], cursor: null }], async () => {
      throw new Error("offline");
    });
    const result = await h.check();
    expect(result.owner_member_address).toBeNull();
  });
});
