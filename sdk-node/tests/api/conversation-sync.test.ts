import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { normalizeConversationTimestamp } from "../../src/api/conversation-sync.js";
import {
  type ConversationMessage,
  type ConversationSyncState,
  MAX_CONVERSATION_SYNC_PAGES,
  mergeConversationMessages,
  PrimitiveApiError,
  PrimitiveClient,
  runConversationSync,
  syncConversation,
} from "../../src/api/index.js";

const key = ["fixture", "credential"].join("-");
const EMAIL_ID = "a1a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1";

type ExpectedMessage = { id: string; copy_ids: string[]; status?: string };
type SyncCase = {
  name: string;
  state: ConversationSyncState | null;
  pages: { since: string; response: unknown }[];
  expected: { error: true } | { cursor: string; messages: ExpectedMessage[] };
};

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/conversation-sync.json", import.meta.url),
    "utf8",
  ),
) as {
  cases: SyncCase[];
  timestamps: { input: string; normalized: string | null; ms: number | null }[];
};

function summarize(messages: ConversationMessage[]): ExpectedMessage[] {
  return messages.map((message) => ({
    id: message.id,
    copy_ids: (message.copies ?? []).map((copy) => copy.id),
    ...(message.status !== undefined ? { status: message.status } : {}),
  }));
}

function strip(expected: ExpectedMessage[], actual: ExpectedMessage[]) {
  // A fixture names a status only where it pins one.
  return actual.map((message, index) =>
    expected[index]?.status === undefined
      ? { id: message.id, copy_ids: message.copy_ids }
      : message,
  );
}

describe("syncConversation shared fixtures", () => {
  for (const testCase of fixture.cases) {
    it(testCase.name, async () => {
      const urls: URL[] = [];
      const fetcher = vi.fn<typeof fetch>(async (input) => {
        urls.push(new URL((input as Request).url));
        const page = testCase.pages[urls.length - 1];
        if (!page) throw new Error("read past the last fixture page");
        return Response.json(page.response);
      });
      const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
      const run = syncConversation(
        client,
        EMAIL_ID,
        testCase.state ?? undefined,
      );

      if ("error" in testCase.expected) {
        await expect(run).rejects.toBeInstanceOf(PrimitiveApiError);
      } else {
        const result = await run;
        expect(result.cursor).toBe(testCase.expected.cursor);
        expect(
          strip(testCase.expected.messages, summarize(result.messages)),
        ).toEqual(testCase.expected.messages);
      }

      expect(urls.map((url) => url.searchParams.get("since"))).toEqual(
        testCase.pages.map((page) => page.since),
      );
      for (const url of urls) {
        expect(url.pathname).toMatch(
          new RegExp(`/emails/${EMAIL_ID}/conversation$`),
        );
      }
    });
  }
});

describe("mergeConversationMessages", () => {
  it("does not modify its inputs", () => {
    const testCase = fixture.cases[1];
    const held = structuredClone(testCase.state?.messages ?? []);
    const delta = structuredClone(
      (
        testCase.pages[0].response as {
          data: { messages: ConversationMessage[] };
        }
      ).data.messages,
    );
    const heldBefore = structuredClone(held);
    const deltaBefore = structuredClone(delta);
    const merged = mergeConversationMessages(held, delta);
    expect(merged.map((message) => message.id)).not.toEqual(
      held.map((message) => message.id),
    );
    expect(held).toEqual(heldBefore);
    expect(delta).toEqual(deltaBefore);
  });

  it("returns the sync result usable as the next state", async () => {
    const first = fixture.cases[3];
    let reads = 0;
    const fetcher = vi.fn<typeof fetch>(async () => {
      const page = first.pages[reads];
      reads += 1;
      return Response.json(page.response);
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const result = await syncConversation(client, EMAIL_ID);
    expect(result.threadId).toBe("0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c");
    expect(result.subject).toBe("Invoice");
    expect(result.messageCount).toBe(3);
    expect(result.truncated).toBe(false);
    const state: ConversationSyncState = result;
    expect(state.cursor).toBe("page-3");
  });
});

describe("conversation timestamps", () => {
  for (const entry of fixture.timestamps) {
    it(`normalizes ${JSON.stringify(entry.input)}`, () => {
      const normalized = normalizeConversationTimestamp(entry.input);
      expect(normalized).toBe(entry.normalized);
    });
  }

  it("sorts by the fixture's epoch milliseconds", () => {
    // Every valid entry, one message each, in reverse fixture order: the merge
    // must order them by `ms`, ties by arrival.
    const valid = fixture.timestamps.filter((entry) => entry.ms !== null);
    const messages = valid
      .map((entry, index) => ({
        role: "user" as const,
        direction: "inbound" as const,
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        text: "x",
        timestamp: entry.normalized,
      }))
      .reverse();
    const merged = mergeConversationMessages([], messages);
    const expected = messages
      .map((message, arrival) => ({
        message,
        arrival,
        ms: valid[valid.length - 1 - arrival]?.ms ?? 0,
      }))
      .sort((a, b) => a.ms - b.ms || a.arrival - b.arrival)
      .map(({ message }) => message.id);
    expect(merged.map((message) => message.id)).toEqual(expected);
  });
});

describe("conversation sync page limit", () => {
  it(`stops with an error after ${MAX_CONVERSATION_SYNC_PAGES} pages`, async () => {
    let reads = 0;
    const run = runConversationSync(async () => {
      reads += 1;
      return {
        thread_id: null,
        messages: [],
        cursor: `cursor-${reads}`,
        has_more: true,
      };
    });
    await expect(run).rejects.toBeInstanceOf(PrimitiveApiError);
    expect(reads).toBe(MAX_CONVERSATION_SYNC_PAGES);
  });
});
