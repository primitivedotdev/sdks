import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { agentProfilesDirectory } from "../../src/oclif/connected-agent-profile.js";
import { acquireListenLock } from "../../src/oclif/listen-state.js";
import {
  appendRegistrationLog,
  ENROLLMENT_LOCK_SCOPE,
  readRegistrationLog,
  registrationSummary,
  registrationsInFlight,
  scrubRegistrationDetail,
  waitForRegistrations,
} from "../../src/oclif/registration-log.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function configDir(): string {
  const directory = mkdtempSync(join(tmpdir(), "primitive-registration-log-"));
  directories.push(directory);
  return directory;
}

describe("registration log", () => {
  it("scrubs setup URLs, tokens and keys from any detail", () => {
    const token = ["invite", "a".repeat(40)].join("_");
    const key = ["prim", "oat", "secret"].join("_");
    const text = scrubRegistrationDetail(
      `claim https://api.example.test/v1/agent-connections/setup#token=${token} with Bearer ${key} and token=${token} or ${["pconn", "x"].join("_")}`,
    );
    expect(text).not.toContain(token);
    expect(text).not.toContain(key);
    expect(text).not.toContain("pconn_");
    expect(text).toContain("[setup URL]");
  });

  it("keeps a bounded history and summarizes the last failure", () => {
    const dir = configDir();
    for (let n = 0; n < 40; n++)
      appendRegistrationLog(dir, "session-a", {
        event: n === 39 ? "failed" : "started",
        phase: null,
        code: n === 39 ? "setup_unfinished" : null,
        orgId: "org-1",
        address: n > 5 ? "agent@example.test" : null,
        detail: n === 39 ? "Next step." : null,
      });
    expect(readRegistrationLog(dir, "session-a")).toHaveLength(30);
    expect(registrationSummary(dir, "session-a")).toMatchObject({
      lastEvent: "failed",
      address: "agent@example.test",
      orgId: "org-1",
      lastFailure: { code: "setup_unfinished", detail: "Next step." },
    });
    expect(registrationSummary(dir, "session-b")).toBeNull();
  });

  it("finds a registration in flight and waits for it to finish", async () => {
    const dir = configDir();
    const enrollment = join(
      agentProfilesDirectory(dir),
      "profiles",
      "session-a",
      "enrollment",
    );
    expect(registrationsInFlight(dir)).toEqual([]);
    const release = acquireListenLock(enrollment, ENROLLMENT_LOCK_SCOPE);
    expect(registrationsInFlight(dir)).toEqual(["session-a"]);
    const waited: string[][] = [];
    setTimeout(release, 100);
    expect(
      await waitForRegistrations(dir, 5_000, {
        pollMs: 20,
        onWait: (profiles) => waited.push(profiles),
      }),
    ).toEqual([]);
    expect(waited).toEqual([["session-a"]]);
    const held = acquireListenLock(enrollment, ENROLLMENT_LOCK_SCOPE);
    try {
      expect(await waitForRegistrations(dir, 50, { pollMs: 10 })).toEqual([
        "session-a",
      ]);
    } finally {
      held();
    }
  });
});
