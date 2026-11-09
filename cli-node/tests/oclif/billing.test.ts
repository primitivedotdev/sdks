import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ openBrowser: vi.fn() }));
vi.mock("../../src/oclif/browser-login-prompt.js", async (original) => ({
  ...(await original<
    typeof import("../../src/oclif/browser-login-prompt.js")
  >()),
  openBrowser: mocks.openBrowser,
}));

import BillingCommand, {
  BILLING_CLI_NOTE,
  billingPageUrl,
  canOpenBrowser,
} from "../../src/oclif/commands/billing.js";
import { COMMANDS } from "../../src/oclif/index.js";

const root = resolve(import.meta.dirname, "../..");
const API = "https://api.primitive.dev/v1";
const PAGE = "https://primitive.dev/app/settings/billing";

function captureLog(): string[] {
  const output: string[] = [];
  vi.spyOn(console, "log").mockImplementation((value: unknown) => {
    output.push(String(value));
  });
  return output;
}

function setStdoutTty(value: boolean | undefined): void {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value,
  });
}

const originalTty = process.stdout.isTTY;

afterEach(() => {
  setStdoutTty(originalTty);
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mocks.openBrowser.mockReset();
});

describe("billingPageUrl", () => {
  it.each([
    [API, PAGE],
    [
      "https://api.primitive-staging-1.com/v1",
      "https://primitive-staging-1.com/app/settings/billing",
    ],
    ["http://localhost:4000/v1", "http://localhost:4000/app/settings/billing"],
  ])("maps %s to its dashboard page", (apiBaseUrl, page) => {
    expect(billingPageUrl(apiBaseUrl)).toBe(page);
  });
});

describe("canOpenBrowser", () => {
  it.each([
    ["a macOS terminal", {}, "darwin", true, true],
    ["a Linux desktop", { DISPLAY: ":0" }, "linux", true, true],
    ["Linux with no display", {}, "linux", true, false],
    ["piped output", {}, "darwin", false, false],
    ["CI", { CI: "true" }, "darwin", true, false],
    ["an SSH session", { SSH_TTY: "/dev/pts/1" }, "darwin", true, false],
  ] as const)("is decided for %s", (_case, env, platform, isTTY, expected) => {
    expect(canOpenBrowser(env, platform, isTTY)).toBe(expected);
  });
});

describe("billing command", () => {
  it("is registered", () => {
    expect(COMMANDS.billing).toBe(BillingCommand);
  });

  it("prints the link and the note with --no-browser", async () => {
    const output = captureLog();
    await BillingCommand.run(["--no-browser", "--api-base-url", API], { root });
    expect(mocks.openBrowser).not.toHaveBeenCalled();
    expect(output).toEqual([PAGE, BILLING_CLI_NOTE]);
  });

  it("opens the page where a browser can open", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("SSH_CONNECTION", "");
    vi.stubEnv("SSH_TTY", "");
    vi.stubEnv("DISPLAY", ":0");
    setStdoutTty(true);
    const output = captureLog();
    await BillingCommand.run(["--api-base-url", API], { root });
    expect(mocks.openBrowser).toHaveBeenCalledWith(PAGE);
    expect(output.join("\n")).toContain(PAGE);
    expect(output.join("\n")).toContain(BILLING_CLI_NOTE);
  });
});
