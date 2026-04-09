import { beforeEach, describe, expect, it, vi } from "vitest";

const addHook = vi.fn();
const sanitize = vi.fn((html: string) => html);

vi.mock("isomorphic-dompurify", () => ({
  default: {
    addHook,
    sanitize,
  },
}));

vi.mock("mailparser", () => ({
  simpleParser: vi.fn(),
}));

describe("attachment-parser DOMPurify hooks", () => {
  beforeEach(() => {
    addHook.mockClear();
    sanitize.mockClear();
    vi.resetModules();
  });

  it("registers hooks and applies rel for target blank anchors", async () => {
    await import("../../src/parser/attachment-parser.js");

    const afterHook = addHook.mock.calls.find(
      ([name]) => name === "afterSanitizeAttributes",
    )?.[1] as
      | ((node: {
          tagName: string;
          getAttribute: (name: string) => string | null;
          setAttribute: (name: string, value: string) => void;
        }) => void)
      | undefined;

    expect(afterHook).toBeDefined();

    const setAttribute = vi.fn();
    afterHook?.({
      tagName: "A",
      getAttribute: (name: string) => (name === "target" ? "_blank" : null),
      setAttribute,
    });

    expect(setAttribute).toHaveBeenCalledWith("rel", "noopener noreferrer");
  });
});
