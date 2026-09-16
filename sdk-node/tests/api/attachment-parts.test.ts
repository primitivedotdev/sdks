import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AttachmentPartDownload,
  downloadEmailAttachmentPart,
  downloadSentAttachmentPart,
  PrimitiveApiError,
  PrimitiveClient,
} from "../../src/api/index.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/attachment-part.json", import.meta.url),
    "utf8",
  ),
) as {
  id: string;
  part_index: number;
  bytes: number[];
  sha256: string;
  content_disposition: string;
};
const key = ["fixture", "credential"].join("-");
function response() {
  return new Response(Uint8Array.from(fixture.bytes), {
    headers: {
      "content-type": "application/octet-stream",
      "x-content-sha256": fixture.sha256,
      "content-disposition": fixture.content_disposition,
      "cache-control": "private, no-store",
    },
  });
}
afterEach(() => vi.restoreAllMocks());

describe("attachment part downloads", () => {
  it.each([
    "inbound",
    "outbound",
  ] as const)("preserves exact %s bytes and metadata through the portable method", async (direction) => {
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const request = input as Request;
      expect(request.url).toBe(
        `https://api.primitive.dev/v1/${direction === "inbound" ? "emails" : "sent-emails"}/${fixture.id}/attachments/7`,
      );
      expect(request.headers.get("authorization")).toBe(`Bearer ${key}`);
      const result = response();
      vi.spyOn(result, "blob").mockImplementation(() => {
        throw new Error("Blob conversion is unavailable");
      });
      return result;
    });
    const client = new PrimitiveClient({ apiKey: key, fetch: fetcher });
    const result = await (direction === "inbound"
      ? client.downloadEmailAttachmentPart(fixture.id, fixture.part_index)
      : client.downloadSentAttachmentPart(fixture.id, fixture.part_index));
    expect([...result.bytes]).toEqual(fixture.bytes);
    expect(result.sha256).toBe(fixture.sha256);
    expect(result.contentDisposition).toBe(fixture.content_disposition);
    expect(result.cacheControl).toBe("private, no-store");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    downloadEmailAttachmentPart,
    downloadSentAttachmentPart,
  ])("preserves bytes in the generated binary operation", async (operation) => {
    const client = new PrimitiveClient({
      apiKey: key,
      fetch: async () => response(),
    });
    const result = await operation({
      client: client.client,
      path: { id: fixture.id, part_index: fixture.part_index },
    });
    expect(result.data).toBeInstanceOf(Blob);
    if (!result.data) throw new Error("Missing attachment bytes");
    expect([...new Uint8Array(await result.data.arrayBuffer())]).toEqual(
      fixture.bytes,
    );
    expect(result.response?.headers.get("x-content-sha256")).toBe(
      fixture.sha256,
    );
  });

  it("runs the browser bundle without Buffer, Blob, or Node globals", async () => {
    const bundle = await build({
      entryPoints: [
        fileURLToPath(new URL("../../src/api/index.ts", import.meta.url)),
      ],
      bundle: true,
      platform: "browser",
      format: "iife",
      globalName: "PortableSDK",
      write: false,
    });
    const result = (await runInNewContext(
      `${bundle.outputFiles[0]?.text}\nnew PortableSDK.PrimitiveClient({fetch}).downloadEmailAttachmentPart(id, 7)`,
      {
        ArrayBuffer,
        Uint8Array,
        TextEncoder,
        TextDecoder,
        URL,
        Headers,
        Request,
        AbortSignal,
        AbortController,
        id: fixture.id,
        fetch: async () => response(),
      },
    )) as AttachmentPartDownload;
    expect([...result.bytes]).toEqual(fixture.bytes);
  });

  it("rejects invalid metadata indexes before dispatch", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new PrimitiveClient({ fetch: fetcher });
    for (const part of [
      -1,
      0.5,
      2147483648,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      await expect(
        client.downloadEmailAttachmentPart(fixture.id, part),
      ).rejects.toThrow("partIndex");
      await expect(
        client.downloadSentAttachmentPart(fixture.id, part),
      ).rejects.toThrow("partIndex");
    }
    await expect(
      client.downloadEmailAttachmentPart("../other", 0),
    ).rejects.toThrow("UUID");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("accepts the maximum metadata index and empty original content", async () => {
    const client = new PrimitiveClient({
      fetch: async (input) => {
        expect((input as Request).url).toContain("/attachments/2147483647");
        return new Response(new Uint8Array(), {
          headers: { "content-type": "application/octet-stream" },
        });
      },
    });
    expect(
      (await client.downloadEmailAttachmentPart(fixture.id, 2147483647)).bytes,
    ).toHaveLength(0);
  });

  it.each([
    [400, "validation_error"],
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [409, "attachment_changed"],
    [410, "content_discarded"],
    [413, "attachment_limit_exceeded"],
    [502, "attachment_integrity_failed"],
    [503, "attachment_not_ready"],
    [503, "attachment_storage_unavailable"],
  ])("preserves HTTP %s and %s without retrying", async (status, code) => {
    const fetcher = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: { code, message: "Attachment unavailable" },
          }),
          {
            status: Number(status),
            headers: { "content-type": "application/json", "retry-after": "3" },
          },
        ),
    );
    const client = new PrimitiveClient({ fetch: fetcher });
    await expect(
      client.downloadSentAttachmentPart(fixture.id, 7),
    ).rejects.toMatchObject({
      name: "PrimitiveApiError",
      status,
      code,
      retryAfter: 3,
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("preserves abort errors", async () => {
    const aborted = new DOMException("Cancelled", "AbortError");
    const client = new PrimitiveClient({
      fetch: async () => {
        throw aborted;
      },
    });
    await expect(
      client.downloadEmailAttachmentPart(fixture.id, 0),
    ).rejects.toBe(aborted);
    expect(aborted).not.toBeInstanceOf(PrimitiveApiError);
  });
});
