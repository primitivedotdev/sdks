import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  canOfferCopyHotkey,
  copyToClipboard,
  formatBrowserLoginInstructions,
  listenForCopyHotkey,
  osc52Sequence,
  runClipboardCommand,
} from "../../src/oclif/browser-login-prompt.js";

const START = {
  user_code: "ABCD-EFGH",
  verification_uri: "https://primitive.dev/cli",
  verification_uri_complete: "https://primitive.dev/cli?code=ABCD-EFGH",
};

class FakeInput extends EventEmitter {
  isTTY = true;
  rawMode = false;
  paused = true;
  setRawMode(mode: boolean) {
    this.rawMode = mode;
    return this;
  }
  pause() {
    this.paused = true;
    return this;
  }
  resume() {
    this.paused = false;
    return this;
  }
}

function fakeOutput(isTTY = true) {
  const chunks: string[] = [];
  return {
    chunks,
    isTTY,
    write: (chunk: string | Uint8Array) => {
      chunks.push(chunk.toString());
      return true;
    },
  };
}

describe("formatBrowserLoginInstructions", () => {
  it("keeps the URL visible and offers copy when the browser auto-opens", () => {
    const text = formatBrowserLoginInstructions({
      copyHotkey: true,
      openedBrowser: true,
      start: START,
    });

    expect(text).toBe(
      [
        "Your sign-in code is: ABCD-EFGH",
        "Opening Primitive in your browser...",
        "",
        "Browser didn't open, or want a different one? Use this URL (c to copy):",
        "  https://primitive.dev/cli?code=ABCD-EFGH",
        "On another device, go to https://primitive.dev/cli and enter ABCD-EFGH.",
        "",
        "",
      ].join("\n"),
    );
  });

  it("omits the copy hint when there is no terminal to read keys from", () => {
    const text = formatBrowserLoginInstructions({
      copyHotkey: false,
      openedBrowser: true,
      start: START,
    });

    expect(text).not.toContain("c to copy");
    expect(text).toContain("  https://primitive.dev/cli?code=ABCD-EFGH\n");
  });

  it("does not claim to open a browser with --no-browser", () => {
    const text = formatBrowserLoginInstructions({
      copyHotkey: true,
      openedBrowser: false,
      start: START,
    });

    expect(text).not.toContain("Opening Primitive");
    expect(text).toContain(
      "Open this URL in any browser to sign in (c to copy):",
    );
  });

  it("skips the other-device line when both URLs are the same", () => {
    const text = formatBrowserLoginInstructions({
      copyHotkey: false,
      openedBrowser: true,
      start: { ...START, verification_uri: START.verification_uri_complete },
    });

    expect(text).not.toContain("On another device");
  });
});

describe("canOfferCopyHotkey", () => {
  it("requires a TTY on both sides", () => {
    expect(canOfferCopyHotkey(new FakeInput(), fakeOutput(true))).toBe(true);
    expect(canOfferCopyHotkey(new FakeInput(), fakeOutput(false))).toBe(false);
    const piped = new FakeInput();
    piped.isTTY = false;
    expect(canOfferCopyHotkey(piped, fakeOutput(true))).toBe(false);
  });
});

describe("copyToClipboard", () => {
  it("always emits OSC 52 and reports the native copy", async () => {
    const output = fakeOutput();
    const how = await copyToClipboard(
      START.verification_uri_complete,
      output,
      async () => true,
    );

    expect(how).toBe("native");
    expect(output.chunks).toEqual([
      osc52Sequence(START.verification_uri_complete),
    ]);
    expect(osc52Sequence("hi")).toBe("\u001b]52;c;aGk=\u0007");
  });

  it("falls back to the terminal clipboard when no native command works", async () => {
    const output = fakeOutput();
    expect(await copyToClipboard("x", output, async () => false)).toBe(
      "terminal",
    );
  });
});

