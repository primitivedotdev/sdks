import { describe, expect, it, vi } from "vitest";
import { listSentEmails, PrimitiveClient } from "../../src/api/index.js";

const key = ["fixture", "credential"].join("-");

type Parameter = { name?: string; schema?: Record<string, unknown> };
type Operation = {
  parameters?: Parameter[];
  responses?: Record<string, unknown>;
};
type Document = { paths: Record<string, Record<string, Operation>> };

async function sentEmailsGet(): Promise<Operation | undefined> {
  const { openapiDocument } = await import("../../src/openapi/index.js");
  return (openapiDocument as unknown as Document).paths["/sent-emails"]?.get;
}

function capture(): {
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  urls: URL[];
} {
  const urls: URL[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    urls.push(new URL((input as Request).url));
    return Response.json({ success: true, data: [], meta: { cursor: null } });
  });
  return { fetcher, urls };
}

describe("sent-email search parameters", () => {
  it("sends q and from as query parameters", async () => {
    const { fetcher, urls } = capture();
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    await listSentEmails({
      client: client.client,
      query: { q: "contract 10%_off", from: "joe@example.test" },
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(urls[0]?.pathname).toBe("/v1/sent-emails");
    // Sent verbatim: the server treats the text literally, so a client that
    // escaped or normalised it here would change which messages match.
    expect(urls[0]?.searchParams.get("q")).toBe("contract 10%_off");
    expect(urls[0]?.searchParams.get("from")).toBe("joe@example.test");
  });

  it("omits them when not asked for, and composes with the other filters", async () => {
    const { fetcher, urls } = capture();
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    await listSentEmails({ client: client.client, query: { limit: 10 } });
    expect(urls[0]?.searchParams.has("q")).toBe(false);
    expect(urls[0]?.searchParams.has("from")).toBe(false);

    await listSentEmails({
      client: client.client,
      query: { q: "invoice", status: "delivered", limit: 10 },
    });
    expect(urls[1]?.searchParams.get("q")).toBe("invoice");
    expect(urls[1]?.searchParams.get("status")).toBe("delivered");
    expect(urls[1]?.searchParams.get("limit")).toBe("10");
  });

  it("declares both parameters on the operation in the published document", async () => {
    // The typed surface and the served document are generated from one spec;
    // this is what would fail if a later edit dropped either from the contract
    // while leaving the generated client alone.
    const names = ((await sentEmailsGet())?.parameters ?? []).map(
      (p) => p.name,
    );
    expect(names).toContain("q");
    expect(names).toContain("from");
  });

  it("surfaces the capability 503 as a typed error, not an unexpected status", async () => {
    // The point of documenting the fallback is that a client can detect it.
    // Undeclared, a disabled deployment reached Python as UnexpectedStatus and
    // Go as an unexpected-status error, so the advice was unfollowable.
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code: "sent_mail_search_unavailable", message: "off" },
          }),
          { status: 503, headers: { "content-type": "application/json" } },
        ),
    );
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const result = await listSentEmails({
      client: client.client,
      query: { q: "contract" },
    });
    expect(result.response?.status).toBe(503);
    expect(result.error?.error?.code).toBe("sent_mail_search_unavailable");
  });

  it("declares that 503 distinctly from the retryable one", async () => {
    const responses = (await sentEmailsGet())?.responses ?? {};
    expect(Object.keys(responses)).toContain("503");
    // Not the shared ServiceUnavailable component, which means "temporarily
    // unable, retry": a client retrying this would loop against a permanent
    // answer.
    expect(JSON.stringify(responses["503"])).toContain(
      "sent_mail_search_unavailable",
    );
  });

  it("leaves q length validation to the server", async () => {
    // OpenAPI minLength/maxLength count Unicode code points on the value as
    // sent; the server trims first and counts UTF-16 code units. Declaring the
    // bounds made the generated validator disagree with the server in both
    // directions, so they are deliberately absent.
    const q = (await sentEmailsGet())?.parameters?.find((p) => p.name === "q");
    expect(q?.schema).toEqual({ type: "string" });
  });
});
