import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_POLICY_MAX_AGE_MS,
  type ContactPolicyPage,
  createNotificationContactPolicy,
} from "../../src/oclif/notification-contact-policy.js";

const recipient = "agent@example.com";
const sender = "owner@example.com";
const activation = "2026-09-01T10:00:00.000Z";
const received = "2026-09-01T10:01:00.000Z";
const signal = new AbortController().signal;
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    agent_address: recipient,
    contact_address: sender,
    notify: true,
    notify_since: activation,
    notification_generation: randomUUID(),
    version: randomUUID(),
    ...overrides,
  };
}
function fixture(initial = row()) {
  let clock = 0;
  let rows = [initial];
  const readPage = vi.fn(
    async (): Promise<ContactPolicyPage> => ({ data: rows, cursor: null }),
  );
  const policy = createNotificationContactPolicy({
    recipient,
    readPage,
    now: () => clock,
  });
  return {
    policy,
    readPage,
    rows: (next: ReturnType<typeof row>[]) => {
      rows = next;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe("contact notification policy", () => {
  it("requires an enabled exact membership and mail at or after activation", async () => {
    const f = fixture();
    expect(await f.policy.admit(sender, activation, signal)).toMatchObject({
      sender,
    });
    expect(
      await f.policy.admit(sender, "2026-09-01T09:59:59.999Z", signal),
    ).toBeNull();
    expect(
      await f.policy.admit("other@example.com", received, signal),
    ).toBeNull();
    expect(
      await f.policy.admit("Malformed address", received, signal),
    ).toBeNull();
    f.rows([
      row({ notify: false, notify_since: null, notification_generation: null }),
    ]);
    await f.policy.refresh(signal);
    expect(await f.policy.admit(sender, received, signal)).toBeNull();
  });

  it("refreshes a cached denial so new activation cannot discard newer mail", async () => {
    const f = fixture(
      row({ notify: false, notify_since: null, notification_generation: null }),
    );
    expect(await f.policy.admit(sender, received, signal)).toBeNull();
    f.rows([row()]);
    expect(await f.policy.admit(sender, received, signal)).toMatchObject({
      sender,
    });
  });

  it("refreshes before dispatch and refuses disable, deletion, or a new generation", async () => {
    for (const next of [
      [],
      [
        row({
          notify: false,
          notify_since: null,
          notification_generation: null,
        }),
      ],
      [row()],
    ]) {
      const f = fixture();
      const admission = await f.policy.admit(sender, received, signal);
      if (!admission) throw new Error("Expected admission");
      f.rows(next);
      await expect(f.policy.recheck(admission, signal)).rejects.toThrow(
        "changed or expired",
      );
    }
  });

  it("accepts purpose/version edits when activation and generation stay unchanged", async () => {
    const initial = row();
    const f = fixture(initial);
    const admission = await f.policy.admit(sender, received, signal);
    if (!admission) throw new Error("Expected admission");
    f.rows([{ ...initial, version: randomUUID(), purpose: "Changed purpose" }]);
    const dispatch = await f.policy.recheck(admission, signal);
    expect(() => dispatch()).not.toThrow();
    expect(f.readPage).toHaveBeenCalledTimes(2);
  });

  it("expires before the native write even when preflight outlives a fresh policy", async () => {
    const f = fixture();
    const admission = await f.policy.admit(sender, received, signal);
    if (!admission) throw new Error("Expected admission");
    const dispatch = await f.policy.recheck(admission, signal);
    f.advance(CONTACT_POLICY_MAX_AGE_MS);
    expect(dispatch).toThrow("changed or expired");
  });

  it("refreshes expired admission snapshots and applies the current activation", async () => {
    const f = fixture();
    await f.policy.admit(sender, received, signal);
    f.advance(CONTACT_POLICY_MAX_AGE_MS);
    f.rows([row({ notify_since: "2026-09-01T10:02:00.000Z" })]);
    expect(await f.policy.admit(sender, received, signal)).toBeNull();
    expect(f.readPage).toHaveBeenCalledTimes(2);
  });

  it("does not reuse prior authorization after reconnecting with a fresh policy instance", async () => {
    const f = fixture();
    const admission = await f.policy.admit(sender, received, signal);
    if (!admission) throw new Error("Expected admission");
    const next = fixture(row({ notify_since: "2026-09-01T10:02:00.000Z" }));
    expect(await next.policy.admit(sender, received, signal)).toBeNull();
    await expect(next.policy.recheck(admission, signal)).rejects.toThrow(
      "changed or expired",
    );
  });

  it("requires complete ordered pagination and uses the exact own recipient", async () => {
    const readPage = vi.fn(async (cursor: string | undefined) =>
      cursor === undefined
        ? {
            data: [row({ contact_address: "a@example.com" })],
            cursor: "a@example.com",
          }
        : { data: [row()], cursor: null },
    );
    const policy = createNotificationContactPolicy({ recipient, readPage });
    expect(await policy.admit(sender, received, signal)).toMatchObject({
      sender,
    });
    expect(readPage.mock.calls.map(([cursor]) => cursor)).toEqual([
      undefined,
      "a@example.com",
    ]);
  });

  it.each([
    { agent_address: "different@example.com" },
    { notify: "true" },
    { notification_generation: null },
    { notification_generation: "invalid" },
    { notify_since: null },
    { version: "invalid" },
    { notify: false },
  ])("rejects malformed or cross-address preferences %j", async (overrides) => {
    const f = fixture(row(overrides));
    await expect(f.policy.admit(sender, received, signal)).rejects.toThrow(
      "unavailable or invalid",
    );
  });

  it("invalidates old dispatch permission when a later pagination page fails", async () => {
    const f = fixture();
    const admission = await f.policy.admit(sender, received, signal);
    if (!admission) throw new Error("Expected admission");
    const dispatch = await f.policy.recheck(admission, signal);
    f.readPage
      .mockResolvedValueOnce({ data: [row()], cursor: sender })
      .mockRejectedValueOnce(new Error("revoked"));
    await expect(f.policy.refresh(signal)).rejects.toThrow(
      "unavailable or invalid",
    );
    expect(dispatch).toThrow("changed or expired");
  });

  it("rejects repeated cursors and duplicate membership pages", async () => {
    const f = fixture();
    f.readPage.mockResolvedValue({ data: [row()], cursor: sender });
    await expect(f.policy.admit(sender, received, signal)).rejects.toThrow(
      "unavailable or invalid",
    );
    expect(f.readPage).toHaveBeenCalledTimes(2);
  });

  it("measures freshness from the first page rather than the final response", async () => {
    let clock = 0;
    const policy = createNotificationContactPolicy({
      recipient,
      now: () => clock,
      readPage: async () => {
        clock += CONTACT_POLICY_MAX_AGE_MS;
        return { data: [row()], cursor: null };
      },
    });
    await expect(policy.admit(sender, received, signal)).rejects.toThrow(
      "unavailable or invalid",
    );
  });

  it("cancels before admission and before dispatch without retaining authority", async () => {
    const f = fixture();
    const controller = new AbortController();
    const admission = await f.policy.admit(sender, received, controller.signal);
    if (!admission) throw new Error("Expected admission");
    const dispatch = await f.policy.recheck(admission, controller.signal);
    controller.abort();
    expect(dispatch).toThrow();
    await expect(
      f.policy.admit(sender, received, controller.signal),
    ).rejects.toThrow();
  });
});
