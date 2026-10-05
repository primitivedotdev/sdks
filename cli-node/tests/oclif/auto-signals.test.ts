import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAutoSignalWorker } from "../../src/oclif/auto-signal-worker.js";
import {
  AUTO_WORKING_CAP_MS,
  AUTO_WORKING_RENEW_MS,
  activeWorkingLeases,
  autoSignalEligible,
  autoSignalsDisabled,
  claimAutoRead,
  clearWorkingSending,
  dispatchAutoRead,
  dispatchAutoWorking,
  type HaltedAutoWorking,
  haltAutoWorking,
  markWorkingSending,
  readAutoClaim,
  readWorkingLease,
  recordRenewer,
  recordSentSignal,
  restoreAutoWorking,
  resumeAutoWorking,
  type SpawnLike,
  startWorkingLease,
  stopWorkingLease,
  writeWorkingLease,
} from "../../src/oclif/auto-signals.js";
import type { sendSignal } from "../../src/oclif/signal-command.js";

const AGENT = "agent@example.test";
const OWNER = "owner@example.test";
const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0))
    rmSync(path, { force: true, recursive: true });
});
function configDir() {
  const path = mkdtempSync(join(tmpdir(), "auto-signals-"));
  directories.push(path);
  return path;
}
function detail(overrides: Partial<EmailDetail> = {}): EmailDetail {
  return {
    id: randomUUID(),
    from_email: OWNER,
    recipient: AGENT,
    to_email: AGENT,
    status: "accepted",
    from_header: OWNER,
    message_id: "<parent@example.test>",
    body_text: "Please look at this",
    auth: {
      dmarc: "pass",
      dmarcFromDomain: "example.test",
      dmarcDkimAligned: true,
      dkimSignatures: [],
    },
    body_html: null,
    thread_id: randomUUID(),
    parsed: {
      status: "complete",
      attachments: [],
      to_addresses: [{ address: AGENT }],
      cc: null,
      bcc: null,
    },
    ...overrides,
  } as unknown as EmailDetail;
}
const network = { kind: "allowed" as const, source: "network" as const };
const identity = { agentAddress: AGENT, ownerAddress: OWNER };
const peerIdentity = { agentAddress: AGENT, ownerAddress: "boss@example.test" };
function spawner(options: { fail?: boolean } = {}) {
  const calls: { args: readonly string[]; env: Record<string, string> }[] = [];
  const impl: SpawnLike = (_command, args, spawnOptions) => {
    if (options.fail) throw new Error("spawn failed");
    calls.push({
      args,
      env: spawnOptions.env as Record<string, string>,
    });
    return { unref: () => undefined, on: () => undefined };
  };
  return { calls, impl };
}
function claim(dir: string, emailId = randomUUID(), sender = OWNER) {
  claimAutoRead(dir, {
    emailId,
    profileName: "work",
    sender,
    threadId: randomUUID(),
  });
  return emailId;
}

