import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ContactPage,
  createWakePolicy,
  type NetworkAdmission,
  type WakeAdmission,
  WakePolicyError,
  type WakePolicyErrorCode,
} from "../src/receiver.js";
import { emptyContactPolicy } from "./oclif/contact-policy-fixture.js";

const recipient = "agent@example.com";
const contact = "owner@example.com";
const stranger = "stranger@example.com";
const activation = "2026-09-01T10:00:00.000Z";
const receivedAt = "2026-09-01T10:01:00.000Z";
const signal = new AbortController().signal;
const notAdmitted: NetworkAdmission = {
  allowed: false,
  allowed_since: null,
  pending: false,
  member_policy_required: false,
};

function contactRow(address = contact) {
  return {
    agent_address: recipient,
    contact_address: address,
    notify: true,
    notify_since: activation,
    notification_generation: randomUUID(),
    version: randomUUID(),
  };
}

function harness(options: { contactRequests?: boolean } = {}) {
  const state = {
    policy: emptyContactPolicy(recipient),
    page: { data: [contactRow()], cursor: null } as ContactPage,
    network: notAdmitted,
    networkFailure: undefined as unknown,
    networkReads: 0,
    onNetworkRead: undefined as (() => void) | undefined,
    policyFailure: undefined as unknown,
  };
  const policy = createWakePolicy({
    recipient,
    contactRequests: options.contactRequests,
    readContactPolicy: async () => {
      if (state.policyFailure) throw state.policyFailure;
      return state.policy;
    },
    readContactPage: async () => state.page,
    readNetworkAdmission: async () => {
      state.networkReads += 1;
      state.onNetworkRead?.();
      if (state.networkFailure) throw state.networkFailure;
      return state.network;
    },
  });
  return { state, policy };
}

function allowContactRequests(state: ReturnType<typeof harness>["state"]) {
  state.policy.agent_policy = {
    rules: [],
    allow_contact_requests: true,
    contact_request_since: activation,
    contact_request_generation: randomUUID(),
    version: randomUUID(),
    updated_at: activation,
  };
  state.policy.allow_contact_requests = true;
  state.policy.contact_request_since = activation;
  state.policy.contact_request_generation = "b".repeat(64);
}

async function rejection(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(WakePolicyError);
  return error as WakePolicyError;
}

