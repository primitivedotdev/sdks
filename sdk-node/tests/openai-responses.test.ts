import { describe, expect, it } from "vitest";
import { extractResponsesOutputText } from "../src/openai-responses.js";

describe("extractResponsesOutputText", () => {
  describe("SDK convenience shape", () => {
    it("returns output_text when present and non-empty", () => {
      const response = {
        id: "resp_123",
        output_text: "Hello from the SDK convenience field.",
      };
      expect(extractResponsesOutputText(response)).toBe(
        "Hello from the SDK convenience field.",
      );
    });

    it("ignores empty output_text and falls through to output[] walk", () => {
      const response = {
        output_text: "",
        output: [
          {
            content: [{ type: "output_text", text: "Real text" }],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Real text");
    });

    it("ignores non-string output_text and falls through to output[] walk", () => {
      const response = {
        output_text: null,
        output: [
          {
            content: [{ type: "output_text", text: "Real text" }],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Real text");
    });
  });

  describe("raw REST output[] walk", () => {
    it("extracts text from { type: 'output_text', text: '...' } (Responses API)", () => {
      const response = {
        id: "resp_abc",
        output: [
          {
            type: "message",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: "The Responses API REST shape.",
              },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe(
        "The Responses API REST shape.",
      );
    });

    it("extracts text from { type: 'text', text: { value: '...' } } (Assistants style)", () => {
      const response = {
        output: [
          {
            content: [
              {
                type: "text",
                text: { value: "Assistants-style nested value." },
              },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe(
        "Assistants-style nested value.",
      );
    });

    it("extracts text from { type: 'text', text: '...' } (variant)", () => {
      const response = {
        output: [
          {
            content: [
              {
                type: "text",
                text: "Plain text variant.",
              },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Plain text variant.");
    });

    it("concatenates multiple pieces across one output entry in order", () => {
      const response = {
        output: [
          {
            content: [
              { type: "output_text", text: "Hello, " },
              { type: "output_text", text: "world!" },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Hello, world!");
    });

    it("concatenates across multiple output entries in order", () => {
      const response = {
        output: [
          { content: [{ type: "output_text", text: "First. " }] },
          { content: [{ type: "output_text", text: "Second." }] },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("First. Second.");
    });

    it("skips pieces that don't carry usable text but still returns the rest", () => {
      const response = {
        output: [
          {
            content: [
              { type: "image", image_url: "..." }, // no text
              { type: "output_text", text: "Kept." },
              { type: "text", text: { value: "Also kept." } },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Kept.Also kept.");
    });

    it("skips output entries that aren't objects", () => {
      const response = {
        output: [
          null,
          "not an object",
          42,
          {
            content: [{ type: "output_text", text: "Survived." }],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Survived.");
    });

    it("skips output entries with non-array content", () => {
      const response = {
        output: [
          { content: "not an array" },
          { content: [{ type: "output_text", text: "Found it." }] },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Found it.");
    });

    it("skips empty-string text fragments inside content[]", () => {
      const response = {
        output: [
          {
            content: [
              { type: "output_text", text: "" },
              { type: "output_text", text: "Only this." },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Only this.");
    });
  });

  describe("error cases", () => {
    it("throws when called with null", () => {
      expect(() => extractResponsesOutputText(null)).toThrow(
        /expected a parsed JSON object, got null/,
      );
    });

    it("throws when called with undefined", () => {
      expect(() => extractResponsesOutputText(undefined)).toThrow(
        /expected a parsed JSON object, got undefined/,
      );
    });

    it("throws when called with a string", () => {
      expect(() => extractResponsesOutputText("not json")).toThrow(
        /expected a parsed JSON object, got string/,
      );
    });

    it("throws when called with a number", () => {
      expect(() => extractResponsesOutputText(42)).toThrow(
        /expected a parsed JSON object, got number/,
      );
    });

    it("throws when the response has no output_text and no output[]", () => {
      expect(() => extractResponsesOutputText({ id: "resp_x" })).toThrow(
        /could not find assistant text/,
      );
    });

    it("throws when output[] exists but no content piece carries text", () => {
      const response = {
        output: [
          {
            content: [
              { type: "image", image_url: "..." },
              { type: "tool_call", id: "call_1" },
            ],
          },
        ],
      };
      expect(() => extractResponsesOutputText(response)).toThrow(
        /could not find assistant text/,
      );
    });

    it("throws when every text fragment is the empty string", () => {
      const response = {
        output_text: "",
        output: [
          {
            content: [
              { type: "output_text", text: "" },
              { type: "text", text: { value: "" } },
            ],
          },
        ],
      };
      // Empty string is the exact footgun this helper exists to surface,
      // so we'd rather throw than return "".
      expect(() => extractResponsesOutputText(response)).toThrow(
        /could not find assistant text/,
      );
    });

    it("ignores pieces whose type is not output_text or text", () => {
      // A future piece kind that happens to carry a `text` field must NOT
      // be silently concatenated. Only the documented types contribute.
      const response = {
        output: [
          {
            content: [
              { type: "annotation_echo", text: "should NOT be included" },
              { type: "output_text", text: "Real text." },
            ],
          },
        ],
      };
      expect(extractResponsesOutputText(response)).toBe("Real text.");
    });

    it("throws on an array at the top level (not a Responses object)", () => {
      // typeof [] is "object" so the null/non-object guard does not reject
      // it, but the output_text/output walks both find nothing. We let the
      // walk fall through to the standard error so the caller sees a
      // shape-mismatch message, not a top-level type error. That keeps the
      // error message useful when a caller passes the wrong field of a
      // larger envelope.
      expect(() => extractResponsesOutputText([])).toThrow(
        /could not find assistant text/,
      );
    });
  });
});