describe("automatic signal trust gate", () => {
  it("accepts a plain single-recipient email admitted by the network policy", () => {
    expect(autoSignalEligible(detail(), peerIdentity, network)).toBe(true);
    expect(
      autoSignalEligible(detail(), peerIdentity, {
        ...network,
        kind: "response",
      }),
    ).toBe(true);
  });

  it("refuses mail from a verified connected agent, even a network peer", () => {
    const fromAgent = detail({ sender_connected_agent_verified: true });
    expect(autoSignalEligible(fromAgent, peerIdentity, network)).toBe(false);
    expect(
      autoSignalEligible(
        detail({ sender_connected_agent_verified: false }),
        peerIdentity,
        network,
      ),
    ).toBe(true);
  });

  it("accepts the authenticated pinned owner admitted as a saved contact", () => {
    expect(autoSignalEligible(detail(), identity, { kind: "allowed" })).toBe(
      true,
    );
  });

  it("refuses an approved contact that is neither the owner nor a network peer", () => {
    expect(
      autoSignalEligible(detail(), peerIdentity, { kind: "allowed" }),
    ).toBe(false);
  });

  it("refuses the owner address when the sender is not authenticated", () => {
    const spoofed = detail({
      auth: {
        dmarc: "fail",
        dmarcFromDomain: "example.test",
        dmarcDkimAligned: false,
        dkimSignatures: [],
      },
    } as never);
    expect(autoSignalEligible(spoofed, identity, network)).toBe(false);
  });

  it.each([
    ["no admission", detail(), null],
    ["a contact request", detail(), { kind: "request", source: "network" }],
    ["mail from itself", detail({ from_email: AGENT }), network],
    ["a missing Message-ID", detail({ message_id: null }), network],
    ["a rejected email", detail({ status: "rejected" as never }), network],
    [
      "a copied recipient",
      detail({
        parsed: {
          status: "complete",
          attachments: [],
          to_addresses: [{ address: AGENT }],
          cc: [{ address: "other@example.test" }],
        },
      } as never),
      network,
    ],
    [
      "several To recipients",
      detail({
        parsed: {
          status: "complete",
          attachments: [],
          to_addresses: [{ address: AGENT }, { address: "other@example.test" }],
        },
      } as never),
      network,
    ],
    [
      "an unknown audience",
      detail({ parsed: { status: "complete", attachments: [] } } as never),
      network,
    ],
    [
      "a signal or fyi acknowledgement",
      detail({
        parsed: {
          status: "complete",
          to_addresses: [{ address: AGENT }],
          attachments: [
            {
              filename: "interaction.json",
              content_type: "application/json",
            },
          ],
        },
      } as never),
      network,
    ],
  ])("refuses %s", (_label, email, admission) => {
    expect(autoSignalEligible(email, identity, admission as never)).toBe(false);
  });
});

describe("automatic read dispatch", () => {
  it("claims and dispatches one read per email however often it is surfaced", () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = randomUUID();
    const input = {
      configDir: dir,
      emailId,
      profileName: "work",
      sender: OWNER,
      threadId: null,
      env: {},
      spawnImpl: spawn.impl,
    };
    expect(dispatchAutoRead(input)).toBe(true);
    expect(dispatchAutoRead(input)).toBe(false);
    expect(dispatchAutoRead(input)).toBe(false);
    expect(spawn.calls).toHaveLength(1);
    expect(spawn.calls[0]?.env).toMatchObject({
      PRIMITIVE_AUTO_SIGNAL_WORKER: "1",
      PRIMITIVE_AUTO_SIGNAL_EMAIL: emailId,
      PRIMITIVE_AUTO_SIGNAL_KIND: "read",
      PRIMITIVE_AGENT_PROFILE: "work",
      PRIMITIVE_CONFIG_DIR: dir,
    });
    expect(readAutoClaim(dir, emailId)).toMatchObject({
      profile: "work",
      sender: OWNER,
    });
  });

  it("never acknowledges a plain answer to one of its own signals", () => {
    const dir = configDir();
    const spawn = spawner();
    const signalId = randomUUID();
    recordSentSignal(dir, signalId);
    const emailId = randomUUID();
    expect(
      dispatchAutoRead({
        configDir: dir,
        emailId,
        profileName: "work",
        sender: OWNER,
        threadId: null,
        replyToSentEmailId: signalId,
        env: {},
        spawnImpl: spawn.impl,
      }),
    ).toBe(false);
    expect(spawn.calls).toHaveLength(0);
    expect(readAutoClaim(dir, emailId)).toBeNull();
    expect(
      dispatchAutoRead({
        configDir: dir,
        emailId,
        profileName: "work",
        sender: OWNER,
        threadId: null,
        replyToSentEmailId: randomUUID(),
        env: {},
        spawnImpl: spawn.impl,
      }),
    ).toBe(true);
  });

  it("does nothing when automatic signals are turned off", () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = randomUUID();
    expect(
      dispatchAutoRead({
        configDir: dir,
        emailId,
        profileName: "work",
        sender: OWNER,
        threadId: null,
        env: { PRIMITIVE_NO_AUTO_SIGNALS: "1" },
        spawnImpl: spawn.impl,
      }),
    ).toBe(false);
    expect(spawn.calls).toHaveLength(0);
    expect(readAutoClaim(dir, emailId)).toBeNull();
    expect(autoSignalsDisabled({ PRIMITIVE_NO_AUTO_SIGNALS: "0" })).toBe(false);
    expect(autoSignalsDisabled({ PRIMITIVE_NO_AUTO_SIGNALS: "true" })).toBe(
      true,
    );
  });

  it("fails open when the worker cannot start or state is unwritable", () => {
    const spawn = spawner({ fail: true });
    expect(() =>
      dispatchAutoRead({
        configDir: configDir(),
        emailId: randomUUID(),
        profileName: "work",
        sender: OWNER,
        threadId: null,
        env: {},
        spawnImpl: spawn.impl,
      }),
    ).not.toThrow();
    expect(
      dispatchAutoRead({
        configDir: "/dev/null/not-a-directory",
        emailId: randomUUID(),
        profileName: "work",
        sender: OWNER,
        threadId: null,
        env: {},
        spawnImpl: spawner().impl,
      }),
    ).toBe(false);
    expect(
      dispatchAutoRead({
        configDir: configDir(),
        emailId: "not-an-id",
        profileName: "work",
        sender: OWNER,
        threadId: null,
        env: {},
        spawnImpl: spawner().impl,
      }),
    ).toBe(false);
  });
});

