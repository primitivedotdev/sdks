import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import { otherParticipants } from "../../src/oclif/email-participants.js";

function detail(parsed: Record<string, unknown>): EmailDetail {
  return {
    from_email: "owner@example.com",
    parsed: { status: "complete", attachments: [], ...parsed },
  } as unknown as EmailDetail;
}

describe("otherParticipants", () => {
  it("lists every other To and Cc address once, without you or the sender", () => {
    expect(
      otherParticipants(
        detail({
          to_addresses: [
            { address: "agent-a@example.com", name: "A" },
            { address: "Agent-B@Example.com", name: null },
          ],
          cc: [
            "owner@example.com",
            "agent-b@example.com",
            { address: "agent-c@example.com" },
            { address: "not an address" },
            42,
          ],
          bcc: [{ address: "hidden@example.com" }],
        }),
        "agent-a@example.com",
      ),
    ).toEqual(["agent-b@example.com", "agent-c@example.com"]);
  });

  it("is empty for one-to-one mail and for mail that does not name you", () => {
    expect(
      otherParticipants(
        detail({ to_addresses: [{ address: "agent-a@example.com" }] }),
        "agent-a@example.com",
      ),
    ).toEqual([]);
    // A blind copy: To and Cc name others, never you.
    expect(
      otherParticipants(
        detail({
          to_addresses: [{ address: "agent-b@example.com" }],
          cc: [{ address: "agent-c@example.com" }],
        }),
        "agent-a@example.com",
      ),
    ).toEqual([]);
    expect(otherParticipants(detail({}), "agent-a@example.com")).toEqual([]);
  });
});
