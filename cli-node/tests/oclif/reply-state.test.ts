import { describe, expect, it } from "vitest";
import {
  AWAITING_REJECTED_UNSUPPORTED_CODE,
  AwaitingIncludesRejectedError,
  assertAwaitingFilterRows,
  assertReplyState,
  formatAwaitingCell,
  formatRepliesCell,
  hasReplyState,
  isAwaitingRejectedError,
  queryUsesAwaiting,
  REPLY_STATE_UNSUPPORTED_CODE,
  ReplyStateUnsupportedError,
  replyStateSurfaceForOperation,
} from "../../src/oclif/reply-state.js";

const WITH_STATE = { awaiting: "you", reply_count: 0, last_replied_at: null };

describe("hasReplyState", () => {
  it("accepts rows carrying all three fields", () => {
    expect(hasReplyState(WITH_STATE)).toBe(true);
    expect(
      hasReplyState({
        awaiting: "them",
        reply_count: 2,
        last_replied_at: "2026-09-25T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("rejects rows from a server without reply state", () => {
    expect(hasReplyState({ id: "x" })).toBe(false);
    expect(hasReplyState({ ...WITH_STATE, awaiting: undefined })).toBe(false);
    expect(hasReplyState({ ...WITH_STATE, awaiting: "maybe" })).toBe(false);
    expect(hasReplyState({ ...WITH_STATE, reply_count: "1" })).toBe(false);
    expect(hasReplyState({ awaiting: "you", reply_count: 0 })).toBe(false);
    expect(hasReplyState(null)).toBe(false);
    expect(hasReplyState("row")).toBe(false);
  });
});

describe("assertReplyState", () => {
  it("passes an empty page and complete rows", () => {
    expect(() => assertReplyState([], "GET /emails")).not.toThrow();
    expect(() =>
      assertReplyState([WITH_STATE, WITH_STATE], "GET /emails"),
    ).not.toThrow();
  });

  it("throws a reply-state error naming the surface and the count", () => {
    let caught: unknown;
    try {
      assertReplyState([WITH_STATE, { id: "old" }], "GET /emails/search");
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ReplyStateUnsupportedError);
    const error = caught as ReplyStateUnsupportedError;
    expect(error.code).toBe(REPLY_STATE_UNSUPPORTED_CODE);
    expect(error.message).toContain(
      "The server does not support reply state yet",
    );
    expect(error.message).toContain("GET /emails/search returned 1 of 2");
    expect(error.message).toContain("Nothing was treated as awaiting");
  });
});

describe("isAwaitingRejectedError", () => {
  it("recognises strict query validation rejecting awaiting", () => {
    expect(
      isAwaitingRejectedError({
        success: false,
        error: {
          code: "validation_error",
          message: "Unrecognized key(s) in object: 'awaiting'",
        },
      }),
    ).toBe(true);
    expect(
      isAwaitingRejectedError({
        code: "validation_error",
        message:
          'Unknown field "awaiting". Known fields: from, to, subject, body.',
      }),
    ).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(
      isAwaitingRejectedError({
        error: { code: "validation_error", message: "limit too large" },
      }),
    ).toBe(false);
    expect(
      isAwaitingRejectedError({
        error: { code: "unauthorized", message: "unknown awaiting key" },
      }),
    ).toBe(false);
    expect(isAwaitingRejectedError(null)).toBe(false);
    expect(isAwaitingRejectedError(new Error("x"))).toBe(false);
  });
});

describe("queryUsesAwaiting", () => {
  it("detects the DSL term", () => {
    expect(queryUsesAwaiting("awaiting:you")).toBe(true);
    expect(queryUsesAwaiting("invoice awaiting:them")).toBe(true);
    expect(queryUsesAwaiting("invoice -awaiting:them")).toBe(true);
  });

  it("does not match plain words", () => {
    expect(queryUsesAwaiting("awaiting your answer")).toBe(false);
    expect(queryUsesAwaiting("notawaiting:you")).toBe(false);
    expect(queryUsesAwaiting(undefined)).toBe(false);
  });
});

describe("replyStateSurfaceForOperation", () => {
  it("returns the surface when list or search asks for reply state", () => {
    expect(
      replyStateSurfaceForOperation("listEmails", { awaiting: "you" }),
    ).toBe("GET /emails");
    expect(
      replyStateSurfaceForOperation("searchEmails", { q: "awaiting:you" }),
    ).toBe("GET /emails/search");
  });

  it("returns null otherwise", () => {
    expect(replyStateSurfaceForOperation("listEmails", { limit: 5 })).toBe(
      null,
    );
    expect(
      replyStateSurfaceForOperation("listDomains", { awaiting: "you" }),
    ).toBe(null);
    expect(replyStateSurfaceForOperation("listEmails", undefined)).toBe(null);
  });
});

describe("table cells", () => {
  it("renders state or a dash", () => {
    expect(formatAwaitingCell(WITH_STATE)).toBe("you");
    expect(formatRepliesCell({ ...WITH_STATE, reply_count: 3 })).toBe("3");
    expect(formatAwaitingCell({})).toBe("-");
    expect(formatRepliesCell({})).toBe("-");
  });
});

describe("assertAwaitingFilterRows", () => {
  it("passes delivered rows with reply state", () => {
    expect(() =>
      assertAwaitingFilterRows(
        [{ ...WITH_STATE, status: "completed" }, WITH_STATE],
        "GET /emails",
      ),
    ).not.toThrow();
  });

  it("refuses a rejected row returned by the awaiting filter", () => {
    try {
      assertAwaitingFilterRows(
        [{ ...WITH_STATE, status: "rejected" }],
        "GET /emails",
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(AwaitingIncludesRejectedError);
      expect(error).toBeInstanceOf(ReplyStateUnsupportedError);
      expect((error as AwaitingIncludesRejectedError).code).toBe(
        AWAITING_REJECTED_UNSUPPORTED_CODE,
      );
      expect((error as Error).message).toContain(
        "GET /emails returned 1 email with status `rejected`",
      );
    }
  });

  it("still requires reply state first", () => {
    expect(() =>
      assertAwaitingFilterRows([{ id: "x" }], "GET /emails"),
    ).toThrow(/does not support reply state yet/);
  });
});