describe("automatic working dispatch", () => {
  it("starts working only for claimed mail, once", () => {
    const dir = configDir();
    const spawn = spawner();
    expect(
      dispatchAutoWorking({
        configDir: dir,
        emailId: randomUUID(),
        env: {},
        spawnImpl: spawn.impl,
      }),
    ).toBe(false);
    const emailId = claim(dir);
    const input = { configDir: dir, emailId, env: {}, spawnImpl: spawn.impl };
    expect(dispatchAutoWorking(input)).toBe(true);
    expect(dispatchAutoWorking(input)).toBe(false);
    expect(spawn.calls).toHaveLength(1);
    expect(spawn.calls[0]?.env.PRIMITIVE_AUTO_SIGNAL_KIND).toBe("working");
  });

  it("respects the opt-out", () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = claim(dir);
    expect(
      dispatchAutoWorking({
        configDir: dir,
        emailId,
        env: { PRIMITIVE_NO_AUTO_SIGNALS: "1" },
        spawnImpl: spawn.impl,
      }),
    ).toBe(false);
    expect(readWorkingLease(dir, emailId)).toBeNull();
  });
});

describe("stopping automatic working", () => {
  it("stops the answered email and mail from the answered peer only", async () => {
    const dir = configDir();
    const answered = claim(dir);
    const samePeer = claim(dir);
    const otherPeer = claim(dir, randomUUID(), "other@example.test");
    for (const id of [answered, samePeer, otherPeer])
      startWorkingLease(dir, id);
    await haltAutoWorking(dir, { emailIds: [answered] }, "reply");
    expect(readWorkingLease(dir, answered)?.stop_reason).toBe("reply");
    expect(readWorkingLease(dir, samePeer)?.stopped_at).toBeNull();
    await haltAutoWorking(
      dir,
      { peers: [OWNER.toUpperCase()], profileName: "other" },
      "reply",
    );
    expect(readWorkingLease(dir, samePeer)?.stopped_at).toBeNull();
    // A send with no connected profile is not this profile's answer.
    await haltAutoWorking(dir, { peers: [OWNER] }, "reply");
    expect(readWorkingLease(dir, samePeer)?.stopped_at).toBeNull();
    await haltAutoWorking(
      dir,
      { peers: [OWNER], profileName: "work" },
      "reply",
    );
    expect(readWorkingLease(dir, samePeer)?.stop_reason).toBe("reply");
    expect(readWorkingLease(dir, otherPeer)?.stopped_at).toBeNull();
  });

  it("waits for an in-flight renewal before the answer is sent", async () => {
    const dir = configDir();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    markWorkingSending(dir, emailId);
    const started = Date.now();
    setTimeout(() => clearWorkingSending(dir, emailId), 200);
    await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    expect(Date.now() - started).toBeGreaterThanOrEqual(150);
  });

  it("never throws without state", async () => {
    await expect(
      haltAutoWorking("/dev/null/missing", { emailIds: [randomUUID()] }, "x"),
    ).resolves.toEqual({ configDir: "/dev/null/missing", stops: [] });
  });

  it("a renewer rewriting the lease cannot undo a stop", () => {
    const dir = configDir();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    // The renewer read the lease before the answer stopped it.
    const stale = readWorkingLease(dir, emailId);
    expect(stale?.stopped_at).toBeNull();
    stopWorkingLease(dir, emailId, "reply");
    if (stale)
      writeWorkingLease(dir, { ...stale, signal_sent_ids: [randomUUID()] });
    expect(readWorkingLease(dir, emailId)?.stop_reason).toBe("reply");
  });

  it("restores working when the answer is refused, and only its own stop", async () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    const halted = await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    expect(halted.stops).toHaveLength(1);
    expect(restoreAutoWorking(halted, { env: {}, spawnImpl: spawn.impl })).toBe(
      1,
    );
    expect(readWorkingLease(dir, emailId)?.stopped_at).toBeNull();
    expect(spawn.calls).toHaveLength(1);
    // A stop made by someone else (here the cap) is never undone.
    stopWorkingLease(dir, emailId, "cap");
    expect(restoreAutoWorking(halted, { env: {}, spawnImpl: spawn.impl })).toBe(
      0,
    );
    expect(readWorkingLease(dir, emailId)?.stop_reason).toBe("cap");
  });

  it("never undoes a stop that a later answer relies on", async () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    const first = await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    // A second answer goes out while the first one is still in flight.
    const second = await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    expect(second.stops).toMatchObject([{ owner: false }]);
    expect(restoreAutoWorking(first, { env: {}, spawnImpl: spawn.impl })).toBe(
      0,
    );
    expect(readWorkingLease(dir, emailId)?.stop_reason).toBe("reply");
    expect(spawn.calls).toHaveLength(0);
  });

  it.each([
    ["the owner first", [0, 1]],
    ["the holder first", [1, 0]],
  ] as const)(
    "restores working when both answers are refused, %s",
    async (_label, order) => {
      const dir = configDir();
      const spawn = spawner();
      const emailId = claim(dir);
      startWorkingLease(dir, emailId);
      const halts = [
        await haltAutoWorking(dir, { emailIds: [emailId] }, "reply"),
        await haltAutoWorking(dir, { emailIds: [emailId] }, "reply"),
      ];
      let restored = 0;
      for (const index of order)
        restored += restoreAutoWorking(halts[index] as HaltedAutoWorking, {
          env: {},
          spawnImpl: spawn.impl,
        });
      expect(restored).toBe(1);
      expect(readWorkingLease(dir, emailId)?.stopped_at).toBeNull();
      expect(spawn.calls).toHaveLength(1);
    },
  );

  it("starts a renewer on restore even while the old heartbeat looks live", async () => {
    const dir = configDir();
    const spawn = spawner();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    recordRenewer(dir, emailId);
    const halted = await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    expect(restoreAutoWorking(halted, { env: {}, spawnImpl: spawn.impl })).toBe(
      1,
    );
    expect(spawn.calls).toHaveLength(1);
  });

  it("waits for a renewal that outlasts the old three second settle", async () => {
    const dir = configDir();
    const emailId = claim(dir);
    startWorkingLease(dir, emailId);
    markWorkingSending(dir, emailId);
    const started = Date.now();
    setTimeout(() => clearWorkingSending(dir, emailId), 3_400);
    await haltAutoWorking(dir, { emailIds: [emailId] }, "reply");
    expect(Date.now() - started).toBeGreaterThanOrEqual(3_350);
  }, 10_000);
});

