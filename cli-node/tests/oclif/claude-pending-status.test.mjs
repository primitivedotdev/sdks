import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import {
  clearDeliveredStatus,
  formatPendingMail,
} from "../../bin/claude-pending-mail.mjs";

const roots = [];
afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

it("formats a status notice and clears it after delivery", () => {
  const root = mkdtempSync(join(tmpdir(), "primitive-pending-status-"));
  roots.push(root);
  const cli = join(root, "cli.mjs");
  const record = join(root, "args.json");
  writeFileSync(
    cli,
    'import {writeFileSync} from "node:fs"; writeFileSync(process.env.TEST_ARGS, JSON.stringify(process.argv.slice(2)));',
  );
  const notice = {
    kind: "status",
    emailId: "22222222-2222-4222-8222-222222222222",
    refSentEmailId: "33333333-3333-4333-8333-333333333333",
    sender: "peer@example.com",
  };
  expect(formatPendingMail(notice)).toContain("not a new task");
  const prior = process.env.TEST_ARGS;
  process.env.TEST_ARGS = record;
  try {
    clearDeliveredStatus(
      cli,
      root,
      "test-profile",
      "11111111-1111-4111-8111-111111111111",
      [notice],
    );
  } finally {
    if (prior === undefined) delete process.env.TEST_ARGS;
    else process.env.TEST_ARGS = prior;
  }
  expect(JSON.parse(readFileSync(record, "utf8"))).toEqual([
    "listen",
    "pending",
    "--session",
    "11111111-1111-4111-8111-111111111111",
    "--clear",
    notice.emailId,
  ]);
});
