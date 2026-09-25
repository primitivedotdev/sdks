import { describe, expect, it } from "vitest";
import {
  DEFINITIVE_SEND_REJECTION_STATUSES,
  formatPriorRepliesWarning,
  priorRepliesThatWentOut,
  SEND_OUTCOME_EXIT_CODES,
  SEND_OUTCOME_HELP,
  sendFailureOutcome,
  sentHistoryWindowStart,
  successfulSendOutcome,
} from "../../src/oclif/send-outcome.js";

describe("send outcome vocabulary", () => {
  it("maps each outcome to its exit code and leaves exit 2 to usage errors", () => {
    expect(SEND_OUTCOME_EXIT_CODES).toEqual({
      replied: 0,
      sent: 0,
      already_sent: 0,
      not_sent: 1,
      sent_awaiting_reply: 3,
      uncertain: 4,
    });
    expect(Object.values(SEND_OUTCOME_EXIT_CODES)).not.toContain(2);
  });

  it("documents every outcome and exit code in the help table", () => {
    for (const [outcome, code] of Object.entries(SEND_OUTCOME_EXIT_CODES)) {
      expect(SEND_OUTCOME_HELP).toContain(`- exit ${code} ${outcome}: `);
    }
  });

  it("treats only the definitive rejection statuses as not_sent", () => {
    for (const status of DEFINITIVE_SEND_REJECTION_STATUSES) {
      expect(sendFailureOutcome(status)).toBe("not_sent");
    }
    for (const status of [408, 409, 410, 500, 502, 503, 504, undefined]) {
      expect(sendFailureOutcome(status)).toBe("uncertain");
    }
  });

  it("classifies a successful response as sent or already_sent", () => {
    const base = {
      accepted: [],
      client_idempotency_key: "k",
      content_hash: "h",
      from: "a@example.com",
      id: "sent-1",
      queue_id: null,
      rejected: [],
      request_id: "r",
      status: "queued" as const,
    };
    expect(successfulSendOutcome({ ...base, idempotent_replay: false })).toBe(
      "sent",
    );
    expect(successfulSendOutcome({ ...base, idempotent_replay: true })).toBe(
      "already_sent",
    );
  });
});

describe("prior replies", () => {
  const reply = (id: string, status: string, created_at: string) => ({
    created_at,
    id,
    status: status as "delivered",
    to_address: "alice@example.com",
  });

  it("keeps only replies that went out and can exclude the caller's own send", () => {
    const replies = [
      reply("a", "gate_denied", "t1"),
      reply("b", "agent_failed", "t2"),
      reply("c", "canceled", "t3"),
      reply("d", "queued", "t4"),
      reply("e", "delivered", "t5"),
      reply("f", "scheduled", "t6"),
    ];
    expect(priorRepliesThatWentOut(replies).map((r) => r.id)).toEqual([
      "d",
      "e",
      "f",
    ]);
    expect(
      priorRepliesThatWentOut(replies, { excludeSentId: "e" }).map((r) => r.id),
    ).toEqual(["d", "f"]);
    expect(priorRepliesThatWentOut(undefined)).toEqual([]);
  });

  it("formats no warning when there is nothing to warn about", () => {
    expect(formatPriorRepliesWarning([])).toBeNull();
  });
});

describe("sent history window", () => {
  it("widens the window for clock skew", () => {
    expect(sentHistoryWindowStart("2026-09-25T12:00:00.000Z")).toBe(
      "2026-09-25T11:55:00.000Z",
    );
  });
});