describe("renewer backstop", () => {
  it("reads only active leases and prunes stopped ones from the index", () => {
    const dir = configDir();
    const live = claim(dir);
    startWorkingLease(dir, live);
    const done = claim(dir);
    startWorkingLease(dir, done);
    // Claims that never started working are not scanned at all.
    for (let i = 0; i < 5; i++) claim(dir);
    expect(readdirSync(join(dir, "auto-signals", "active")).sort()).toEqual(
      [live, done].sort(),
    );
    stopWorkingLease(dir, done, "reply");
    expect(activeWorkingLeases(dir).map((lease) => lease.email_id)).toEqual([
      live,
    ]);
    // A stopped lease stays indexed briefly so a later answer can hold it,
    // then is pruned.
    expect(readdirSync(join(dir, "auto-signals", "active"))).toHaveLength(2);
    activeWorkingLeases(dir, () => Date.now() + 10 * 60_000);
    expect(readdirSync(join(dir, "auto-signals", "active"))).toEqual([live]);
  });

  it("restarts a renewer only for active, uncapped leases without a live one", () => {
    const dir = configDir();
    const spawn = spawner();
    const now = Date.now();
    const active = claim(dir);
    startWorkingLease(dir, active, () => now);
    const covered = claim(dir);
    startWorkingLease(dir, covered, () => now);
    recordRenewer(dir, covered);
    const capped = claim(dir);
    startWorkingLease(dir, capped, () => now - AUTO_WORKING_CAP_MS);
    const stopped = claim(dir);
    startWorkingLease(dir, stopped, () => now);
    stopWorkingLease(dir, stopped, "reply");
    expect(
      resumeAutoWorking(dir, {
        env: {},
        spawnImpl: spawn.impl,
        now: () => now,
      }),
    ).toBe(1);
    expect(spawn.calls[0]?.env.PRIMITIVE_AUTO_SIGNAL_EMAIL).toBe(active);
    expect(
      resumeAutoWorking(dir, {
        env: { PRIMITIVE_AUTO_SIGNAL_WORKER: "1" },
        spawnImpl: spawn.impl,
      }),
    ).toBe(0);
    expect(resumeAutoWorking(configDir(), { env: {} })).toBe(0);
  });
});

