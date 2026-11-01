import { randomUUID } from "node:crypto";
import type { AgentNetworkContactAdmission } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { createWakePolicy, type NetworkAdmission } from "../src/receiver.js";
import { emptyContactPolicy } from "./oclif/contact-policy-fixture.js";

// The network reader returns the API's own response shape.
const apiDecisionFits: AgentNetworkContactAdmission extends NetworkAdmission
  ? true
  : false = true;

describe("primitive/receiver for a harness receiver", () => {
  it("runs the admit, recheck and confirm sequence a receiver uses", async () => {
    const address = "agent@example.com";
    const sender = "owner@example.com";
    const emailId = randomUUID();
    const reads: string[] = [];
    const contact = {
      agent_address: address,
      contact_address: sender,
      notify: true,
      notify_since: "2026-09-01T10:00:00.000Z",
      notification_generation: randomUUID(),
      version: randomUUID(),
    };
    // CLI JSON output, as a receiver that shells out to the CLI parses it.
    const json = async (args: readonly string[]): Promise<unknown> => {
      reads.push(args.slice(0, 2).join(" "));
      if (args[0] === "contacts") return emptyContactPolicy(address);
      if (args[0] === "agent")
        return {
          success: true,
          data: [contact],
          meta: { cursor: null },
        };
      return {
        allowed: false,
        pending: false,
        allowed_since: null,
        member_policy_required: false,
        sender_relation: undefined,
      };
    };
    const policy = createWakePolicy({
      recipient: address,
      contactRequests: false,
      readContactPolicy: () =>
        json(["contacts", "get-agent-contact-policy", "--agent-address"]),
      async readContactPage(cursor) {
        const page = (await json([
          "agent",
          "contacts",
          "list",
          ...(cursor === undefined ? [] : ["--cursor", cursor]),
        ])) as { data: unknown[]; meta: { cursor: string | null } };
        return { data: page.data, cursor: page.meta.cursor };
      },
      readNetworkAdmission: async (id, from) =>
        (await json([
          "agent-networks",
          "check-default-network-contact-admission",
          id,
          from,
        ])) as NetworkAdmission,
    });

    const signal = new AbortController().signal;
    const admission = await policy.admit(
      { emailId, sender, receivedAt: "2026-09-01T10:01:00.000Z" },
      signal,
    );
    if (admission.kind === "denied") throw new Error("expected admission");
    const request = admission.kind === "request";
    const confirm = await policy.recheck(admission, signal);
    confirm();
    expect({ apiDecisionFits, request, emailId: admission.emailId }).toEqual({
      apiDecisionFits: true,
      request: false,
      emailId,
    });
    expect(reads).toContain(
      "agent-networks check-default-network-contact-admission",
    );
  });
});
