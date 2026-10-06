import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  agentProfileDirectory,
  saveConnectedAgentProfile,
} from "../../src/oclif/connected-agent-profile.js";
import { backgroundListenStatus } from "../../src/oclif/listen-background.js";
import { notificationScope } from "../../src/oclif/notify-session.js";
import { healSelectedReceiver } from "../../src/oclif/receiver-heal.js";
import { writeMailJson } from "../../src/oclif/shared-mail-files.js";

const session = "11111111-1111-4111-8111-111111111111";
const profile = {
  version: 1 as const,
  auth_method: "agent_connection" as const,
  api_key: ["pconn", "fixture", "heal"].join("_"),
  api_base_url: "https://api.primitive-staging-1.com/v1",
  org_id: "22222222-2222-4222-8222-222222222222",
  agent_address: "agent@example.test",
  owner_address: "owner@example.test",
  invitation_hash: "a".repeat(64),
  created_at: "2026-01-01T00:00:00.000Z",
};
const scope = notificationScope(profile.api_base_url, profile.api_key);

let configDir: string;
beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), "primitive-heal-test-"));
});
afterEach(() => {
  rmSync(configDir, { recursive: true, force: true });
});

function deadPid(): number {
  const result = spawnSync(process.execPath, ["-e", ""]);
  return result.pid as number;
}

function receiverDirectory(): string {
  const key = createHash("sha256")
    .update(JSON.stringify([scope, session]))
    .digest("hex");
  return join(configDir, "listen-background", key);
}

function connected(setup: Record<string, unknown> = {}) {
  saveConnectedAgentProfile(configDir, "work", profile);
  writeMailJson(join(agentProfileDirectory(configDir, "work"), "setup.json"), {
    version: 1,
    session,
    receiverMode: "native",
    invitationHash: profile.invitation_hash,
    since: "2026-01-01T00:00:00.000Z",
    contactRequests: true,
    challenge: null,
    phase: "sent",
    receipt: null,
    ...setup,
  });
}

/** A supervisor record left behind by a process that no longer exists. */
function receiver(
  phase: "running" | "stopped" | "failed",
  failureCode: string | null = null,
) {
  const token = randomUUID();
  const pid = deadPid();
  writeMailJson(join(receiverDirectory(), "supervisor.json"), {
    version: 1,
    token,
    pid,
    identity: `synthetic:${pid}`,
    phase,
    updatedAt: Date.now(),
    failureCode,
  });
}

function heal(env: NodeJS.ProcessEnv = {}, now?: number) {
  const spawnListener = vi.fn();
  const result = healSelectedReceiver({
    argv: ["emails", "latest"],
    env: {
      PRIMITIVE_AGENT_PROFILE: "work",
      CODEX_THREAD_ID: session,
      ...env,
    },
    configDir,
    entry: "/opt/primitive/bin/run.js",
    now,
    spawnListener,
  });
  return { result, spawnListener };
}

describe("restarting a dead receiver from the bound session", () => {
  it("restarts a receiver whose supervisor died with the saved configuration", () => {
    connected();
    receiver("running");
    expect(
      backgroundListenStatus({ configDir, scope, threadId: session }),
    ).toMatchObject({ reason: "exited", healthy: false });
    const { result, spawnListener } = heal();
    expect(result).toEqual({
      action: "restarting",
      profile: "work",
      session,
    });
    expect(spawnListener).toHaveBeenCalledOnce();
    const [argv, env] = spawnListener.mock.calls[0] ?? [];
    expect(argv).toEqual([
      "/opt/primitive/bin/run.js",
      "listen",
      "--background",
      "--notify-session",
      session,
      "--contacts",
      "--contact-requests",
    ]);
    expect(env).toMatchObject({
      PRIMITIVE_AGENT_PROFILE: "work",
      PRIMITIVE_CONFIG_DIR: configDir,
      PRIMITIVE_RECEIVER_HEAL: "0",
    });
    // The credential travels only through the saved profile, never argv.
    expect(JSON.stringify(argv)).not.toContain(profile.api_key);
  });

  it("omits contact requests when the saved setup did not enable them", () => {
    connected({ contactRequests: false });
    receiver("running");
    const { spawnListener } = heal();
    expect(spawnListener.mock.calls[0]?.[0]).not.toContain(
      "--contact-requests",
    );
  });

  it.each([
    "disk-full",
    "storage-unavailable",
    "crashed",
    "restart-budget-exhausted",
    "receiving-failed",
  ])("restarts a receiver that failed with %s", (code) => {
    connected();
    receiver("failed", code);
    expect(heal().result.action).toBe("restarting");
  });

  it.each(["notification-outcome-unknown", "connection-changed"])(
    "holds a receiver that failed with %s",
    (code) => {
      connected();
      receiver("failed", code);
      expect(heal().result).toEqual({
        action: "none",
        reason: "not_restartable",
      });
    },
  );

  it("never restarts a receiver that was stopped or never started", () => {
    connected();
    expect(heal().result).toMatchObject({ reason: "not_restartable" });
    receiver("stopped");
    expect(heal().result).toMatchObject({ reason: "not_restartable" });
  });

  it("acts only inside the exact session the profile is bound to", () => {
    connected();
    receiver("running");
    expect(heal({ CODEX_THREAD_ID: randomUUID() }).result).toMatchObject({
      reason: "other_session",
    });
    expect(heal({ CODEX_THREAD_ID: "" }).result).toMatchObject({
      reason: "other_session",
    });
    expect(
      heal({
        CODEX_THREAD_ID: "",
        CLAUDE_CODE_SESSION_ID: session,
      }).result.action,
    ).toBe("restarting");
  });

  it("restarts at most once per interval", () => {
    connected();
    receiver("running");
    const now = Date.now();
    expect(heal({}, now).result.action).toBe("restarting");
    expect(heal({}, now + 5_000).result).toMatchObject({
      reason: "recently_attempted",
    });
    expect(heal({}, now + 61_000).result.action).toBe("restarting");
  });

  it("stays out of the way of receivers, stops, opt-outs and other profiles", () => {
    connected();
    receiver("running");
    expect(heal({ PRIMITIVE_RECEIVER_HEAL: "0" }).result).toMatchObject({
      reason: "disabled",
    });
    expect(
      heal({ PRIMITIVE_LISTEN_BACKGROUND_TOKEN: randomUUID() }).result,
    ).toMatchObject({ reason: "receiver_process" });
    expect(heal({ PRIMITIVE_AGENT_PROFILE: "" }).result).toMatchObject({
      reason: "no_profile",
    });
    expect(
      healSelectedReceiver({
        argv: ["agent", "disconnect", "--profile", "work"],
        env: { PRIMITIVE_AGENT_PROFILE: "work", CODEX_THREAD_ID: session },
        configDir,
        entry: "/opt/primitive/bin/run.js",
        spawnListener: vi.fn(),
      }),
    ).toMatchObject({ reason: "stopping" });
    expect(
      healSelectedReceiver({
        argv: ["listen", "--stop", "--notify-session", session],
        env: { PRIMITIVE_AGENT_PROFILE: "work", CODEX_THREAD_ID: session },
        configDir,
        entry: "/opt/primitive/bin/run.js",
        spawnListener: vi.fn(),
      }),
    ).toMatchObject({ reason: "stopping" });
  });

  it("leaves external receivers and unfinished setups alone", () => {
    connected({ receiverMode: "external" });
    receiver("running");
    expect(heal().result).toMatchObject({ reason: "not_native_receiver" });
    connected({ phase: "waiting" });
    expect(heal().result).toMatchObject({ reason: "not_native_receiver" });
  });
});