describe("automatic signal worker", () => {
  function harness(kind: "read" | "working") {
    const dir = configDir();
    const emailId = claim(dir);
    let clock = Date.now();
    const sends: Parameters<typeof sendSignal>[1][] = [];
    const send = vi.fn(
      async (_context: unknown, options: Parameters<typeof sendSignal>[1]) => {
        sends.push(options);
        if (options.shouldSend && !options.shouldSend())
          return { exitCode: 0, data: { outcome: "prepared", sent_id: null } };
        return {
          exitCode: 0,
          data: { outcome: "sent", sent_id: randomUUID() },
        };
      },
    );
    const env = {
      PRIMITIVE_CONFIG_DIR: dir,
      PRIMITIVE_AGENT_PROFILE: "work",
      PRIMITIVE_AUTO_SIGNAL_EMAIL: emailId,
      PRIMITIVE_AUTO_SIGNAL_KIND: kind,
    };
    return {
      dir,
      emailId,
      env,
      sends,
      send,
      now: () => clock,
      advance: (ms: number) => {
        clock += ms;
      },
      context: vi.fn(async () => ({}) as never),
    };
  }

  it("sends one read with the claimed profile", async () => {
    const h = harness("read");
    await runAutoSignalWorker(h.env, {
      context: h.context,
      send: h.send as never,
    });
    expect(h.sends).toEqual([{ id: h.emailId, kind: "read" }]);
    expect(h.context).toHaveBeenCalledWith(h.dir, "work");
  });

  it("refuses a profile other than the one that claimed the email", async () => {
    const h = harness("read");
    await runAutoSignalWorker(
      { ...h.env, PRIMITIVE_AGENT_PROFILE: "someone-else" },
      { context: h.context, send: h.send as never },
    );
    expect(h.sends).toHaveLength(0);
  });

  it("fails open when authentication or sending fails", async () => {
    const h = harness("read");
    await expect(
      runAutoSignalWorker(h.env, {
        context: async () => {
          throw new Error("offline");
        },
        send: h.send as never,
      }),
    ).resolves.toBeUndefined();
    await expect(
      runAutoSignalWorker(h.env, {
        context: h.context,
        send: (async () => {
          throw new Error("network");
        }) as never,
      }),
    ).resolves.toBeUndefined();
  });

  it("renews working in distinct slots until the agent answers", async () => {
    const h = harness("working");
    startWorkingLease(h.dir, h.emailId, h.now);
    let checks = 0;
    await runAutoSignalWorker(h.env, {
      context: h.context,
      send: h.send as never,
      now: h.now,
      sleep: async (ms) => h.advance(ms),
      answered: async () => ++checks > 3,
    });
    expect(h.sends.map((send) => send.slot)).toEqual([
      "auto-working-0",
      "auto-working-1",
      "auto-working-2",
    ]);
    expect(h.sends.every((send) => send.expiresIn === 55)).toBe(true);
    const lease = readWorkingLease(h.dir, h.emailId);
    expect(lease?.stop_reason).toBe("answered");
    expect(lease?.signal_sent_ids).toHaveLength(3);
  });

  it("stops renewing as soon as a local answer stops the lease", async () => {
    const h = harness("working");
    startWorkingLease(h.dir, h.emailId, h.now);
    await runAutoSignalWorker(h.env, {
      context: h.context,
      send: h.send as never,
      now: h.now,
      sleep: async (ms) => {
        h.advance(ms);
        if (
          h.now() >
          (readWorkingLease(h.dir, h.emailId)?.started_at ?? 0) + 10_000
        )
          stopWorkingLease(h.dir, h.emailId, "reply");
      },
      answered: async () => false,
    });
    expect(h.sends).toHaveLength(1);
    expect(readWorkingLease(h.dir, h.emailId)?.stop_reason).toBe("reply");
  });

  it("keeps renewing when a refused answer restores the lease as it exits", async () => {
    const h = harness("working");
    startWorkingLease(h.dir, h.emailId, h.now);
    let halted: HaltedAutoWorking | null = null;
    let renewing = true;
    await runAutoSignalWorker(h.env, {
      context: h.context,
      send: h.send as never,
      now: h.now,
      sleep: async (ms) => {
        h.advance(ms);
        if (halted === null && renewing)
          halted = await haltAutoWorking(
            h.dir,
            { emailIds: [h.emailId] },
            "reply",
            { settleMs: 0 },
          );
      },
      // The answer is refused right after this renewer saw the stop.
      released: () => {
        if (halted && renewing) {
          restoreAutoWorking(halted, { env: {}, spawnImpl: spawner().impl });
          renewing = false;
        }
      },
      answered: async () => h.sends.length >= 2,
    });
    // The renewer did not exit: it renewed again in the same window, whose
    // durable intent reconciles instead of sending twice.
    expect(h.sends.map((send) => send.slot)).toEqual([
      "auto-working-0",
      "auto-working-0",
    ]);
    expect(readWorkingLease(h.dir, h.emailId)?.stop_reason).toBe("answered");
  });

  it("stops at the cap and after a refused send", async () => {
    const capped = harness("working");
    startWorkingLease(capped.dir, capped.emailId, capped.now);
    capped.advance(AUTO_WORKING_CAP_MS);
    await runAutoSignalWorker(capped.env, {
      context: capped.context,
      send: capped.send as never,
      now: capped.now,
      answered: async () => false,
    });
    expect(capped.sends).toHaveLength(0);
    expect(readWorkingLease(capped.dir, capped.emailId)?.stop_reason).toBe(
      "cap",
    );

    const refused = harness("working");
    startWorkingLease(refused.dir, refused.emailId, refused.now);
    await runAutoSignalWorker(refused.env, {
      context: refused.context,
      send: (async () => ({
        exitCode: 1,
        data: { outcome: "not_sent", sent_id: null },
      })) as never,
      now: refused.now,
      sleep: async (ms) => refused.advance(ms),
      answered: async () => false,
    });
    expect(readWorkingLease(refused.dir, refused.emailId)?.stop_reason).toBe(
      "not_sent",
    );
  });

  it("caps renewals at the documented interval and never runs when opted out", async () => {
    const h = harness("working");
    startWorkingLease(h.dir, h.emailId, h.now);
    await runAutoSignalWorker(
      { ...h.env, PRIMITIVE_NO_AUTO_SIGNALS: "1" },
      { context: h.context, send: h.send as never, now: h.now },
    );
    expect(h.sends).toHaveLength(0);
    await runAutoSignalWorker(h.env, {
      context: h.context,
      send: h.send as never,
      now: h.now,
      sleep: async (ms) => h.advance(ms),
      answered: async () => false,
    });
    expect(h.sends).toHaveLength(
      Math.ceil(AUTO_WORKING_CAP_MS / AUTO_WORKING_RENEW_MS),
    );
    expect(existsSync(join(h.dir, "auto-signals", h.emailId, "sending"))).toBe(
      false,
    );
  });
});
