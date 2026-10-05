import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { operationManifest } from "@primitivedotdev/api-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOperationCommand } from "../../src/oclif/api-command.js";
import {
  acquireCliCredentialsLock,
  deleteCliCredentials,
  saveSignupCredentials,
} from "../../src/oclif/auth.js";
import {
  chatStatePath,
  deleteChatState,
  loadActiveChatState,
  saveActiveChatState,
} from "../../src/oclif/chat-state.js";
import {
  runForceLogout,
  runLogoutWithCredentialLock,
} from "../../src/oclif/commands/logout.js";

const conversation = (recipient: string) => ({
  from: "agent@example.test",
  recipient,
  last_reply_email_id: "reply",
  last_sent_email_id: "sent",
  last_reply_received_at: "2026-01-01T00:00:00.000Z",
  strict_only: false,
  strict_phase_seconds: 2,
  thread_id: null,
  timeout_seconds: 30,
});

describe("connected-agent profile state isolation", () => {
  let configDir: string;
  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "agent-profile-state-"));
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "");
  });
  afterEach(() => {
    rmSync(configDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("keeps active conversations independent across two profiles and the default login", () => {
    saveActiveChatState(configDir, conversation("default@example.test"));
    expect(chatStatePath(configDir)).toBe(join(configDir, "chat-state.json"));
    for (const profile of ["work", "personal"]) {
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", profile);
      expect(loadActiveChatState(configDir)).toBeNull();
      expect(
        saveActiveChatState(configDir, conversation(`${profile}@example.test`))
          .local_id,
      ).toBe(0);
    }
    for (const profile of ["work", "personal", ""]) {
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", profile);
      expect(loadActiveChatState(configDir)?.recipient).toBe(
        `${profile || "default"}@example.test`,
      );
    }
  });

  it("OAuth state cleanup leaves profile conversations untouched", () => {
    saveActiveChatState(configDir, conversation("default@example.test"));
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
    saveActiveChatState(configDir, conversation("work@example.test"));
    deleteChatState(configDir);
    expect(existsSync(chatStatePath(configDir, null))).toBe(false);
    expect(loadActiveChatState(configDir)?.recipient).toBe("work@example.test");
  });

  it("rejects path traversal in a selected profile", () => {
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "../outside");
    expect(() =>
      saveActiveChatState(configDir, conversation("work@example.test")),
    ).toThrow("Agent profile");
  });

  it.each([
    "startAgentSignup",
    "verifyAgentSignup",
    "resendAgentSignupVerification",
  ] as const)(
    "blocks generated %s before authentication or dispatch",
    async (operationName) => {
      vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
      const operation = operationManifest.find(
        (item) => item.operationId === operationName,
      );
      if (!operation) throw new Error("Missing operation");
      const Command = createOperationCommand(operation);
      const command = Object.create(Command.prototype) as InstanceType<
        typeof Command
      >;
      Object.assign(command, { parse: async () => ({ flags: {} }) });
      await expect(command.run()).rejects.toThrow(
        "Unset PRIMITIVE_AGENT_PROFILE",
      );
    },
  );

  it("selected profile cannot revoke, remove, lock or replace the default login", async () => {
    const path = join(configDir, "credentials.json");
    writeFileSync(path, "preserve existing login");
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", "work");
    const hint = "Unset PRIMITIVE_AGENT_PROFILE";
    expect(() => acquireCliCredentialsLock(configDir)).toThrow(hint);
    expect(() => runForceLogout({ configDir })).toThrow(hint);
    await expect(
      runLogoutWithCredentialLock({ configDir, flags: {} }),
    ).rejects.toThrow(hint);
    expect(() => deleteCliCredentials(configDir)).toThrow(hint);
    expect(() =>
      saveSignupCredentials({
        configDir,
        apiBaseUrl: "https://api.primitive.dev/v1",
        signup: {} as Parameters<typeof saveSignupCredentials>[0]["signup"],
      }),
    ).toThrow(hint);
    expect(readFileSync(path, "utf8")).toBe("preserve existing login");
    expect(existsSync(join(configDir, "credentials.lock"))).toBe(false);
  });
});
