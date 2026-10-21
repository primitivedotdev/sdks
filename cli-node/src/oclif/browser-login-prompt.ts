import { spawn } from "node:child_process";

export type BrowserLoginStart = {
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
};

type Output = Pick<NodeJS.WriteStream, "write"> & { isTTY?: boolean };

type Input = {
  isTTY?: boolean;
  off(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  pause(): unknown;
  resume(): unknown;
  setRawMode?: (mode: boolean) => unknown;
};

export function openBrowser(url: string): void {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", () => undefined);
  child.unref();
}

/**
 * The copy-URL hotkey needs raw keypresses from a terminal and a terminal
 * to show the hint on. Anything else (CI, agents, piped output) gets the
 * plain URL and never blocks on input.
 */
export function canOfferCopyHotkey(input: Input, output: Output): boolean {
  return Boolean(
    input.isTTY && output.isTTY && typeof input.setRawMode === "function",
  );
}

export function formatBrowserLoginInstructions(params: {
  copyHotkey: boolean;
  openedBrowser: boolean;
  start: BrowserLoginStart;
}): string {
  const { copyHotkey, openedBrowser, start } = params;
  const copyHint = copyHotkey ? " (c to copy)" : "";
  const lines = [`Your sign-in code is: ${start.user_code}`];
  if (openedBrowser) {
    lines.push(
      "Opening Primitive in your browser...",
      "",
      `Browser didn't open, or want a different one? Use this URL${copyHint}:`,
    );
  } else {
    lines.push("", `Open this URL in any browser to sign in${copyHint}:`);
  }
  lines.push(`  ${start.verification_uri_complete}`);
  if (start.verification_uri !== start.verification_uri_complete) {
    lines.push(
      `On another device, go to ${start.verification_uri} and enter ${start.user_code}.`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

/**
 * OSC 52 asks the terminal emulator itself to set the clipboard, so it
 * works over SSH, where a local clipboard command would copy on the
 * remote host instead of the machine the user is sitting at.
 */
export function osc52Sequence(text: string): string {
  return `\u001b]52;c;${Buffer.from(text, "utf8").toString("base64")}\u0007`;
}

function nativeClipboardCommand(): [string, string[]] | null {
  if (process.env.SSH_CONNECTION || process.env.SSH_TTY) return null;
  if (process.platform === "darwin") return ["pbcopy", []];
  if (process.platform === "win32") return ["clip", []];
  if (process.env.WAYLAND_DISPLAY) return ["wl-copy", []];
  if (process.env.DISPLAY) return ["xclip", ["-selection", "clipboard"]];
  return null;
}

/**
 * Resolves false on any failure, including a tool that exits before
 * reading its input (EPIPE on stdin), so the caller falls back to OSC 52
 * instead of the error taking down login.
 */
export function runClipboardCommand(
  command: string,
  args: string[],
  text: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    let inputFailed = false;
    const child = spawn(command, args, {
      stdio: ["pipe", "ignore", "ignore"],
    });
    child.on("error", () => resolve(false));
    child.stdin.on("error", () => {
      inputFailed = true;
    });
    child.on("close", (code) => resolve(code === 0 && !inputFailed));
    child.stdin.end(text);
  });
}

function copyWithNativeClipboard(text: string): Promise<boolean> {
  const command = nativeClipboardCommand();
  if (!command) return Promise.resolve(false);
  return runClipboardCommand(command[0], command[1], text);
}

/**
 * Copies via the native clipboard when running locally and always emits
 * OSC 52 as well. Terminals without OSC 52 support (macOS Terminal.app)
 * are covered by the native path; SSH sessions are covered by OSC 52.
 */
export async function copyToClipboard(
  text: string,
  output: Output,
  native: (text: string) => Promise<boolean> = copyWithNativeClipboard,
): Promise<"native" | "terminal"> {
  output.write(osc52Sequence(text));
  return (await native(text)) ? "native" : "terminal";
}

const CTRL_C = "\u0003";
const CTRL_Z = "\u001a";

/**
 * Listens for `c` while the CLI polls for browser approval. Raw mode turns
 * Ctrl+C and Ctrl+Z into plain input, so they are handled here: Ctrl+C is
 * re-raised as SIGINT, and Ctrl+Z restores the terminal, suspends with
 * SIGTSTP, and re-enters raw mode on SIGCONT. Several keys can arrive in
 * one chunk (pastes, SSH), so every character is checked. Returns a
 * disposer that restores the terminal.
 */
export function listenForCopyHotkey(params: {
  input: Input;
  output: Output;
  url: string;
  copy?: (text: string, output: Output) => Promise<"native" | "terminal">;
}): () => void {
  const { input, output, url } = params;
  const copy = params.copy ?? copyToClipboard;
  let disposed = false;

  const copyUrl = () => {
    void copy(url, output).then((how) => {
      if (disposed) return;
      output.write(
        how === "native"
          ? "Copied the sign-in URL to your clipboard.\n"
          : "Sent the sign-in URL to your terminal's clipboard. If nothing was copied, select the URL above instead.\n",
      );
    });
  };

  const onContinue = () => {
    if (!disposed) input.setRawMode?.(true);
  };

  const suspend = () => {
    input.setRawMode?.(false);
    process.once("SIGCONT", onContinue);
    process.kill(process.pid, "SIGTSTP");
  };

  const onData = (chunk: Buffer | string) => {
    let wantsCopy = false;
    for (const key of chunk.toString()) {
      if (key === CTRL_C) {
        dispose();
        process.kill(process.pid, "SIGINT");
        return;
      }
      if (key === CTRL_Z && process.platform !== "win32") {
        if (wantsCopy) copyUrl();
        suspend();
        return;
      }
      if (key === "c" || key === "C") wantsCopy = true;
    }
    if (wantsCopy) copyUrl();
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    input.off("data", onData);
    process.off("SIGCONT", onContinue);
    input.setRawMode?.(false);
    input.pause();
  };

  input.setRawMode?.(true);
  input.on("data", onData);
  input.resume();
  return dispose;
}
