import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  type EmailSearchMeta,
  type EmailSearchResult,
  PrimitiveClient,
  searchEmails,
} from "../../src/api/index.js";

const key = ["fixture", "credential"].join("-");

type Page = {
  success: true;
  data: EmailSearchResult[];
  meta: EmailSearchMeta;
};

const pages = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/email-search-pages.json", import.meta.url),
    "utf8",
  ),
) as { counted: Page; uncounted: Page };

type Parameter = { name?: string; schema?: Record<string, unknown> };
type Document = {
  paths: Record<string, Record<string, { parameters?: Parameter[] }>>;
};

function serve(page: Page): {
  fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  urls: URL[];
} {
  const urls: URL[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    urls.push(new URL((input as Request).url));
    return Response.json(page);
  });
  return { fetcher, urls };
}

// What a strict caller has to write now that `total` can be null: the
// count is only absent when the request opted out of it.
function describeTotal(meta: EmailSearchMeta): string {
  if (meta.total === null) return "not counted";
  return `${meta.total}${meta.total_capped ? "+" : ""}`;
}

describe("email search options", () => {
  it("sends thread_id, prefix and count as query parameters", async () => {
    const { fetcher, urls } = serve(pages.uncounted);
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const threadId = "5c1e9a7d-3b2f-4e8a-b6d4-9f0c2a1e7b35";

    await searchEmails({
      client: client.client,
      query: {
        q: "quarterly invoi",
        thread_id: threadId,
        prefix: "true",
        count: "false",
        include_facets: "false",
      },
    });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(urls[0]?.pathname).toBe("/v1/emails/search");
    expect(urls[0]?.searchParams.get("q")).toBe("quarterly invoi");
    expect(urls[0]?.searchParams.get("thread_id")).toBe(threadId);
    expect(urls[0]?.searchParams.get("prefix")).toBe("true");
    expect(urls[0]?.searchParams.get("count")).toBe("false");
    expect(urls[0]?.searchParams.get("include_facets")).toBe("false");
  });

  it("omits the new parameters when not asked for", async () => {
    const { fetcher, urls } = serve(pages.counted);
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    await searchEmails({ client: client.client, query: { q: "invoice" } });

    for (const name of ["thread_id", "prefix", "count"]) {
      expect(urls[0]?.searchParams.has(name)).toBe(false);
    }
  });

  it("decodes thread_id, direction and a counted total", async () => {
    const { fetcher } = serve(pages.counted);
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    const result = await searchEmails({
      client: client.client,
      query: { q: "invoice" },
    });

    const page = result.data;
    expect(page?.data[0]?.thread_id).toBe(
      "5c1e9a7d-3b2f-4e8a-b6d4-9f0c2a1e7b35",
    );
    expect(page?.data[0]?.direction).toBe("inbound");
    expect(page?.meta.total).toBe(1);
    expect(page && describeTotal(page.meta)).toBe("1");
  });

  it("decodes a null total and a null thread_id when count=false", async () => {
    const { fetcher } = serve(pages.uncounted);
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });

    const result = await searchEmails({
      client: client.client,
      query: { q: "invoi", prefix: "true", count: "false" },
    });

    const page = result.data;
    expect(page?.meta.total).toBeNull();
    expect(page?.meta.total_capped).toBe(false);
    expect(page?.meta.cursor).toBe("next-page-cursor");
    expect(page?.data[0]?.thread_id).toBeNull();
    expect(page && describeTotal(page.meta)).toBe("not counted");
  });

  it("declares the parameters and their defaults in the published document", async () => {
    const { openapiDocument } = await import("../../src/openapi/index.js");
    const parameters =
      (openapiDocument as unknown as Document).paths["/emails/search"]?.get
        ?.parameters ?? [];
    const byName = new Map(parameters.map((p) => [p.name, p.schema]));

    expect(byName.get("thread_id")).toEqual({
      type: "string",
      format: "uuid",
    });
    expect(byName.get("prefix")).toMatchObject({ default: "false" });
    expect(byName.get("count")).toMatchObject({ default: "true" });
  });
});
