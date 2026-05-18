import { describe, expect, it, vi } from "vitest";
import ReplyCommand from "../../src/oclif/commands/reply.js";
import SendCommand from "../../src/oclif/commands/send.js";
import { resolveMessageBodies } from "../../src/oclif/message-body-sources.js";

describe("resolveMessageBodies", () => {
  it("accepts direct text and HTML bodies together", () => {
    expect(
      resolveMessageBodies({ body: "hello", html: "<p>hello</p>" }),
    ).toEqual({
      body: "hello",
      html: "<p>hello</p>",
      kind: "ok",
    });
  });

  it("reads body and HTML from files as exact UTF-8 text", () => {
    const result = resolveMessageBodies({
      bodyFile: "message.txt",
      htmlFile: "message.html",
      readFile: (path) => {
        if (path === "message.txt") return "plain\n";
        if (path === "message.html") return "<p>plain</p>\n";
        throw new Error(`unexpected path ${path}`);
      },
    });

    expect(result).toEqual({
      body: "plain\n",
      html: "<p>plain</p>\n",
      kind: "ok",
    });
  });

  it("reads one body source from stdin without trimming content", () => {
    const result = resolveMessageBodies({
      bodyStdin: true,
      readStdin: () => "line 1\nline 2\n",
    });

    expect(result).toEqual({ body: "line 1\nline 2\n", kind: "ok" });
  });

  it("rejects ambiguous sources for the same field before reading files", () => {
    const readFile = vi.fn(() => "from-file");

    const result = resolveMessageBodies({
      body: "direct",
      bodyFile: "message.txt",
      readFile,
    });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--body");
      expect(result.message).toContain("--body-file");
    }
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects consuming stdin for both text and HTML bodies", () => {
    const result = resolveMessageBodies({
      bodyStdin: true,
      htmlStdin: true,
      readStdin: () => "unused",
    });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("Stdin can only be consumed once");
    }
  });

  it("reports file read errors with the flag label", () => {
    const result = resolveMessageBodies({
      bodyFile: "missing.txt",
      readFile: () => {
        throw new Error("ENOENT");
      },
    });

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("--body-file");
      expect(result.message).toContain("ENOENT");
    }
  });
});

describe("message body source flags", () => {
  it("adds file and stdin body flags to send", () => {
    expect(SendCommand.flags["body-file"]).toBeDefined();
    expect(SendCommand.flags["body-stdin"]).toBeDefined();
    expect(SendCommand.flags["html-file"]).toBeDefined();
    expect(SendCommand.flags["html-stdin"]).toBeDefined();
  });

  it("adds file and stdin body flags to reply", () => {
    expect(ReplyCommand.flags["body-file"]).toBeDefined();
    expect(ReplyCommand.flags["body-stdin"]).toBeDefined();
    expect(ReplyCommand.flags["html-file"]).toBeDefined();
    expect(ReplyCommand.flags["html-stdin"]).toBeDefined();
  });
});
