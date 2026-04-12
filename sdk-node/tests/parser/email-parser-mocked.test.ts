import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("email-parser mocked branches", () => {
  it("handles structured and fallback header values", async () => {
    const { simpleParser } = await import("mailparser");
    vi.mocked(simpleParser).mockResolvedValue({
      headers: new Map<string, unknown>([
        ["date", new Date("2025-01-01T00:00:00.000Z")],
        [
          "address-list",
          { value: [{ address: "a@example.com" }, "b@example.com"] },
        ],
        ["content-type", { value: "text/plain" }],
        ["x-complex", { value: { nested: true } }],
        ["x-unknown", { nested: true }],
        ["x-number", 42],
      ]),
      from: [{ text: "first@example.com" }, { text: "second@example.com" }],
      to: undefined,
      subject: "Mocked",
      text: "Body",
      html: { toString: () => "<p>Body</p>" },
      messageId: "<mocked@example.com>",
      date: new Date("2025-01-01T00:00:00.000Z"),
    } as never);

    const { parseEmail } = await import("../../src/parser/email-parser.js");
    const result = await parseEmail("irrelevant");

    expect(result.from).toBe("first@example.com, second@example.com");
    expect(result.to).toBe("");
    expect(result.html).toBe("<p>Body</p>");
    expect(result.headers.date).toBe("2025-01-01T00:00:00.000Z");
    expect(result.headers["address-list"]).toBe("a@example.com, b@example.com");
    expect(result.headers["content-type"]).toBe("text/plain");
    expect(result.headers["x-complex"]).toBe('{"value":{"nested":true}}');
    expect(result.headers["x-unknown"]).toBe('{"nested":true}');
    expect(result.headers["x-number"]).toBe("42");
  });

  it("handles array header values and direct address objects", async () => {
    const { simpleParser } = await import("mailparser");
    vi.mocked(simpleParser).mockResolvedValue({
      headers: new Map<string, unknown>([["received", ["mx1", "mx2"]]]),
      from: { text: "sender@example.com" },
      to: { text: "recipient@example.com" },
      subject: undefined,
      text: undefined,
      html: undefined,
      messageId: undefined,
      date: undefined,
    } as never);

    const { parseEmail } = await import("../../src/parser/email-parser.js");
    const result = await parseEmail("irrelevant");

    expect(result.from).toBe("sender@example.com");
    expect(result.to).toBe("recipient@example.com");
    expect(result.headers.received).toEqual(["mx1", "mx2"]);
  });

  it("handles nullish and missing address entries inside address lists", async () => {
    const { simpleParser } = await import("mailparser");
    vi.mocked(simpleParser).mockResolvedValue({
      headers: new Map<string, unknown>([
        ["address-list", { value: [null, undefined, { name: "Only Name" }] }],
      ]),
      from: [{ text: "" }],
      to: { text: "" },
      subject: undefined,
      text: undefined,
      html: undefined,
      messageId: undefined,
      date: undefined,
    } as never);

    const { parseEmail } = await import("../../src/parser/email-parser.js");
    const result = await parseEmail("irrelevant");

    expect(result.from).toBe("");
    expect(result.to).toBe("");
    expect(result.headers["address-list"]).toBe("");
  });

  it("joins repeated structured address headers and address arrays", async () => {
    const { simpleParser } = await import("mailparser");
    vi.mocked(simpleParser).mockResolvedValue({
      headers: new Map<string, unknown>([
        ["to", [{ text: "first@example.com" }, { text: "second@example.com" }]],
      ]),
      from: { text: "sender@example.com" },
      to: [{ text: "first@example.com" }, { text: "second@example.com" }],
      subject: "Repeated recipients",
      text: "Body",
      html: undefined,
      messageId: undefined,
      date: undefined,
    } as never);

    const { parseEmail } = await import("../../src/parser/email-parser.js");
    const result = await parseEmail("irrelevant");

    expect(result.to).toBe("first@example.com, second@example.com");
    expect(result.headers.to).toBe("first@example.com, second@example.com");
  });
});
