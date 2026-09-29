import { createHash, randomUUID } from "node:crypto";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { PrimitiveApiClient } from "@primitivedotdev/api-core";
import { describe, expect, it } from "vitest";
import {
  contactReference,
  prepareContactAcceptance,
  prepareContactRequest,
} from "../../src/oclif/contact-interactions.js";
import { inspectTargetedReply } from "../../src/oclif/targeted-replies.js";

function fixture(now = Date.now()) {
  const from = "local@example.com",
    recipient = "peer@example.net",
    sentId = randomUUID(),
    id = randomUUID();
  const request = prepareContactRequest(
    from,
    "Public research collaboration",
    600,
    now,
  );
  const acceptance = prepareContactAcceptance(request);
  const bytes = Buffer.from(JSON.stringify(acceptance));
  const detail = {
    id,
    sender: recipient,
    domain: "example.com",
    created_at: new Date().toISOString(),
    webhook_attempt_count: 0,
    replies: [],
    reply_count: 0,
    last_replied_at: null,
    awaiting: "you",
    automated: false,
    automated_reasons: [],
    reply_to_sent_email_id: sentId,
    recipient: from,
    to_email: from,
    from_email: recipient,
    sender_connected_agent_verified: false,
    from_header: recipient,
    status: "completed",
    received_at: new Date(now + 1000).toISOString(),
    body_text: "Accepted",
    parsed: {
      status: "complete",
      attachments: [
        {
          filename: "interaction.json",
          content_type: "application/json",
          part_index: 0,
          size_bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    },
    auth: {
      dmarc: "pass",
      dmarcFromDomain: "example.net",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      spf: "pass",
      dkimSignatures: [],
    },
  } as EmailDetail;
  const paths: string[] = [];
  const apiClient = new PrimitiveApiClient({
    apiBaseUrl: "https://example.test/v1",
    fetch: async (input, init) => {
      const path = new URL(new Request(input, init).url).pathname;
      paths.push(path);
      if (path === `/v1/emails/${id}`)
        return Response.json({ success: true, data: detail });
      if (path === `/v1/emails/${id}/attachments/0`) return new Response(bytes);
      throw new Error(`Unexpected ${path}`);
    },
  });
  return {
    params: { apiClient, from, recipient, sentId, id },
    detail,
    paths,
    reference: contactReference(request),
  };
}

describe("typed exact contact acceptance waits", () => {
  it("keeps a contact acceptance from completing an ordinary task wait", async () => {
    const f = fixture();
    expect(await inspectTargetedReply(f.params)).toMatchObject({
      kind: "inspection",
    });
    expect(f.paths).toEqual([`/v1/emails/${f.params.id}`]);
  });
  it("accepts only the exact authenticated parent plus contact interaction and request step", async () => {
    const f = fixture();
    expect(
      await inspectTargetedReply({ ...f.params, contactRequest: f.reference }),
    ).toMatchObject({ kind: "reply", email: { id: f.params.id } });
    expect(f.paths).toHaveLength(2);
    expect(
      await inspectTargetedReply({
        ...f.params,
        contactRequest: { ...f.reference, stepId: randomUUID() },
      }),
    ).toMatchObject({ kind: "inspection" });
  });
  it("rejects wrong parent and sender before fetching any control attachment", async () => {
    const f = fixture();
    f.detail.reply_to_sent_email_id = randomUUID();
    expect(
      await inspectTargetedReply({ ...f.params, contactRequest: f.reference }),
    ).toMatchObject({ kind: "unrelated" });
    f.detail.reply_to_sent_email_id = f.params.sentId;
    f.detail.from_header = "different@example.net";
    expect(
      await inspectTargetedReply({ ...f.params, contactRequest: f.reference }),
    ).toMatchObject({ kind: "unrelated" });
    expect(f.paths.every((path) => !path.includes("attachments"))).toBe(true);
  });
  it("does not interpret an ordinary task response as contact acceptance", async () => {
    const f = fixture();
    f.detail.parsed = { status: "complete", attachments: [] };
    expect(
      await inspectTargetedReply({ ...f.params, contactRequest: f.reference }),
    ).toMatchObject({ kind: "inspection" });
  });
  it("recovers a timely acceptance after expiry but rejects arrivals at or after expiry", async () => {
    const f = fixture(Date.now() - 3600_000);
    expect(Date.parse(f.reference.expiresAt)).toBeLessThan(Date.now());
    expect(
      await inspectTargetedReply({ ...f.params, contactRequest: f.reference }),
    ).toMatchObject({ kind: "reply", email: { id: f.params.id } });
    for (const delay of [0, 1]) {
      f.detail.received_at = new Date(
        Date.parse(f.reference.expiresAt) + delay,
      ).toISOString();
      expect(
        await inspectTargetedReply({
          ...f.params,
          contactRequest: f.reference,
        }),
      ).toMatchObject({ kind: "inspection" });
    }
  });
});
