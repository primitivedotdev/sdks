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
  cursorBefore,
  detailMatches,
  parseWaitDuration,
  senderMatches,
  tailCursorAt,
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
  /**
   * When the email became visible, which the API stamps when it accepts the
   * email, so after created_at. The forward tail orders and cursors on it;
   * list rows do not carry it. Defaults to created_at.
   */
  visible_at?: string;
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

/** A tail cursor with its time at microseconds, so cursors compare as text. */
function tailKey(at: string, id: string): string {
  return `${at.replace(/(\.\d{3})Z$/, "$1000Z")}|${id}`;
}

/**
 * A fake inbox with the API's two orders: a list without `since` is newest
 * first by created_at; the forward tail (`since`) is oldest first by when
 * each email became visible, and its cursor is that time and the id.
 * `existing` mail is visible before the wait starts. `acceptedAfterStart`
 * mail was inserted before the start (its created_at is older) but becomes
 * visible just after the first read, as an email does when it is accepted
 * while the command starts. `arriving` mail lands during the first
 * long-poll (a tail read with `wait`), after all of it.
 */
function fakeInbox(
  existing: FakeMail[],
  arriving: FakeMail[],
  options: { acceptedAfterStart?: FakeMail[] } = {},
) {
  const late = options.acceptedAfterStart ?? [];
  const everyone = [...existing, ...late, ...arriving];
  const all = new Map(everyone.map((mail) => [mail.id, detail(mail)]));
  const visible = new Map<string, string>(
    existing.map((mail) => [
      mail.id,
      tailKey(mail.visible_at ?? mail.created_at ?? LONG_AGO, mail.id),
    ]),
  );
  let reads = 0;
  let delivered = false;
  const tail = (since: string) =>
    everyone
      .filter((mail) => (visible.get(mail.id) ?? "") > since)
      .sort((a, b) =>
        (visible.get(a.id) ?? "").localeCompare(visible.get(b.id) ?? ""),
      );
  mocks.listEmails.mockImplementation(
    async ({ query }: { query: Record<string, unknown> }) => {
      reads += 1;
      if (reads === 2) {
        for (const mail of late) {
          visible.set(mail.id, tailKey(new Date().toISOString(), mail.id));
        }
      }
      const limit = Number(query.limit);
      if (query.since === undefined) {
        const newestFirst = [...existing, ...late]
          .filter((mail) => visible.has(mail.id))
          .sort((a, b) =>
            (b.created_at ?? LONG_AGO).localeCompare(a.created_at ?? LONG_AGO),
          )
          .map(detail);
        return {
          data: {
            data: newestFirst.slice(0, limit),
            meta: { cursor: null },
          },
        };
      }
      const since = String(query.since).replace(/(\.\d{3})Z\|/, "$1000Z|");
      let rows = tail(since);
      if (rows.length === 0 && Number(query.wait ?? 0) > 0 && !delivered) {
        delivered = true;
        // Stamped with the real time it lands, like the API's clock.
        arriving.forEach((mail, index) => {
          visible.set(
            mail.id,
            tailKey(new Date(Date.now() + index).toISOString(), mail.id),
          );
        });
        rows = tail(since);
      }
      const page = rows.slice(0, limit);
      const last = page.at(-1);
      return {
        data: {
          data: page.map(detail),
          meta: { cursor: last ? (visible.get(last.id) ?? null) : null },
        },
      };
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

  it("still returns new mail when the client clock runs ahead of the server", async () => {
    // The long-poll starts from the tail's own end, so only the check of
    // what became visible since the start depends on the client clock. New
    // mail is stamped with the server's (real) time, an hour before the
    // client's start time.
    fakeInbox([oldCode], [githubCode]);
    const found = await waitForEmail({
      apiClient: { client: {} } as never,
      filters: { from: "github.com" },
      includeExisting: false,
      deadline: Date.now() + 10_000,
      startedAt: Date.now() + 3_600_000,
    });
    expect(found?.id).toBe("gh-2");
  });

  it("counts mail made visible within a client clock lag, as the created_at check did", async () => {
    // With the client clock an hour behind, the start reads an hour back:
    // mail made visible in that hour counts as new. There is no allowance
    // past the start time itself.
    const halfHourAgo = new Date(Date.now() - 1_800_000).toISOString();
    fakeInbox(
      [{ ...githubCode, created_at: halfHourAgo, visible_at: halfHourAgo }],
      [],
    );
    const found = await waitForEmail({
      apiClient: { client: {} } as never,
      filters: { from: "github.com" },
      includeExisting: false,
      deadline: Date.now() + 1_000,
      startedAt: Date.now() - 3_600_000,
    });
    expect(found?.id).toBe("gh-2");
  });

  it("checks every email made visible since the start, past the first pages", async () => {
    // More than the pages read before the long-poll became visible between
    // the start and the baseline; the long-poll walks the rest.
    const start = Date.now();
    const unrelated: FakeMail[] = Array.from({ length: 600 }, (_, i) => {
      const at = new Date(start + 1 + i).toISOString();
      return {
        id: `n${String(i).padStart(3, "0")}`,
        sender: "news@example.com",
        subject: "Weekly digest",
        created_at: at,
      };
    });
    fakeInbox(
      [
        ...unrelated,
        { ...githubCode, created_at: new Date(start + 700).toISOString() },
      ],
      [],
    );
    const found = await waitForEmail({
      apiClient: { client: {} } as never,
      filters: { from: "github.com" },
      includeExisting: false,
      deadline: Date.now() + 5_000,
      startedAt: start,
    });
    expect(found?.id).toBe("gh-2");
  });

  it("orders cursors by time when one is at milliseconds", () => {
    expect(
      cursorBefore(
        "2026-11-11T13:00:00.123Z|b",
        "2026-11-11T13:00:00.123456Z|a",
      ),
    ).toBe(true);
    expect(
      cursorBefore(
        "2026-11-11T13:00:00.123456Z|a",
        "2026-11-11T13:00:00.123Z|b",
      ),
    ).toBe(false);
  });

  it("marks a start time on the tail at microseconds", () => {
    expect(tailCursorAt(Date.parse("2026-11-11T13:00:00.123Z"))).toBe(
      "2026-11-11T13:00:00.123000Z|00000000-0000-4000-8000-000000000000",
    );
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
      .find((query) => query.wait !== undefined);
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

  describe("when the newest email became visible after its created_at", () => {
    // As on the API: accept stamps visibility after the insert that sets
    // created_at, so the tail sorts the newest email after a cursor built
    // from its created_at.
    const visibleLater = (
      mail: FakeMail,
      created: string,
      visible: string,
    ) => ({
      ...mail,
      created_at: created,
      visible_at: visible,
    });
    const invoice: FakeMail = {
      id: "invoice-1",
      sender: "billing@vendor.example",
      subject: "Invoice 1042",
      body_text: "Amount due: 120.00",
    };

    it("does not hand it back as new mail", async () => {
      fakeInbox(
        [
          visibleLater(
            invoice,
            "2026-01-05T12:53:00.000Z",
            "2026-01-05T12:53:01.250731Z",
          ),
        ],
        [],
      );
      const result = await runWait(["--timeout", "1"]);
      expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
      expect(result.stdout).toBe("");
      expect(mocks.getEmail).not.toHaveBeenCalled();
    });

    it("does not hand it back when it became visible in the same millisecond", async () => {
      // The row's created_at is truncated to the millisecond; the tail
      // compares microseconds.
      fakeInbox(
        [
          visibleLater(
            invoice,
            "2026-01-05T12:53:00.123Z",
            "2026-01-05T12:53:00.123456Z",
          ),
        ],
        [],
      );
      const result = await runWait(["--timeout", "1"]);
      expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
      expect(mocks.getEmail).not.toHaveBeenCalled();
    });

    it("long-polls from the position the tail gives that email", async () => {
      fakeInbox(
        [
          visibleLater(
            oldCode,
            "2026-01-05T12:53:00.000Z",
            "2026-01-05T12:53:01.250731Z",
          ),
        ],
        [githubCode],
      );
      const result = await runWait(["--code"]);
      expect(result.stdout).toBe("482913\n");
      const longPoll = mocks.listEmails.mock.calls
        .map(([arg]) => arg.query)
        .find((query) => query.wait !== undefined);
      expect(longPoll.since).toBe("2026-01-05T12:53:01.250731Z|old-1");
    });

    it("skips an older email made visible after the newest one too", async () => {
      fakeInbox(
        [
          visibleLater(
            { ...invoice, id: "slow" },
            "2026-01-05T12:50:00.000Z",
            "2026-01-05T12:55:00.000000Z",
          ),
          visibleLater(
            invoice,
            "2026-01-05T12:53:00.000Z",
            "2026-01-05T12:53:01.000000Z",
          ),
        ],
        [],
      );
      const result = await runWait(["--timeout", "1"]);
      expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
      expect(mocks.getEmail).not.toHaveBeenCalled();
    });

    it("returns an email inserted before the start and accepted after it", async () => {
      // A sign-up code still being accepted when the wait starts: older by
      // created_at than the start, visible only after it.
      fakeInbox([oldCode], [], {
        acceptedAfterStart: [{ ...githubCode, created_at: LONG_AGO }],
      });
      const result = await runWait([
        "--from",
        "github.com",
        "--code",
        "--timeout",
        "1",
      ]);
      expect(result.stdout).toBe("482913\n");
    });

    it("still returns the newest existing email with --include-existing", async () => {
      fakeInbox(
        [
          visibleLater(
            newsletter,
            "2026-01-05T12:50:00.000Z",
            "2026-01-05T12:50:00.900000Z",
          ),
          visibleLater(
            oldCode,
            "2026-01-05T12:53:00.000Z",
            "2026-01-05T12:53:01.250731Z",
          ),
        ],
        [],
      );
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

describe("primitive wait with transient API failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAuthenticatedCliApiClient.mockResolvedValue({
      apiClient: { client: {} },
      auth: { kind: "api-key", source: "flag" },
      baseUrlOverridden: false,
    });
  });

  function failure(status: number, code: string, headers = {}) {
    return {
      error: { success: false, error: { code, message: `HTTP ${status}` } },
      response: new Response(null, { status, headers }),
    };
  }

  /** Answer the first tail long-polls with `responses`, then as the inbox. */
  function failTail(responses: Array<() => unknown>) {
    const inbox = mocks.listEmails.getMockImplementation();
    let served = 0;
    mocks.listEmails.mockImplementation(
      async (arg: { query: Record<string, unknown> }) =>
        arg.query.since !== undefined && served < responses.length
          ? responses[served++]()
          : inbox?.(arg),
    );
  }

  it("waits out a 429 with Retry-After and returns the code", async () => {
    fakeInbox([oldCode], [githubCode]);
    failTail([
      () => failure(429, "rate_limit_exceeded", { "Retry-After": "0" }),
    ]);
    const result = await runWait(["--from", "github.com", "--code"]);
    expect(result.exitCode ?? 0).toBe(WAIT_EXIT_CODES.found);
    expect(result.stdout).toBe("482913\n");
    expect(result.stderr).toContain(
      "primitive: rate limited; retrying in 0 s.",
    );
  });

  it("retries a network error on a detail read", async () => {
    fakeInbox([oldCode], [githubCode]);
    const inbox = mocks.getEmail.getMockImplementation();
    let failed = false;
    mocks.getEmail.mockImplementation(async (arg: { path: { id: string } }) => {
      if (failed) return inbox?.(arg);
      failed = true;
      return { error: new TypeError("fetch failed") };
    });
    const result = await runWait(["--from", "github.com", "--code"]);
    expect(result.stdout).toBe("482913\n");
    expect(result.stderr).toContain("primitive: network error; retrying in");
  });

  it("exits with the timeout code when the API stays unavailable", async () => {
    fakeInbox([oldCode], [githubCode]);
    failTail(
      Array.from(
        { length: 50 },
        () => () => failure(503, "service_unavailable"),
      ),
    );
    const result = await runWait(["--from", "github.com", "--timeout", "1"]);
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.timeout);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "primitive: API unavailable (HTTP 503); retrying in",
    );
    expect(result.stderr).toContain(
      "Timed out after 1 with no matching email from github.com.",
    );
  });

  it("still fails a 403 at once, with the API's error", async () => {
    fakeInbox([oldCode], [githubCode]);
    failTail([() => failure(403, "forbidden")]);
    const result = await runWait(["--from", "github.com"]);
    expect(result.exitCode).toBe(WAIT_EXIT_CODES.error);
    expect(result.stderr).toContain('"code": "forbidden"');
    expect(result.stderr).not.toContain("retrying");
  });
});
