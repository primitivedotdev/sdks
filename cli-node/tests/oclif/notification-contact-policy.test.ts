import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  CONTACT_POLICY_MAX_AGE_MS,
  CONTACT_POLICY_RETRY_MAX_MS,
  CONTACT_POLICY_RETRY_MIN_MS,
  type ContactPolicyPage,
  ContactPolicyReadRetryError,
  createNotificationContactPolicy,
} from "../../src/oclif/notification-contact-policy.js";
import { emptyContactPolicy } from "./contact-policy-fixture.js";

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
function fixture(initial = row(), contactRequests = false) {
  let clock = 0;
  let rows = [initial];
  const readPage = vi.fn(
    async (): Promise<ContactPolicyPage> => ({ data: rows, cursor: null }),
  );
  const document = emptyContactPolicy(recipient);
  const readPolicy = vi.fn(async () => document);
  const policy = createNotificationContactPolicy({
    readPolicy,
    recipient,
    contactRequests,
    readPage,
    now: () => clock,
  });
  return {
    policy,
    document,
    readPolicy,
    readPage,
    rows: (next: ReturnType<typeof row>[]) => {
      rows = next;
    },
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

function requestFixture() {
  const f = fixture(row(), true);
  f.rows([]);
  f.document.agent_policy = {
    rules: [],
    allow_contact_requests: true,
    contact_request_since: activation,
    contact_request_generation: randomUUID(),
    version: randomUUID(),
    updated_at: activation,
  };
  f.document.allow_contact_requests = true;
  f.document.contact_request_since = activation;
  f.document.contact_request_generation = "b".repeat(64);
  return f;
}

describe("contact notification policy", () => {
  it("keeps cached request-only mail pending through a paced transient refresh", async () => {
    const f = requestFixture();
    expect(await f.policy.admit(sender, received, signal)).toMatchObject({
      kind: "request",
    });
    f.readPolicy.mockRejectedValueOnce(new ContactPolicyReadRetryError());
    await expect(
      f.policy.admit(sender, received, signal),
    ).rejects.toBeInstanceOf(ContactPolicyReadRetryError);
    expect(() => f.policy.members()).toThrow("unavailable");
    f.rows([row()]);
    for (let attempt = 0; attempt < 100; attempt++)
      await expect(
        f.policy.admit(sender, received, signal),
      ).rejects.toBeInstanceOf(ContactPolicyReadRetryError);
    expect(f.readPolicy).toHaveBeenCalledTimes(2);
    f.advance(CONTACT_POLICY_RETRY_MIN_MS);
    expect(await f.policy.admit(sender, received, signal)).toMatchObject({
      kind: "allowed",
    });
    expect(f.readPolicy).toHaveBeenCalledTimes(3);
  });

  it("invalidates prior dispatch permission and bounds repeated transient read attempts", async () => {
    const f = fixture();
    const admission = await f.policy.admit(sender, received, signal);
    if (!admission) throw new Error("Expected admission");
    const dispatch = await f.policy.recheck(admission, signal);
    f.readPage.mockRejectedValue(new ContactPolicyReadRetryError());
    await expect(f.policy.recheck(admission, signal)).rejects.toBeInstanceOf(
      ContactPolicyReadRetryError,
    );
    expect(dispatch).toThrow("changed or expired");
    for (let attempt = 0; attempt < 8; attempt++) {
      const count = f.readPage.mock.calls.length;
      const backoff = Math.min(
        CONTACT_POLICY_RETRY_MIN_MS * 2 ** attempt,
        CONTACT_POLICY_RETRY_MAX_MS,
      );
      f.advance(backoff - 1);
      await expect(
        f.policy.admit(sender, received, signal),
      ).rejects.toBeInstanceOf(ContactPolicyReadRetryError);
      expect(f.readPage).toHaveBeenCalledTimes(count);
      f.advance(1);
      await expect(
        f.policy.admit(sender, received, signal),
      ).rejects.toBeInstanceOf(ContactPolicyReadRetryError);
      expect(f.readPage).toHaveBeenCalledTimes(count + 1);
    }
  });

  it("exposes temporary startup failure to supervision without retaining authority", async () => {
    const f = fixture();
    f.readPolicy.mockRejectedValueOnce(new ContactPolicyReadRetryError());
    await expect(f.policy.refresh(signal)).rejects.toBeInstanceOf(
      ContactPolicyReadRetryError,
    );
    expect(f.readPolicy).toHaveBeenCalledTimes(1);
    expect(() => f.policy.members()).toThrow("unavailable");
    await expect(f.policy.refresh(signal)).rejects.toBeInstanceOf(
      ContactPolicyReadRetryError,
    );
    expect(f.readPolicy).toHaveBeenCalledTimes(1);
    const controller = new AbortController();
    controller.abort();
    await expect(f.policy.refresh(controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(f.readPolicy).toHaveBeenCalledTimes(1);
    f.advance(CONTACT_POLICY_RETRY_MIN_MS);
    await f.policy.refresh(signal);
    expect(f.readPolicy).toHaveBeenCalledTimes(2);
    expect(await f.policy.admit(sender, received, signal)).toMatchObject({
      kind: "allowed",
    });
  });

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

  it.each([
    { receivedAt: "2026-09-01T10:01:04.700Z", allowed: true },
    { receivedAt: "2026-09-01T10:00:59.999Z", allowed: false },
  ])("refreshes request-only admission after acceptance without backfilling $receivedAt", async ({
    receivedAt,
    allowed,
  }) => {
    const f = requestFixture();
    expect(await f.policy.admit(sender, received, signal)).toMatchObject({
      kind: "request",
    });
    const membership = row({ notify_since: received });
    f.rows([membership]);
    f.advance(4700);

    const admission = await f.policy.admit(sender, receivedAt, signal);
    if (allowed)
      expect(admission).toMatchObject({
        kind: "allowed",
        generation: membership.notification_generation,
        notifySince: received,
      });
    else expect(admission).toBeNull();
    expect(f.readPage).toHaveBeenCalledTimes(2);
    expect(f.readPolicy).toHaveBeenCalledTimes(2);
  });

  it("refreshes request-only decisions once and still rechecks permission before dispatch", async () => {
    const f = requestFixture();
    await f.policy.admit(sender, received, signal);
    const admission = await f.policy.admit(sender, received, signal);
    expect(admission?.kind).toBe("request");
    expect(f.readPage).toHaveBeenCalledTimes(2);
    if (!admission) throw new Error("Expected request admission");
    f.rows([
      row({ notify: false, notify_since: null, notification_generation: null }),
    ]);
    await expect(f.policy.recheck(admission, signal)).rejects.toThrow(
      "changed or expired",
    );
    expect(f.readPage).toHaveBeenCalledTimes(3);
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
    const policy = createNotificationContactPolicy({
      readPolicy: async () => emptyContactPolicy(recipient),
      recipient,
      readPage,
    });
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
      readPolicy: async () => emptyContactPolicy(recipient),
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

it("rechecks owner policy changes even when exact membership remains enabled", async () => {
  const f = fixture();
  const admission = await f.policy.admit(sender, received, signal);
  if (!admission) throw new Error("Expected admission");
  f.document.org_policy = {
    ...f.document.org_policy,
    version: randomUUID(),
    updated_at: activation,
    rules: [
      {
        pattern: "*@example.com",
        effect: "silence",
        notify_since: null,
        notification_generation: null,
      },
    ],
  };
  f.document.effective_version = "b".repeat(64);
  await expect(f.policy.recheck(admission, signal)).rejects.toThrow(
    "changed or expired",
  );
});
it("does not fall back to exact membership when the policy read is unavailable", async () => {
  const f = fixture();
  const admission = await f.policy.admit(sender, received, signal);
  if (!admission) throw new Error("Expected admission");
  f.readPolicy.mockRejectedValueOnce(new Error("revoked"));
  await expect(f.policy.recheck(admission, signal)).rejects.toThrow(
    "unavailable or invalid",
  );
});
