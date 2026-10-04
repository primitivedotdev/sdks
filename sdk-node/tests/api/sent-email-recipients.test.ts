import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  getSentEmail,
  PrimitiveClient,
  type SentEmailDetail,
} from "../../src/api/index.js";

const RECIPIENT_FIELDS = [
  "to_addresses",
  "cc",
  "bcc",
  "reply_to",
  "tags",
] as const;

const sentFixture = JSON.parse(
  readFileSync(
    new URL(
      "../../../test-fixtures/sent-email-attachment.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { data: SentEmailDetail };

const cases = JSON.parse(
  readFileSync(
    new URL(
      "../../../test-fixtures/sent-email-recipients.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as Array<{ name: string; fields: Partial<SentEmailDetail> }>;

for (const item of cases) {
  it(`decodes sent email recipient lists: ${item.name}`, async () => {
    const data = { ...sentFixture.data, ...item.fields };
    const client = new PrimitiveClient({
      fetch: async () => Response.json({ success: true, data }),
    });
    const result = await getSentEmail({
      client: client.client,
      path: { id: sentFixture.data.id },
    });
    const detail = result.data?.data;
    // Typed access: these compile only while the schema declares the fields.
    const to: string[] | null | undefined = detail?.to_addresses;
    const cc: string[] | null | undefined = detail?.cc;
    const bcc: string[] | null | undefined = detail?.bcc;
    const replyTo: string[] | null | undefined = detail?.reply_to;
    const tags: Array<{ name: string; value: string }> | null | undefined =
      detail?.tags;
    expect({ to, cc, bcc, replyTo, tags }).toEqual({
      to: item.fields.to_addresses,
      cc: item.fields.cc,
      bcc: item.fields.bcc,
      replyTo: item.fields.reply_to,
      tags: item.fields.tags,
    });
    for (const field of RECIPIENT_FIELDS) {
      expect(Object.hasOwn(detail ?? {}, field)).toBe(
        Object.hasOwn(item.fields, field),
      );
    }
    expect(JSON.parse(JSON.stringify(detail))).toEqual(data);
  });
}
