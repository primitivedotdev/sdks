import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getEmail: vi.fn(),
  listEmails: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return { ...actual, getEmail: mocks.getEmail, listEmails: mocks.listEmails };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import WaitCommand, {
  detailMatches,
  parseWaitDuration,
  senderMatches,
  WAIT_EXIT_CODES,
  waitForEmail,
} from "../../src/oclif/commands/wait.js";
import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

type FakeMail = {
  id: string;
  sender: string;
  from_email?: string;
  subject: string;
  body_text?: string | null;
  body_html?: string | null;
  thread_id?: string | null;
  reply_to_sent_email_id?: string | null;
  status?: string;
  created_at?: string;
};

const LONG_AGO = "2026-01-05T12:00:00.000Z";

function detail(mail: FakeMail) {
  return {
    id: mail.id,
    status: mail.status ?? "accepted",
    sender: mail.sender,
    recipient: "agent@acme.primitive.email",
    from_email: mail.from_email ?? mail.sender,
    from_header: mail.from_email ?? mail.sender,
    to_email: "agent@acme.primitive.email",
    subject: mail.subject,
    body_text: mail.body_text ?? null,
    body_html: mail.body_html ?? null,
    thread_id: mail.thread_id ?? null,
    reply_to_sent_email_id: mail.reply_to_sent_email_id ?? null,
    received_at: mail.created_at ?? LONG_AGO,
    created_at: mail.created_at ?? LONG_AGO,
    parsed: { status: "complete", attachments: [] },
  };
}

/**
 * A fake inbox: `existing` mail is there before the wait starts, `arriving`
 * mail is returned by the first tail long-poll.
 */
