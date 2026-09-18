import { describe, expect, it, vi } from "vitest";
import {
  deleteSentEmail,
  PrimitiveClient,
  removeAgentConnection,
  replyToEmail,
} from "../../src/api/index.js";

const id = "11111111-1111-4111-8111-111111111111";
const address = "agent+demo@example.com";
const key = ["fixture", "credential"].join("-");

describe("mailbox deletion", () => {
  it.each([
    "sent",
    "connection",
  ] as const)("routes %s deletion without changing its meaning", async (kind) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.method).toBe(kind === "sent" ? "DELETE" : "POST");
      expect(new URL(request.url).pathname).toBe(
        kind === "sent"
          ? `/v1/sent-emails/${id}`
          : `/v1/agent-connections/${encodeURIComponent(address)}/remove`,
      );
      expect(request.headers.get("authorization")).toBe(`Bearer ${key}`);
      expect(await request.text()).toBe("");
      return Response.json({ success: true, data: { deleted: true } });
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const result =
      kind === "sent"
        ? await deleteSentEmail({ client: client.client, path: { id } })
        : await removeAgentConnection({
            client: client.client,
            path: { address },
          });
    expect(result.data?.data?.deleted).toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    [409, "sent_email_not_settled"],
    [503, "sent_email_cleanup_failed"],
  ] as const)("preserves DELETE %s without retry", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        { success: false, error: { code, message: "Cannot delete" } },
        { status },
      ),
    );
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const result = await deleteSentEmail({
      client: client.client,
      path: { id },
    });
    expect(result.response?.status).toBe(status);
    expect(result.error?.error.code).toBe(code);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    "send",
    "reply",
  ] as const)("preserves deleted %s refusal and never retries with a different key", async (kind) => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          success: false,
          error: {
            code: "sent_email_deleted",
            message: "Prior send deleted",
            details: { idempotent_replay: true },
          },
        },
        { status: 410 },
      ),
    );
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    if (kind === "send") {
      await expect(
        client.send(
          {
            from: "sender@example.com",
            to: "receiver@example.com",
            subject: "Example",
            bodyText: "Hello",
          },
          { idempotencyKey: "existing-key" },
        ),
      ).rejects.toMatchObject({
        status: 410,
        code: "sent_email_deleted",
        details: { idempotent_replay: true },
      });
    } else {
      const result = await replyToEmail({
        client: client.client,
        path: { id },
        body: { body_text: "Hello" },
        headers: { "Idempotency-Key": "existing-key" },
      });
      expect(result.response?.status).toBe(410);
      expect(result.error?.error).toMatchObject({
        code: "sent_email_deleted",
        details: { idempotent_replay: true },
      });
    }
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
