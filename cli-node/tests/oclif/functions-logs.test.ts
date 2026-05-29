import type { FunctionLogRow } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import FunctionsLogsCommand, {
  collectFreshFunctionLogsFromPage,
  filterNewFunctionLogs,
  formatFunctionLogLine,
  orderFunctionLogsForDisplay,
} from "../../src/oclif/commands/functions-logs.js";
import { COMMANDS } from "../../src/oclif/index.js";

function makeLog(overrides: Partial<FunctionLogRow> = {}): FunctionLogRow {
  return {
    function_id: "fn_123",
    id: "log_123",
    level: "log",
    message: "hello",
    metadata: null,
    ts: "2026-05-17T12:00:00.000Z",
    ...overrides,
  };
}

describe("functions logs command", () => {
  it("owns the canonical logs command without the raw generated duplicate", () => {
    expect(COMMANDS["functions:logs"]).toBe(FunctionsLogsCommand);
    expect(COMMANDS["functions:list-function-logs"]).toBeUndefined();
  });

  it("exposes pagination, follow, and JSONL flags", () => {
    expect(FunctionsLogsCommand.flags.limit).toBeDefined();
    expect(FunctionsLogsCommand.flags.cursor).toBeDefined();
    expect(FunctionsLogsCommand.flags.follow).toBeDefined();
    expect(FunctionsLogsCommand.flags.jsonl).toBeDefined();
  });

  it("formats a compact text row", () => {
    const row = makeLog({
      level: "warn",
      message: "slow handler",
      metadata: { elapsed_ms: 124 },
      ts: "2026-05-17T12:34:56.000Z",
    });

    expect(formatFunctionLogLine(row)).toBe(
      '2026-05-17T12:34:56.000Z WARN  slow handler {"elapsed_ms":124}',
    );
  });

  it("prints newest-first API pages in chronological display order", () => {
    const newest = makeLog({ id: "newest", ts: "2026-05-17T12:00:02.000Z" });
    const middle = makeLog({ id: "middle", ts: "2026-05-17T12:00:01.000Z" });
    const oldest = makeLog({ id: "oldest", ts: "2026-05-17T12:00:00.000Z" });

    expect(orderFunctionLogsForDisplay([newest, middle, oldest])).toEqual([
      oldest,
      middle,
      newest,
    ]);
  });

  it("filters already-seen follow rows while preserving chronological output", () => {
    const seenIds = new Set<string>(["already-seen"]);
    const newest = makeLog({ id: "newest", ts: "2026-05-17T12:00:02.000Z" });
    const older = makeLog({ id: "older", ts: "2026-05-17T12:00:01.000Z" });
    const seen = makeLog({
      id: "already-seen",
      ts: "2026-05-17T12:00:00.000Z",
    });

    expect(filterNewFunctionLogs([newest, older, seen], seenIds)).toEqual([
      older,
      newest,
    ]);
    expect(seenIds).toEqual(new Set(["already-seen", "newest", "older"]));
    expect(filterNewFunctionLogs([newest, older, seen], seenIds)).toEqual([]);
  });

  it("collects fresh follow rows and reports when a page reached known history", () => {
    const seenIds = new Set<string>(["seen"]);
    const newest = makeLog({ id: "newest", ts: "2026-05-17T12:00:03.000Z" });
    const newer = makeLog({ id: "newer", ts: "2026-05-17T12:00:02.000Z" });
    const seen = makeLog({ id: "seen", ts: "2026-05-17T12:00:01.000Z" });
    const olderButUnseen = makeLog({
      id: "older-but-unseen",
      ts: "2026-05-17T12:00:00.000Z",
    });

    expect(
      collectFreshFunctionLogsFromPage(
        [newest, newer, seen, olderButUnseen],
        seenIds,
      ),
    ).toEqual({
      freshNewestFirst: [newest, newer, olderButUnseen],
      reachedSeen: true,
    });
    expect(seenIds).toEqual(
      new Set(["seen", "newest", "newer", "older-but-unseen"]),
    );
  });
});