describe("listenForCopyHotkey", () => {
  it("copies the URL on c and restores the terminal on dispose", async () => {
    const input = new FakeInput();
    const output = fakeOutput();
    const copy = vi.fn(async () => "native" as const);

    const dispose = listenForCopyHotkey({
      copy,
      input,
      output,
      url: START.verification_uri_complete,
    });
    expect(input.rawMode).toBe(true);
    expect(input.paused).toBe(false);

    input.emit("data", Buffer.from("x"));
    input.emit("data", Buffer.from("C"));
    await vi.waitFor(() =>
      expect(output.chunks).toContain(
        "Copied the sign-in URL to your clipboard.\n",
      ),
    );
    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).toHaveBeenCalledWith(START.verification_uri_complete, output);

    dispose();
    expect(input.rawMode).toBe(false);
    expect(input.paused).toBe(true);
    expect(input.listenerCount("data")).toBe(0);
  });

  it("re-raises Ctrl+C as SIGINT after restoring the terminal", () => {
    const input = new FakeInput();
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    try {
      listenForCopyHotkey({ input, output: fakeOutput(), url: "u" });
      input.emit("data", Buffer.from("\u0003"));

      expect(input.rawMode).toBe(false);
      expect(kill).toHaveBeenCalledWith(process.pid, "SIGINT");
    } finally {
      kill.mockRestore();
    }
  });

  it("handles Ctrl+C that arrives in the same chunk as other keys", () => {
    const input = new FakeInput();
    const copy = vi.fn(async () => "native" as const);
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    try {
      listenForCopyHotkey({ copy, input, output: fakeOutput(), url: "u" });
      input.emit("data", Buffer.from("c\u0003"));

      expect(kill).toHaveBeenCalledWith(process.pid, "SIGINT");
      expect(copy).not.toHaveBeenCalled();
      expect(input.rawMode).toBe(false);
    } finally {
      kill.mockRestore();
    }
  });

  it("copies once for a chunk with several keys", async () => {
    const input = new FakeInput();
    const copy = vi.fn(async () => "native" as const);
    const dispose = listenForCopyHotkey({
      copy,
      input,
      output: fakeOutput(),
      url: "u",
    });
    input.emit("data", Buffer.from("xcC"));
    await vi.waitFor(() => expect(copy).toHaveBeenCalledTimes(1));
    dispose();
  });

  it.skipIf(process.platform === "win32")(
    "suspends on Ctrl+Z and re-enters raw mode on SIGCONT",
    () => {
      const input = new FakeInput();
      const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
      try {
        const dispose = listenForCopyHotkey({
          input,
          output: fakeOutput(),
          url: "u",
        });
        input.emit("data", Buffer.from("\u001a"));

        expect(input.rawMode).toBe(false);
        expect(kill).toHaveBeenCalledWith(process.pid, "SIGTSTP");

        process.emit("SIGCONT", "SIGCONT");
        expect(input.rawMode).toBe(true);
        expect(input.listenerCount("data")).toBe(1);

        dispose();
        expect(process.listenerCount("SIGCONT")).toBe(0);
      } finally {
        kill.mockRestore();
      }
    },
  );
});

describe("runClipboardCommand", () => {
  it("returns false when the tool exits successfully without reading its input", async () => {
    await expect(
      runClipboardCommand(
        process.execPath,
        ["-e", "process.exit(0)"],
        "x".repeat(1 << 22),
      ),
    ).resolves.toBe(false);
  });

  it("returns false when the tool is missing", async () => {
    await expect(
      runClipboardCommand("primitive-no-such-clipboard-tool", [], "x"),
    ).resolves.toBe(false);
  });

  it("returns true when the tool reads the text and succeeds", async () => {
    await expect(
      runClipboardCommand(
        process.execPath,
        ["-e", "process.stdin.resume().on('end', () => process.exit(0))"],
        "x",
      ),
    ).resolves.toBe(true);
  });
});
