import { createHash, randomUUID } from "node:crypto";
import type { EmailDetail } from "@primitivedotdev/api-core";
import { describe, expect, it, vi } from "vitest";
import {
  contactReference,
  isContactAcceptance,
  MAX_CONTACT_BYTES,
  parseContactInteraction,
  prepareContactAcceptance,
  prepareContactRequest,
  readContactInteraction,
} from "../../src/oclif/contact-interactions.js";

const now = Date.parse("2026-09-28T12:00:00.000Z");
const encode = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value));
function request() {
  return prepareContactRequest(
    "research@example.test",
    "Coordinate public research",
    300,
    now,
  );
}
function email(bytes: Uint8Array): EmailDetail {
  return {
    id: randomUUID(),
    parsed: {
      status: "complete",
      attachments: [
        {
          filename: "interaction.json",
          content_type: "application/json",
          part_index: 2,
          size_bytes: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        },
      ],
    },
  } as EmailDetail;
}
const signal = new AbortController().signal;

describe("contact request email controls", () => {
  it("correlates acceptance by interaction, previous step and expiry, independently of prose", () => {
    const sent = request(),
      accepted = prepareContactAcceptance(sent),
      reference = contactReference(sent);
    expect(parseContactInteraction(encode(sent), now)).toEqual(sent);
    expect(parseContactInteraction(encode(accepted), now)).toEqual(accepted);
    expect(accepted.step_id).not.toBe(sent.step_id);
    expect(isContactAcceptance(accepted, reference)).toBe(true);
    expect(isContactAcceptance(sent, reference)).toBe(false);
    for (const field of [
      "interaction_id",
      "prev_step_id",
      "expires_at",
    ] as const) {
      expect(
        isContactAcceptance({ ...accepted, [field]: "different" }, reference),
      ).toBe(false);
    }
  });

  it.each([
    { step: "ack" },
    { protocol: "other.contact" },
    { protocol_version: 2 },
    { prev_step_id: "another-step" },
    { payload: { reason: "" } },
    { payload: { reason: "hello", authority: "owner" } },
    { payload: [] },
    { expires_at: null },
    { expires_at: "not-a-time" },
    { expires_at: new Date(now).toISOString() },
    { expires_at: new Date(now + 8 * 86400000).toISOString() },
  ])("does not admit malformed or unsupported request %#", (patch) => {
    expect(
      parseContactInteraction(encode({ ...request(), ...patch }), now),
    ).toBeNull();
  });

  it("bounds encoded output, including multibyte reasons, before sending", () => {
    expect(() =>
      prepareContactRequest("research@example.test", " ", 300, now),
    ).toThrow();
    expect(() =>
      prepareContactRequest("research@example.test", "hello", 59, now),
    ).toThrow();
    expect(() =>
      prepareContactRequest("research@example.test", "hello", 604801, now),
    ).toThrow();
    expect(() =>
      prepareContactRequest(
        "research@example.test",
        "😀".repeat(2000),
        300,
        now,
      ),
    ).toThrow();
    expect(
      parseContactInteraction(new Uint8Array(MAX_CONTACT_BYTES + 1), now),
    ).toBeNull();
    expect(
      parseContactInteraction(new TextEncoder().encode("{broken"), now),
    ).toBeNull();
  });

  it("fetches exactly the authenticated attachment index and verifies its digest", async () => {
    const control = request(),
      bytes = encode(control),
      detail = email(bytes);
    const read = vi.fn(async () => bytes);
    expect(await readContactInteraction(detail, read, signal, now)).toEqual(
      control,
    );
    expect(read).toHaveBeenCalledExactlyOnceWith(detail.id, 2, signal);
    const changed = bytes.slice();
    changed[changed.length - 2] ^= 1;
    await expect(
      readContactInteraction(detail, async () => changed, signal, now),
    ).rejects.toThrow(/integrity/);
    await expect(
      readContactInteraction(detail, async () => bytes.slice(1), signal, now),
    ).rejects.toThrow(/integrity/);
  });

  it.each([
    { filename: "other.json" },
    { content_type: "text/plain" },
    { part_index: -1 },
    { part_index: 0.5 },
    { size_bytes: 0 },
    { size_bytes: MAX_CONTACT_BYTES + 1 },
    { sha256: "unverified" },
  ])("rejects unsafe attachment inventory before downloading %#", async (patch) => {
    const bytes = encode(request()),
      detail = email(bytes);
    const part = detail.parsed?.attachments?.[0];
    if (!part) throw new Error("Missing fixture attachment");
    Object.assign(part, patch);
    const read = vi.fn(async () => bytes);
    expect(await readContactInteraction(detail, read, signal, now)).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it("does not choose between conflicting canonical parts or treat incomplete parsing as absence", async () => {
    const bytes = encode(request()),
      detail = email(bytes),
      read = vi.fn(async () => bytes);
    const parts = detail.parsed?.attachments;
    const first = parts?.[0];
    if (!parts || !first) throw new Error("Missing fixture attachment");
    parts.push({
      ...first,
      part_index: 3,
    });
    expect(await readContactInteraction(detail, read, signal, now)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    await expect(
      readContactInteraction(
        {
          ...detail,
          parsed: { ...detail.parsed, status: "failed" },
        } as EmailDetail,
        read,
        signal,
        now,
      ),
    ).rejects.toThrow(/incomplete/);
  });
});
