import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import {
  addSessionReceiver,
  listSessionReceivers,
  pruneSessionReceivers,
  readSessionReceivers,
  removeSessionReceiver,
  sessionReceiversPath,
} from "../../src/oclif/claude-session-receivers.js";
import { saveConnectedAgentProfile } from "../../src/oclif/connected-agent-profile.js";

const sessionA = "11111111-1111-4111-8111-111111111111";
const sessionB = "22222222-2222-4222-8222-222222222222";
let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-session-receivers-"));
});
afterEach(() => rmSync(configDir, { recursive: true, force: true }));

function connect(profile: string, address: string) {
  saveConnectedAgentProfile(configDir, profile, {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", profile].join("_"),
    api_base_url: "https://api.primitive.dev/v1",
    org_id: "22222222-2222-4222-8222-222222222222",
    agent_address: address,
    owner_address: "owner@example.com",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
}

it("adds, updates and removes receivers per session", () => {
  expect(readSessionReceivers(configDir, sessionA)).toEqual([]);
  expect(
    addSessionReceiver(configDir, sessionA.toUpperCase(), {
      profile: "first",
      address: "First@Example.com",
    }),
  ).toBe(true);
  // The same receiver again changes nothing.
  expect(
    addSessionReceiver(configDir, sessionA, {
      profile: "first",
      address: "first@example.com",
    }),
  ).toBe(false);
  addSessionReceiver(configDir, sessionA, {
    profile: "second",
    address: "second@example.com",
  });
  // A profile's address follows its latest connection.
  addSessionReceiver(configDir, sessionA, {
    profile: "first",
    address: "renamed@example.com",
  });
  addSessionReceiver(configDir, sessionB, {
    profile: "first",
    address: "renamed@example.com",
  });
  expect(readSessionReceivers(configDir, sessionA)).toEqual([
    { profile: "second", address: "second@example.com" },
    { profile: "first", address: "renamed@example.com" },
  ]);
  expect([...listSessionReceivers(configDir).keys()]).toEqual([
    sessionA,
    sessionB,
  ]);
  expect(removeSessionReceiver(configDir, sessionA, "second")).toBe(true);
  expect(removeSessionReceiver(configDir, sessionA, "second")).toBe(false);
  expect(removeSessionReceiver(configDir, sessionA, "first")).toBe(true);
  // The last receiver removes the session's entry.
  expect(() => sessionReceiversPath(configDir, "not-a-session")).toThrow();
  expect([...listSessionReceivers(configDir).keys()]).toEqual([sessionB]);
});

it("prunes receivers whose profile is gone or now has another address", () => {
  connect("live", "live@example.com");
  connect("moved", "new@example.com");
  for (const [profile, address] of [
    ["live", "live@example.com"],
    ["moved", "old@example.com"],
    ["gone", "gone@example.com"],
  ] as const)
    addSessionReceiver(configDir, sessionA, { profile, address });
  expect(pruneSessionReceivers(configDir)).toBe(2);
  expect(readSessionReceivers(configDir, sessionA)).toEqual([
    { profile: "live", address: "live@example.com" },
  ]);
  expect(pruneSessionReceivers(configDir)).toBe(0);
});