function fakeInbox(existing: FakeMail[], arriving: FakeMail[]) {
  const all = new Map(
    [...existing, ...arriving].map((mail) => [mail.id, detail(mail)]),
  );
  let delivered = false;
  mocks.listEmails.mockImplementation(
    async ({ query }: { query: Record<string, unknown> }) => {
      if (query.since === undefined) {
        const newestFirst = [...existing].reverse().map(detail);
        return {
          data: {
            data: newestFirst.slice(0, Number(query.limit)),
            meta: { cursor: null },
          },
        };
      }
      if (!delivered && arriving.length > 0) {
        delivered = true;
        return {
          data: { data: arriving.map(detail), meta: { cursor: "c|next" } },
        };
      }
      return { data: { data: [], meta: { cursor: null } } };
    },
  );
  mocks.getEmail.mockImplementation(
    async ({ path }: { path: { id: string } }) => {
      const found = all.get(path.id);
      return found
        ? { data: { data: found } }
        : { error: { error: { code: "not_found", message: "gone" } } };
    },
  );
}

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runWait(argv: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdout.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
  try {
    await (WaitCommand as unknown as Runnable).run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdout.join(""),
      stderr: stderr.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

const oldCode: FakeMail = {
  id: "old-1",
  sender: "noreply@github.com",
  subject: "[GitHub] Please verify your device",
  body_text: "Verification code: 111111",
};
const newsletter: FakeMail = {
  id: "news-1",
  sender: "news@example.com",
  subject: "Weekly digest",
  body_text: "Your verification code is 999999 (not really)",
};
const githubCode: FakeMail = {
  id: "gh-2",
  sender: "bounces+123@em.github.com",
  from_email: "noreply@github.com",
  subject: "[GitHub] Please verify your device",
  body_text:
    "Device: Chrome\nVerification code: 482913\n\nThanks, The GitHub Team",
};

describe("primitive wait helpers", () => {
  it("is registered as a top-level command", () => {
    expect(COMMANDS.wait).toBe(WaitCommand);
  });

  it.each([
    ["300", 300],
    ["90s", 90],
    ["5m", 300],
    ["1h", 3600],
    ["1m30s", 90],
    ["0", 0],
  ])("parses --timeout %s", (value, seconds) => {
    expect(parseWaitDuration(value)).toBe(seconds);
  });

  it.each(["", "5 minutes", "-1", "1d", "m"])(
    "rejects --timeout %j",
    (value) => {
      expect(() => parseWaitDuration(value)).toThrow(/--timeout/);
    },
  );

  it("matches a bare domain against the domain and its subdomains only", () => {
    expect(senderMatches("github.com", ["noreply@github.com"])).toBe(true);
    expect(senderMatches("github.com", ["x@em.github.com"])).toBe(true);
    expect(senderMatches("@github.com", ["x@github.com"])).toBe(true);
    expect(senderMatches("github.com", ["x@notgithub.com"])).toBe(false);
    expect(senderMatches("github.com", ["x@github.com.evil.io"])).toBe(false);
  });

  it("matches an address exactly, ignoring case", () => {
    expect(senderMatches("NoReply@GitHub.com", ["noreply@github.com"])).toBe(
      true,
    );
    expect(senderMatches("noreply@github.com", ["other@github.com"])).toBe(
      false,
    );
  });

  it("checks --reply-to and --thread on the email detail", () => {
    const email = detail({
      ...githubCode,
      thread_id: "t-1",
      reply_to_sent_email_id: "SENT-1",
    }) as unknown as Parameters<typeof detailMatches>[0];
    expect(detailMatches(email, { replyTo: "sent-1", thread: "t-1" })).toBe(
      true,
    );
    expect(detailMatches(email, { replyTo: "sent-2" })).toBe(false);
    expect(detailMatches(email, { thread: "t-2" })).toBe(false);
  });

  it("never returns an email it was told to skip, such as the profile's setup challenge", async () => {
    const setupChallenge = {
      ...githubCode,
      id: "setup-1",
      sender: "owner@github.com",
      from_email: "owner@github.com",
      subject: "Connect your agent to Primitive",
      body_text: "Reply to finish connecting this agent.",
    };
    fakeInbox([], [setupChallenge, githubCode]);
    const found = await waitForEmail({
      apiClient: { client: {} } as never,
      filters: { from: "github.com" },
      includeExisting: false,
      deadline: Date.now() + 5_000,
      startedAt: Date.now(),
      skipIds: ["setup-1"],
    });
    expect(found?.id).toBe("gh-2");
  });

  it("returns null at the deadline without matching existing mail", async () => {
    fakeInbox([oldCode], []);
    const found = await waitForEmail({
      apiClient: { client: {} } as never,
      filters: { from: "github.com" },
      includeExisting: false,
      deadline: Date.now() - 1,
      startedAt: Date.now(),
    });
    expect(found).toBeNull();
  });
});

describe("primitive wait command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: { kind: "api-key", source: "flag" },
      baseUrlOverridden: false,
    });
  });

  it("prints only the code of the first new email from the domain", async () => {
    fakeInbox([oldCode], [newsletter, githubCode]);
    const result = await runWait(["--from", "github.com", "--code"]);
    expect(result.exitCode ?? 0).toBe(WAIT_EXIT_CODES.found);
    expect(result.stdout).toBe("482913\n");
    // Existing mail is not read without --include-existing.
    expect(mocks.getEmail).not.toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: "old-1" } }),
    );
  });

  it("long-polls the forward tail from the newest email's position", async () => {
    fakeInbox([oldCode], [githubCode]);
    await runWait(["--code"]);
    const tail = mocks.listEmails.mock.calls
      .map(([arg]) => arg.query)
      .find((query) => query.since !== undefined);
    expect(tail.since).toBe(`${LONG_AGO}|old-1`);
    expect(tail.wait).toBeGreaterThan(0);
    expect(tail.wait).toBeLessThanOrEqual(30);
  });

  it("matches mail that arrived while the command was starting", async () => {
    // Already at or before the baseline, but received after the command
    // started: the tail alone would skip it.
    // Stamped a moment after the command starts, as if it landed during
    // authentication.
    const duringStartup = new Date(Date.now() + 500).toISOString();
    fakeInbox([oldCode, { ...githubCode, created_at: duringStartup }], []);
    const result = await runWait([
      "--from",
      "github.com",
      "--code",
      "--timeout",
      "1",
    ]);
    expect(result.stdout).toBe("482913\n");
  });

  it("does not take mail from just before the start without --include-existing", async () => {
    const justBefore = new Date(Date.now() - 1000).toISOString();
    fakeInbox([{ ...githubCode, created_at: justBefore }], []);
    const result = await runWait([
      "--from",
      "github.com",
      "--code",
      "--timeout",
      "1",
    ]);
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
  });

  it("matches existing mail with --include-existing", async () => {
    fakeInbox([newsletter, oldCode], []);
    const result = await runWait([
      "--from",
      "github.com",
      "--code",
      "--include-existing",
      "--timeout",
      "1",
    ]);
    expect(result.stdout).toBe("111111\n");
  });

  it("prints a readable email with its ID and the reply command by default", async () => {
    fakeInbox([], [githubCode]);
    const result = await runWait(["--subject", "verify your device"]);
    expect(result.stdout).toContain("From: noreply@github.com");
    expect(result.stdout).toContain(
      "Subject: [GitHub] Please verify your device",
    );
    expect(result.stdout).toContain("ID: gh-2");
    expect(result.stdout).toContain("Verification code: 482913");
    expect(result.stdout).toContain("reply --id gh-2");
  });

  it("prints one JSON object with the code and link fields asked for", async () => {
    fakeInbox([], [githubCode]);
    const result = await runWait(["--code", "--link", "--json"]);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toMatchObject({
      id: "gh-2",
      from: "noreply@github.com",
      subject: "[GitHub] Please verify your device",
      received_at: LONG_AGO,
      code: "482913",
      link: null,
    });
    expect(parsed.text).toContain("482913");
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.notFound);
  });

  it("exits 6 with the email ID when the email has no code", async () => {
    fakeInbox([], [newsletter]);
    const result = await runWait(["--from", "example.com", "--link"]);
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.notFound);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "No verification link found in email news-1",
    );
  });

  it("exits 5 with one line when nothing matches before the timeout", async () => {
    fakeInbox([], [newsletter]);
    const result = await runWait(["--from", "github.com", "--timeout", "1s"]);
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim().split("\n")).toEqual([
      "Timed out after 1s with no matching email from github.com.",
    ]);
  });

  it("rejects a malformed --timeout as invalid flags", async () => {
    await expect(runWait(["--timeout", "soon"])).rejects.toMatchObject({
      oclif: { exit: 2 },
    });
  });
});
