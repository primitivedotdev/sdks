import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { saveConnectedAgentProfile } from "../../src/oclif/connected-agent-profile.js";
import {
  PENDING_NOT_FOUND_LIMIT,
  pendingMailProfiles,
  readPendingMail,
  recordPendingMail,
  recordPendingNotFoundRead,
} from "../../src/oclif/pending-mail.js";
import { explainPendingMailNotFound } from "../../src/oclif/pending-mail-miss.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const emailId = "22222222-2222-4222-8222-222222222222";
const otherEmail = "33333333-3333-4333-8333-333333333333";
const envKeys = [
  "PRIMITIVE_AGENT_PROFILE",
  "PRIMITIVE_API_KEY",
  "PRIMITIVE_KEY",
  "CLAUDE_CODE_SESSION_ID",
  "CODEX_THREAD_ID",
  "CODEX_SESSION_ID",
] as const;
const saved: Partial<Record<(typeof envKeys)[number], string>> = {};

let configDir: string;

function connect(name: string, address: string) {
  saveConnectedAgentProfile(configDir, name, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", name].join("_"),
    api_base_url: "https://api.primitive-staging-1.com/v1",
    org_id: "44444444-4444-4444-8444-444444444444",
    agent_address: address,
    owner_address: "owner@example.test",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

function notice(id: string) {
  return {
    kind: "mail" as const,
    email_id: id,
    received_at: "2026-10-01T00:00:00.000Z",
    sender: "peer@example.test",
    thread_id: null,
    in_thread: false,
    newer: null,
  };
}

async function explain(id = emailId): Promise<string> {
  const lines: string[] = [];
  await explainPendingMailNotFound(configDir, id, (line) => lines.push(line));
  return lines.join("");
}

beforeEach(() => {
  for (const key of envKeys) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  configDir = mkdtempSync(join(tmpdir(), "primitive-pending-miss-"));
  connect("named", "named@example.test");
  connect(`session-${session}`, "session-agent@example.test");
  process.env.CLAUDE_CODE_SESSION_ID = session;
});

afterEach(() => {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  rmSync(configDir, { recursive: true, force: true });
});

it("names the profile that holds the notice when another profile reads it", async () => {
  await recordPendingMail(
    configDir,
    `session-${session}`,
    session,
    notice(emailId),
  );
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(pendingMailProfiles(configDir, session, emailId)).toEqual([
    `session-${session}`,
  ]);
  expect(await explain()).toBe(
    `Email ${emailId} is a pending notice for profile session-${session} (session-agent@example.test), not the profile this command used. Read it with PRIMITIVE_AGENT_PROFILE=session-${session} primitive emails get --id ${emailId} --context.\n`,
  );
  // A miss under the wrong profile never counts against the real holder.
  for (let read = 0; read < PENDING_NOT_FOUND_LIMIT + 1; read += 1)
    await explain();
  expect(
    readPendingMail(configDir, `session-${session}`, session)[0],
  ).not.toHaveProperty("not_found_reads");
});

it("drops a notice its own profile cannot read after consecutive not_found reads", async () => {
  await recordPendingMail(configDir, "named", session, notice(emailId));
  await recordPendingMail(configDir, "named", session, notice(otherEmail));
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  for (let read = 1; read < PENDING_NOT_FOUND_LIMIT; read += 1) {
    expect(await explain()).toBe("");
    expect(
      readPendingMail(configDir, "named", session).find(
        (row) => row.email_id === emailId,
      )?.not_found_reads,
    ).toBe(read);
  }
  expect(await explain()).toBe(
    `Dropped the pending notice for ${emailId} from profile named after ${PENDING_NOT_FOUND_LIMIT} consecutive not_found reads; the email is no longer visible to this profile.\n`,
  );
  expect(
    readPendingMail(configDir, "named", session).map((row) => row.email_id),
  ).toEqual([otherEmail]);
});

it("resets the count when the listener records the notice again", async () => {
  await recordPendingMail(configDir, "named", session, notice(emailId));
  await recordPendingNotFoundRead(configDir, "named", session, emailId);
  await recordPendingMail(configDir, "named", session, notice(emailId));
  expect(readPendingMail(configDir, "named", session)[0]).not.toHaveProperty(
    "not_found_reads",
  );
});

it("names the session's other address for an email no notice covers", async () => {
  // The field case: the wake named the email but the agent read it under the
  // wrong one of the session's two profiles, and took not_found as proof the
  // email did not exist.
  await recordPendingMail(configDir, "named", session, notice(otherEmail));
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(await explain()).toBe(
    `Email ${emailId} was not found for named@example.test (profile named); an email is readable only under the profile that received it. This session also receives for: session-agent@example.test (profile session-${session}): PRIMITIVE_AGENT_PROFILE=session-${session} primitive emails get --id ${emailId} --context.\n`,
  );
});

it("names other saved connected profiles without a runtime session, and counts no miss", async () => {
  await recordPendingMail(configDir, "named", session, notice(emailId));
  delete process.env.CLAUDE_CODE_SESSION_ID;
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(await explain()).toBe(
    `Email ${emailId} was not found for named@example.test (profile named); an email is readable only under the profile that received it. Other connected profiles saved on this machine: session-agent@example.test (profile session-${session}): PRIMITIVE_AGENT_PROFILE=session-${session} primitive emails get --id ${emailId} --context.\n`,
  );
  expect(readPendingMail(configDir, "named", session)[0]).not.toHaveProperty(
    "not_found_reads",
  );
});

it("does not name profiles from outside the session inside a session", async () => {
  // Only `named` and an unrelated saved profile exist; neither the session's
  // own profile nor anything bound to it, so there is nothing to suggest.
  rmSync(
    join(configDir, "agent-connections", "profiles", `session-${session}`),
    {
      recursive: true,
      force: true,
    },
  );
  connect("unrelated", "unrelated@example.test");
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(await explain()).toBe("");
});

it("gives every session profile its own read command", async () => {
  connect(`session-${session}`, "session-agent@example.test");
  connect("second", "second@example.test");
  writeMailJson(
    join(configDir, "agent-connections", "profiles", "second", "setup.json"),
    { session },
  );
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  const hint = await explain();
  expect(hint).toContain(
    "second@example.test (profile second): PRIMITIVE_AGENT_PROFILE=second primitive emails get",
  );
  expect(hint).toContain(
    `session-agent@example.test (profile session-${session}): PRIMITIVE_AGENT_PROFILE=session-${session} primitive emails get`,
  );
});

it("stays silent when no other connected profile exists", async () => {
  rmSync(
    join(configDir, "agent-connections", "profiles", `session-${session}`),
    {
      recursive: true,
      force: true,
    },
  );
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(await explain()).toBe("");
});

it("stays silent when the read did not use a connected profile", async () => {
  expect(await explain()).toBe("");
});

it("never prints a saved credential in the hint", async () => {
  process.env.PRIMITIVE_AGENT_PROFILE = "named";
  expect(await explain()).not.toContain("pconn_");
});
