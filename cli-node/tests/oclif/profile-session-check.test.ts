import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { sharedProfileWarning } from "../../src/oclif/profile-session-check.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const bound = "11111111-1111-4111-8111-111111111111";
const other = "99999999-9999-4999-8999-999999999999";
const agent = { profileName: "work", agentAddress: "agent@example.com" };
let configDir: string;

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-profile-session-"));
  saveConnectedAgentProfile(configDir, "work", {
    version: 1,
    auth_method: "agent_connection",
    api_key: ["pconn", "fixture", "check"].join("_"),
    api_base_url: "https://api.primitive-staging-1.com/v1",
    org_id: "33333333-3333-4333-8333-333333333333",
    agent_address: agent.agentAddress,
    owner_address: "owner@example.com",
    invitation_hash: "a".repeat(64),
    created_at: "2026-01-01T00:00:00.000Z",
  });
  writeMailJson(join(agentProfileDirectory(configDir, "work"), "setup.json"), {
    session: bound,
  });
});
afterEach(() => rmSync(configDir, { recursive: true, force: true }));

describe("shared profile warning", () => {
  it("is silent when the runtime session is the profile's own", () => {
    expect(
      sharedProfileWarning({
        configDir,
        connectedAgent: agent,
        env: { CLAUDE_CODE_SESSION_ID: bound.toUpperCase() },
      }),
    ).toBeNull();
  });

  it("names the other session and the sending address on a mismatch", () => {
    const expected =
      "This profile belongs to another session (11111111); sending as agent@example.com.";
    expect(
      sharedProfileWarning({
        configDir,
        connectedAgent: agent,
        env: { CLAUDE_CODE_SESSION_ID: other },
      }),
    ).toBe(expected);
    expect(
      sharedProfileWarning({
        configDir,
        connectedAgent: agent,
        env: { CODEX_THREAD_ID: other },
      }),
    ).toBe(expected);
  });

  it("is silent with no runtime session, no profile or no recorded session", () => {
    expect(
      sharedProfileWarning({ configDir, connectedAgent: agent, env: {} }),
    ).toBeNull();
    expect(
      sharedProfileWarning({
        configDir,
        env: { CLAUDE_CODE_SESSION_ID: other },
      }),
    ).toBeNull();
    expect(
      sharedProfileWarning({
        configDir,
        connectedAgent: { ...agent, profileName: "unset" },
        env: { CLAUDE_CODE_SESSION_ID: other },
      }),
    ).toBeNull();
  });
});
