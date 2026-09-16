import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { describe, expect, it } from "vitest";
import {
  classifySignalContent,
  type SignalContentBodies,
  type SignalContentInventory,
} from "../../src/interactions/index.js";
import { parseEmailWithAttachments } from "../../src/parser/attachment-parser.js";

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
it("classifies a real MIME fixture using its complete body and inventory", async () => {
  const mime = readFileSync(
    new URL("../../../test-fixtures/signal-content.eml", import.meta.url),
  );
  const parsed = await parseEmailWithAttachments(mime, {
    generateAttachmentId: () => "fixture",
    skipHtmlSanitization: true,
  });
  expect(parsed.attachments).toHaveLength(1);
  const result = classifySignalContent({
    inventory: {
      status: "complete",
      parts: parsed.attachments.map(({ filename, contentType }) => ({
        filename,
        contentType,
      })),
    },
    bodies: {
      status: "complete",
      text: parsed.bodyText,
      html: parsed.bodyHtml,
    },
    canonicalPartBytes: parsed.attachments[0]?.content ?? null,
  });
  expect(result.classification).toBe("informational_only");
  expect(result.interaction?.source?.text).toContain('"protocol": "read"');
});
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
