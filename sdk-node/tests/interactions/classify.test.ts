import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { simpleParser } from "mailparser";
import { describe, expect, it } from "vitest";
import {
  classifySignalContent,
  type SignalContentBodies,
  type SignalContentInventory,
} from "../../src/interactions/index.js";

interface Fixture {
  name: string;
  inventory: SignalContentInventory;
  bodies: SignalContentBodies;
  source?: string;
  hex?: string;
  padding?: number;
  classification: string;
  reason: string;
  interactionStatus: string | null;
}
const fixtures: Fixture[] = JSON.parse(
  readFileSync(
    new URL("../../../test-fixtures/signal-content.json", import.meta.url),
    "utf8",
  ),
);
function bytes(item: Fixture): Uint8Array | null {
  if (item.hex !== undefined)
    return Uint8Array.from(Buffer.from(item.hex, "hex"));
  return item.source === undefined
    ? null
    : new TextEncoder().encode(item.source + " ".repeat(item.padding ?? 0));
}
describe("shared signal content", () => {
  for (const item of fixtures)
    it(item.name, () => {
      const raw = bytes(item);
      const result = classifySignalContent({
        inventory: item.inventory,
        bodies: item.bodies,
        canonicalPartBytes: raw,
      });
      expect(result.classification).toBe(item.classification);
      expect(result.reason).toBe(item.reason);
      expect(result.interaction?.status ?? null).toBe(item.interactionStatus);
      if (result.interaction && result.interaction.status !== "invalid") {
        expect(result.interaction.source?.bytes).toEqual(raw);
        expect(result.interaction.source?.bytes).not.toBe(raw);
      }
    });
});
for (const extra of [
  null,
  {
    filename: "signature.asc",
    contentType: "application/pgp-signature",
    inline: false,
    body: "c2lnbmF0dXJl",
  },
  {
    filename: "pixel.png",
    contentType: "image/png",
    inline: true,
    body: "cGl4ZWw=",
  },
  {
    filename: "empty.bin",
    contentType: "application/octet-stream",
    inline: false,
    body: "",
  },
]) {
  it(`classifies real MIME with ${extra?.filename ?? "only the signal"} using the full inventory`, async () => {
    let mime = readFileSync(
      new URL("../../../test-fixtures/signal-content.eml", import.meta.url),
      "utf8",
    );
    if (extra) {
      const part = [
        "--signal-classification-fixture",
        `Content-Type: ${extra.contentType}`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: ${extra.inline ? "inline" : "attachment"}; filename="${extra.filename}"`,
        ...(extra.inline ? ["Content-ID: <pixel@example.com>"] : []),
        "",
        extra.body,
        "",
      ].join("\n");
      mime = mime.replace(
        "--signal-classification-fixture--",
        `${part}--signal-classification-fixture--`,
      );
    }
    // Read every MIME attachment, including signatures and inline CID parts.
    // A filtered or retained-only attachment list cannot establish completeness.
    const parsed = await simpleParser(
      Buffer.from(mime.replace(/\n/g, "\r\n")),
      {
        skipImageLinks: true,
        skipTextToHtml: true,
        skipHtmlToText: true,
      },
    );
    expect(parsed.attachments).toHaveLength(extra ? 2 : 1);
    if (extra) {
      expect(parsed.attachments[1]?.filename).toBe(extra.filename);
      expect(parsed.attachments[1]?.content.length).toBe(
        Buffer.from(extra.body, "base64").length,
      );
      if (extra.inline)
        expect(parsed.attachments[1]?.contentId).toBe("<pixel@example.com>");
    }
    const result = classifySignalContent({
      inventory: {
        status: "complete",
        parts: parsed.attachments.map(({ filename, contentType }) => ({
          filename: filename ?? null,
          contentType,
        })),
      },
      bodies: {
        status: "complete",
        text: parsed.text ?? null,
        html: parsed.html || null,
      },
      canonicalPartBytes: parsed.attachments[0]?.content ?? null,
    });
    expect(result.classification).toBe(
      extra ? "mixed_or_unsupported" : "informational_only",
    );
    expect(result.reason).toBe(
      extra ? "additional_parts" : "informational_signal",
    );
    expect(result.interaction?.source?.text).toContain('"protocol": "read"');
  });
}
it("classifies without a Node runtime and retains unknown protocol source", async () => {
  const item = fixtures.find((item) => item.name === "unsupported protocol");
  if (!item) throw new Error("fixture");
  const result = await build({
    entryPoints: [
      new URL("../../src/interactions/index.ts", import.meta.url).pathname,
    ],
    platform: "browser",
    bundle: true,
    write: false,
    format: "iife",
    globalName: "interactions",
  });
  const context = {
    TextEncoder,
    TextDecoder,
    Uint8Array,
    input: {
      inventory: item.inventory,
      bodies: item.bodies,
      canonicalPartBytes: bytes(item),
    },
    result: undefined,
  };
  runInNewContext(
    `${result.outputFiles[0]?.text}\nresult=interactions.classifySignalContent(input)`,
    context,
  );
  expect(context.result).toMatchObject({
    classification: "mixed_or_unsupported",
    reason: "unsupported_signal",
    interaction: { status: "valid", source: { text: item.source } },
  });
});