function expectCode(error: WakePolicyError, code: WakePolicyErrorCode) {
  expect({ code: error.code, retryable: error.retryable }).toEqual({
    code,
    retryable: code !== "policy_unavailable",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("primitive/receiver wake policy", () => {
  it("admits mail from a contact and confirms it right before wake", async () => {
    const { policy } = harness();
    const emailId = randomUUID();
    const decision = await policy.admit(
      { emailId, sender: contact, receivedAt },
      signal,
    );
    expect(decision).toEqual({
      kind: "allowed",
      emailId,
      sender: contact,
      receivedAt,
    });
    if (decision.kind === "denied") throw new Error("expected admission");
    const confirm = await policy.recheck(decision, signal);
    expect(() => confirm()).not.toThrow();
  });

  it("admits an unknown sender only as a contact request when the owner allows it", async () => {
    const { state, policy } = harness({ contactRequests: true });
    allowContactRequests(state);
    const email = { emailId: randomUUID(), sender: stranger, receivedAt };
    expect(await policy.admit(email, signal)).toEqual({
      kind: "request",
      ...email,
    });
  });

  it("denies an unknown sender without contact requests", async () => {
    const { state, policy } = harness();
    allowContactRequests(state);
    expect(
      await policy.admit(
        { emailId: randomUUID(), sender: stranger, receivedAt },
        signal,
      ),
    ).toEqual({ kind: "denied" });
  });

  it("denies mail from a contact that arrived before notifications started", async () => {
    const { policy } = harness();
    expect(
      await policy.admit(
        {
          emailId: randomUUID(),
          sender: contact,
          receivedAt: "2026-09-01T09:59:59.000Z",
        },
        signal,
      ),
    ).toEqual({ kind: "denied" });
  });

  it("admits a network peer that is not a contact", async () => {
    const { state, policy } = harness();
    state.network = {
      ...notAdmitted,
      allowed: true,
      allowed_since: activation,
    };
    const email = { emailId: randomUUID(), sender: stranger, receivedAt };
    expect(await policy.admit(email, signal)).toEqual({
      kind: "allowed",
      ...email,
    });
  });

  it("asks for a retry while network admission is pending", async () => {
    const { state, policy } = harness();
    state.network = { ...notAdmitted, pending: true };
    expectCode(
      await rejection(
        policy.admit(
          { emailId: randomUUID(), sender: stranger, receivedAt },
          signal,
        ),
      ),
      "network_admission_pending",
    );
  });

  it("separates a temporary read failure from an unavailable policy", async () => {
    const { state, policy } = harness();
    const email = { emailId: randomUUID(), sender: contact, receivedAt };
    state.policyFailure = new WakePolicyError("policy_read_failed");
    expectCode(
      await rejection(policy.admit(email, signal)),
      "policy_read_failed",
    );

    const fatal = harness();
    const cause = new Error("forbidden");
    fatal.state.policyFailure = cause;
    const error = await rejection(fatal.policy.admit(email, signal));
    expectCode(error, "policy_unavailable");
  });

  it("backs off the network read after a temporary failure", async () => {
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const { state, policy } = harness();
    const email = () => ({
      emailId: randomUUID(),
      sender: stranger,
      receivedAt,
    });
    state.networkFailure = new WakePolicyError("policy_read_failed");
    expectCode(
      await rejection(policy.admit(email(), signal)),
      "policy_read_failed",
    );
    expectCode(
      await rejection(policy.admit(email(), signal)),
      "policy_read_failed",
    );
    expect(state.networkReads).toBe(1);

    clock += 1000;
    state.networkFailure = undefined;
    expect(await policy.admit(email(), signal)).toEqual({ kind: "denied" });
    expect(state.networkReads).toBe(2);
  });

  it("reports cancellation by the signal's reason", async () => {
    const { state, policy } = harness();
    const controller = new AbortController();
    const reason = new Error("receiver stopped");
    state.networkFailure = new WakePolicyError("policy_read_failed");
    state.onNetworkRead = () => controller.abort(reason);
    const error = await policy
      .admit(
        { emailId: randomUUID(), sender: stranger, receivedAt },
        controller.signal,
      )
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );
    expect(error).toBe(reason);
  });

  it("fails the recheck when permission changed after admission", async () => {
    const { state, policy } = harness();
    const decision = await policy.admit(
      { emailId: randomUUID(), sender: contact, receivedAt },
      signal,
    );
    if (decision.kind === "denied") throw new Error("expected admission");
    const confirm = await policy.recheck(decision, signal);
    state.page = { data: [], cursor: null };
    expectCode(
      await rejection(policy.recheck(decision, signal)),
      "permission_changed",
    );
    let stale: unknown;
    try {
      confirm();
    } catch (error) {
      stale = error;
    }
    expect(stale).toBeInstanceOf(WakePolicyError);
    expectCode(stale as WakePolicyError, "permission_changed");
  });

  it("rechecks only admissions it issued", async () => {
    const { policy } = harness();
    const forged: WakeAdmission = {
      kind: "allowed",
      emailId: randomUUID(),
      sender: contact,
      receivedAt,
    };
    await expect(policy.recheck(forged, signal)).rejects.toBeInstanceOf(
      TypeError,
    );
  });

  it("rejects a recipient that is not an email address", () => {
    expect(() =>
      createWakePolicy({
        recipient: "agent",
        readContactPolicy: async () => ({}),
        readContactPage: async () => ({ data: [], cursor: null }),
        readNetworkAdmission: async () => notAdmitted,
      }),
    ).toThrow(TypeError);
  });

  it("rejects an email without a valid ID or received time", async () => {
    const { policy } = harness();
    await expect(
      policy.admit({ emailId: "42", sender: contact, receivedAt }, signal),
    ).rejects.toBeInstanceOf(TypeError);
    await expect(
      policy.admit(
        { emailId: randomUUID(), sender: contact, receivedAt: "yesterday" },
        signal,
      ),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
