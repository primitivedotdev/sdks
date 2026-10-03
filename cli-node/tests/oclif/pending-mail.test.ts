import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { acquireListenLock } from "../../src/oclif/listen-state.js";
import {
  clearReadPendingMail,
  PENDING_MAIL_LIMIT,
  PENDING_STATUS_HEADROOM,
  PendingMailFullError,
  type PendingMailNotice,
  pendingMailPath,
  readPendingMail,
  recordPendingMail,
  removePendingMail,
} from "../../src/oclif/pending-mail.js";

const profile = "work";
const session = "11111111-1111-4111-8111-111111111111";
const otherSession = "99999999-9999-4999-8999-999999999999";
let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-pending-mail-"));
  mkdirSync(join(configDir, "agent-connections", "profiles", profile), {
    recursive: true,
    mode: 0o700,
  });
});
afterEach(() => rmSync(configDir, { recursive: true, force: true }));

function id(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;
}

function mail(n: number, extra: Partial<PendingMailNotice> = {}) {
  return {
    kind: "mail" as const,
    email_id: id(n),
    received_at: "2026-10-01T00:00:00.000Z",
    sender: "peer@example.com",
    thread_id: null,
    in_thread: false,
    newer: null,
    ...extra,
  };
}

describe("pending mail notices", () => {
  it("writes the agreed private file shape", async () => {
    await recordPendingMail(
      configDir,
      profile,
      session.toUpperCase(),
      mail(1, {
        thread_id: "44444444-4444-4444-8444-444444444444",
        in_thread: true,
        newer: 2,
      }),
    );
    const path = pendingMailPath(configDir, profile, session);
    expect(path).toBe(
      join(
        configDir,
        "agent-connections",
        "profiles",
        profile,
        `pending-mail-${session}.json`,
      ),
    );
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({
      version: 1,
      session_id: session,
      notices: [
        {
          kind: "mail",
          email_id: id(1),
          received_at: "2026-10-01T00:00:00.000Z",
          sender: "peer@example.com",
          thread_id: "44444444-4444-4444-8444-444444444444",
          in_thread: true,
          newer: 2,
        },
      ],
    });
  });

  it("keeps a valid interaction label on mail notices and drops anything else", async () => {
    await recordPendingMail(
      configDir,
      profile,
      session,
      mail(1, { interaction: "x402.payment/1" }),
    );
    await recordPendingMail(
      configDir,
      profile,
      session,
      mail(2, { interaction: "Pay now!" }),
    );
    const rows = readPendingMail(configDir, profile, session);
    expect(rows[0]?.interaction).toBe("x402.payment/1");
    expect(rows[1]).toBeDefined();
    expect(rows[1]?.interaction).toBeUndefined();
  });

  it("keeps status notices with their referenced send", async () => {
    await recordPendingMail(configDir, profile, session, {
      ...mail(2),
      kind: "status",
      in_thread: true,
      ref_sent_email_id: id(900),
    });
    expect(readPendingMail(configDir, profile, session)).toEqual([
      {
        ...mail(2),
        kind: "status",
        in_thread: true,
        ref_sent_email_id: id(900),
      },
    ]);
  });

  it("refuses notices without a valid sender address or with authored fields", async () => {
    await expect(
      recordPendingMail(configDir, profile, session, {
        ...mail(1),
        sender: "Peer Name",
      }),
    ).rejects.toThrow();
    await expect(
      recordPendingMail(configDir, profile, session, {
        ...mail(1),
        kind: "status",
      }),
    ).rejects.toThrow();
    expect(existsSync(pendingMailPath(configDir, profile, session))).toBe(
      false,
    );
  });

  it("deduplicates by email id, keeping the latest metadata at the end", async () => {
    await recordPendingMail(configDir, profile, session, mail(1));
    await recordPendingMail(configDir, profile, session, mail(2));
    await recordPendingMail(configDir, profile, session, mail(1, { newer: 4 }));
    expect(
      readPendingMail(configDir, profile, session).map((row) => [
        row.email_id,
        row.newer,
      ]),
    ).toEqual([
      [id(2), null],
      [id(1), 4],
    ]);
  });

  it("never evicts unread mail at the cap and refuses the write instead", async () => {
    for (let n = 1; n <= PENDING_MAIL_LIMIT; n++)
      await recordPendingMail(configDir, profile, session, mail(n));
    await expect(
      recordPendingMail(
        configDir,
        profile,
        session,
        mail(PENDING_MAIL_LIMIT + 1),
      ),
    ).rejects.toBeInstanceOf(PendingMailFullError);
    const rows = readPendingMail(configDir, profile, session);
    expect(rows).toHaveLength(PENDING_MAIL_LIMIT);
    expect(rows[0]?.email_id).toBe(id(1));
    // Refreshing a notice already listed still works when full.
    await recordPendingMail(configDir, profile, session, mail(1));
  });

  it("always journals a status notice, even when unread mail is full", async () => {
    for (let n = 1; n <= PENDING_MAIL_LIMIT; n++)
      await recordPendingMail(configDir, profile, session, mail(n));
    const status = (n: number) => ({
      ...mail(n),
      kind: "status" as const,
      in_thread: true,
      ref_sent_email_id: id(900),
    });
    for (let n = 1; n <= PENDING_STATUS_HEADROOM + 2; n++)
      await recordPendingMail(configDir, profile, session, status(500 + n));
    const rows = readPendingMail(configDir, profile, session);
    expect(rows).toHaveLength(PENDING_MAIL_LIMIT + PENDING_STATUS_HEADROOM);
    // Every unread mail notice is kept; the oldest status notices gave way.
    expect(rows.filter((row) => row.kind !== "status")).toHaveLength(
      PENDING_MAIL_LIMIT,
    );
    expect(rows.at(-1)?.email_id).toBe(id(500 + PENDING_STATUS_HEADROOM + 2));
    expect(rows.some((row) => row.email_id === id(501))).toBe(false);
  });

  it("does not count status notices against the mail cap", async () => {
    await recordPendingMail(configDir, profile, session, {
      ...mail(1),
      kind: "status",
      in_thread: true,
      ref_sent_email_id: id(900),
    });
    for (let n = 2; n <= PENDING_MAIL_LIMIT + 1; n++)
      await recordPendingMail(configDir, profile, session, mail(n));
    const rows = readPendingMail(configDir, profile, session);
    expect(rows).toHaveLength(PENDING_MAIL_LIMIT + 1);
    expect(rows[0]?.kind).toBe("status");
    await expect(
      recordPendingMail(
        configDir,
        profile,
        session,
        mail(PENDING_MAIL_LIMIT + 2),
      ),
    ).rejects.toBeInstanceOf(PendingMailFullError);
  });

  it("removes exact ids and deletes the file when empty", async () => {
    await recordPendingMail(configDir, profile, session, mail(1));
    await recordPendingMail(configDir, profile, session, mail(2));
    expect(
      await removePendingMail(configDir, profile, session, [id(1)]),
    ).toEqual([mail(2)]);
    await removePendingMail(configDir, profile, session, [id(2)]);
    expect(existsSync(pendingMailPath(configDir, profile, session))).toBe(
      false,
    );
  });

  it("clears a read email from the named session only, never without one", async () => {
    await recordPendingMail(configDir, profile, session, mail(1));
    await recordPendingMail(configDir, profile, session, mail(2));
    await recordPendingMail(configDir, profile, otherSession, mail(1));
    await clearReadPendingMail(configDir, profile, session, id(1));
    expect(readPendingMail(configDir, profile, session)).toEqual([mail(2)]);
    expect(readPendingMail(configDir, profile, otherSession)).toEqual([
      mail(1),
    ]);
    // A read outside any session leaves every session's notice in place.
    await recordPendingMail(configDir, profile, session, mail(1));
    await clearReadPendingMail(configDir, profile, null, id(1));
    expect(readPendingMail(configDir, profile, session)).toEqual([
      mail(2),
      mail(1),
    ]);
    expect(readPendingMail(configDir, profile, otherSession)).toEqual([
      mail(1),
    ]);
  });

  it("reads a corrupt file as empty without moving it, and a writer sets it aside", async () => {
    const path = pendingMailPath(configDir, profile, session);
    writeFileSync(path, "{not json", { mode: 0o600 });
    expect(readPendingMail(configDir, profile, session)).toEqual([]);
    expect(existsSync(path)).toBe(true);
    await recordPendingMail(configDir, profile, session, mail(3));
    expect(readPendingMail(configDir, profile, session)).toEqual([mail(3)]);
    const directory = join(configDir, "agent-connections", "profiles", profile);
    expect(
      readdirSync(directory).filter((name) => name.includes(".corrupt-")),
    ).toHaveLength(1);
  });

  it("treats a file for another session as foreign", async () => {
    const path = pendingMailPath(configDir, profile, session);
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        session_id: otherSession,
        notices: [mail(1)],
      }),
      { mode: 0o600 },
    );
    expect(readPendingMail(configDir, profile, session)).toEqual([]);
  });

  it("lets a reader see notices while another process holds the writer lock", async () => {
    await recordPendingMail(configDir, profile, session, mail(1));
    const lock = join(
      configDir,
      "agent-connections",
      "profiles",
      profile,
      ".pending-mail-lock",
    );
    const release = acquireListenLock(lock, "shared-mail-state");
    let written = false;
    const pending = recordPendingMail(
      configDir,
      profile,
      session,
      mail(2),
    ).then(() => {
      written = true;
    });
    await new Promise((done) => setTimeout(done, 60));
    expect(written).toBe(false);
    expect(readPendingMail(configDir, profile, session)).toEqual([mail(1)]);
    release();
    await pending;
    expect(readPendingMail(configDir, profile, session)).toEqual([
      mail(1),
      mail(2),
    ]);
  });

  it("keeps every notice when separate processes write concurrently", async () => {
    const moduleUrl = resolve("src/oclif/pending-mail.ts");
    const writers = 6;
    const perWriter = 5;
    const children = Array.from({ length: writers }, (_, writer) => {
      const script = `
        const { recordPendingMail } = await import(${JSON.stringify(moduleUrl)});
        for (let n = 0; n < ${perWriter}; n++) {
          const index = ${writer} * 100 + n + 1;
          await recordPendingMail(${JSON.stringify(configDir)}, ${JSON.stringify(profile)}, ${JSON.stringify(session)}, {
            kind: "mail",
            email_id: "00000000-0000-4000-8000-" + String(index).padStart(12, "0"),
            received_at: "2026-10-01T00:00:00.000Z",
            sender: "peer@example.com",
            thread_id: null,
            in_thread: false,
            newer: null,
          });
        }
      `;
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", script],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      let stderr = "";
      child.stderr.on("data", (chunk) => {
        stderr += String(chunk);
      });
      return new Promise<{ code: number | null; stderr: string }>((done) =>
        child.on("exit", (code) => done({ code, stderr })),
      );
    });
    const results = await Promise.all(children);
    for (const result of results) expect(result.code, result.stderr).toBe(0);
    const ids = readPendingMail(configDir, profile, session).map(
      (row) => row.email_id,
    );
    expect(new Set(ids).size).toBe(writers * perWriter);
  }, 30_000);
});
