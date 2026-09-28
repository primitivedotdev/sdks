import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SendMailResult } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  beginChatReceipt,
  chatRequestHash,
  saveChatReceipt,
} from "../../src/oclif/chat-receipt.js";

let directory: string;
const sent: SendMailResult = {
  id: "sent-fixture",
  from: "owner@example.test",
  status: "queued",
  client_idempotency_key: "fixture",
  content_hash: "fixture",
  idempotent_replay: false,
  request_id: "fixture",
  accepted: [],
  rejected: [],
  queue_id: null,
};
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "chat-receipt-test-"));
});
afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe("chat send recovery", () => {
  it("records only private metadata before sending and refuses an ambiguous resend", () => {
    const hash = chatRequestHash({
      message: "private message",
      credential: "private credential",
    });
    const receipt = beginChatReceipt(directory, "parent", hash);
    const raw = readFileSync(receipt.path, "utf8");
    expect(raw).not.toContain("private message");
    expect(raw).not.toContain("private credential");
    expect(statSync(receipt.path).mode & 0o777).toBe(0o600);
    expect(() => beginChatReceipt(directory, "parent", hash)).toThrow(
      "uncertain outcome",
    );
  });

  it("persists a connected send key and resumes pre-send or uncertain intents without creating another key", () => {
    const receipt = beginChatReceipt(directory, "parent", "same", {
      connected: true,
    });
    expect(receipt.data.idempotency_key).toMatch(/^primitive-chat-/);
    expect(receipt.data.send_attempted).toBe(false);
    expect(
      beginChatReceipt(directory, "parent", "same", { connected: true }).data
        .idempotency_key,
    ).toBe(receipt.data.idempotency_key);
    receipt.data.send_attempted = true;
    saveChatReceipt(receipt);
    const unknown = beginChatReceipt(directory, "parent", "same", {
      connected: true,
    });
    expect(unknown.data.send_attempted).toBe(true);
    expect(unknown.data.sent).toBeNull();
    expect(unknown.data.idempotency_key).toBe(receipt.data.idempotency_key);
    expect(() =>
      beginChatReceipt(directory, "parent", "changed", { connected: true }),
    ).toThrow("unresolved send intent");
  });

  it("resumes an acknowledged send and keeps the original receive window", () => {
    const receipt = beginChatReceipt(directory, "parent", "same-request");
    receipt.data.sent = sent;
    saveChatReceipt(receipt);
    const resumed = beginChatReceipt(directory, "parent", "same-request");
    expect(resumed.data.sent).toEqual(sent);
    expect(resumed.data.sent_at).toBe(receipt.data.sent_at);
    expect(() =>
      beginChatReceipt(directory, "parent", "different-body"),
    ).toThrow("still awaits a response");
  });

  it("retains the exact reply finalization marker while its chat remains incomplete", () => {
    const receipt = beginChatReceipt(directory, "parent", "same-request", {
      connected: true,
    });
    receipt.data.sent = sent;
    receipt.data.reply = {
      emailId: "reply-fixture",
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    };
    saveChatReceipt(receipt);
    expect(
      beginChatReceipt(directory, "parent", "same-request", { connected: true })
        .data.reply,
    ).toEqual(receipt.data.reply);
    writeFileSync(
      receipt.path,
      JSON.stringify({
        ...receipt.data,
        reply: { emailId: "reply-fixture", requestId: [] },
      }),
    );
    expect(() =>
      beginChatReceipt(directory, "parent", "same-request", {
        connected: true,
      }),
    ).toThrow("Cannot safely read chat receipt");
  });
  it("does not reuse a completed conversation as a pending send", () => {
    const receipt = beginChatReceipt(directory, "parent", "same-request");
    receipt.data.sent = sent;
    receipt.data.completed = true;
    saveChatReceipt(receipt);
    expect(
      beginChatReceipt(directory, "parent", "new-request").data.sent,
    ).toBeNull();
  });

  it("keeps independent requests independent and refuses corrupt receipts", () => {
    const receipt = beginChatReceipt(directory, "first", "request");
    expect(beginChatReceipt(directory, "second", "other").path).not.toBe(
      receipt.path,
    );
    writeFileSync(receipt.path, "{}");
    expect(() => beginChatReceipt(directory, "first", "request")).toThrow(
      "Cannot safely read chat receipt",
    );
  });
});
