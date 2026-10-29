import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PrimitiveHelp, { FULL_HELP_COMMANDS } from "../../src/oclif/help.js";
import { COMMANDS } from "../../src/oclif/index.js";

const pkgRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const MAX_LINES = 40;
const MAX_BYTES = 3000;

// oclif rewrites cached command ids while rendering, so each render gets a fresh config.
async function renderHelp(argv: string[]): Promise<string> {
  const config = await Config.load(pkgRoot);
  let out = "";
  // oclif writes help through console.log, one call per line.
  const spy = vi.spyOn(console, "log").mockImplementation((...args) => {
    out += `${args.map(String).join(" ")}\n`;
  });
  try {
    await new PrimitiveHelp(config).showHelp(argv);
  } finally {
    spy.mockRestore();
  }
  return out;
}

const commandHelp = (id: string, flag = "--help") =>
  renderHelp([...id.split(":"), flag]);

const oneLine = (text: string) => text.replaceAll(/\s+/g, " ");

let isTTY: boolean;
beforeEach(() => {
  isTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: false,
  });
});
afterEach(() => {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: isTTY,
  });
});

describe("short command help", () => {
  it("fits every command in one screen", async () => {
    const over: string[] = [];
    for (const id of Object.keys(COMMANDS)) {
      if (FULL_HELP_COMMANDS.has(id)) continue;
      const help = await commandHelp(id);
      const lines = help.trimEnd().split("\n").length;
      const bytes = Buffer.byteLength(help);
      expect(help, id).toContain(
        `Full help: primitive ${id.replaceAll(":", " ")} --help-full`,
      );
      if (lines > MAX_LINES || bytes > MAX_BYTES)
        over.push(`${id}: ${lines} lines, ${bytes} bytes`);
    }
    expect(over).toEqual([]);
  });

  it("prints one line per flag, clipped to 100 columns off a terminal", async () => {
    const help = await commandHelp("reply");
    expect(help).toContain(
      "Reply to an inbound email\n\nUSAGE\n  $ primitive reply [flags]",
    );
    expect(help).toMatch(
      /^ {2}-a, --attachment=<value>\.\.\. +Attach a file to the reply\.$/m,
    );
    expect(help).toMatch(
      /^ {2}--recipient-stop, --no-recipient-stop +With --repeat-every/m,
    );
    expect(help).not.toContain("The API derives recipients");
    for (const line of help.split("\n"))
      expect(line.length).toBeLessThanOrEqual(100);
  });

  it("keeps the rules the parser enforces on each flag", async () => {
    const help = await commandHelp("reply");
    expect(help).toMatch(
      /^ {2}--id=<value> +\(exactly one of --id, --thread\) Inbound email id to reply to\.$/m,
    );
    expect(help).toMatch(
      /^ {2}--thread=<value> +\(exactly one of --id, --thread\) /m,
    );
  });

  it("keeps piped examples", async () => {
    expect(await commandHelp("chat")).toContain(
      "$ cat error.log | primitive chat help@agent.acme.dev",
    );
  });

  it("answers -h the same as --help", async () => {
    expect(await commandHelp("reply", "-h")).toBe(await commandHelp("reply"));
  });

  it("keeps the full text behind --help-full", async () => {
    const full = oneLine(await commandHelp("reply", "--help-full"));
    expect(full).toContain(
      "The API derives recipients, the Re: subject, and threading headers from the inbound email id.",
    );
    expect(full).toContain("exit 4 uncertain");
    expect(full).not.toContain("Full help:");
    expect(oneLine(await renderHelp(["help", "reply", "--help-full"]))).toBe(
      full,
    );
  });
});

// Code already installed on users' machines reads these commands' --help to
// decide whether the CLI is capable, so their default help must keep matching.
const SKILL_PREFLIGHT = path.join(
  pkgRoot,
  "vendor/skills/primitive-connect/scripts/check-cli-capabilities.mjs",
);
const SKILL_PREFLIGHT_PATTERNS: Record<string, readonly RegExp[]> = {
  "agent:connect": [
    /--session\b/,
    /--receiver\b/,
    /poll installs nothing/i,
    /installs the exact Claude session's fail-open Stop hook/i,
    /resume SessionStart hook/i,
  ],
  "agent:enroll": [
    /--session\b/,
    /--receiver\b/,
    /--name\b/,
    /\bpoll\b/,
    /exact Claude session, install a fail-open Stop hook/i,
    /resume SessionStart hook/i,
  ],
  listen: [
    /external mail events at tool-output authority/i,
    /never synthetic user messages/i,
    /--wake\b/,
    /--hook-session\b/,
    /--notify-session\b/,
    /--background\b/,
  ],
  "network:peers": [/discover listed peers/i, /--owner\b/],
  "agent:check-mail": [/since its previous check/i],
  wait: [/--code\b/, /--link\b/],
};
const WAKE_HOOK = path.join(pkgRoot, "bin/claude-wake.mjs");
const WAKE_HOOK_LISTEN_MARKERS = [
  "--once",
  "--wake",
  "--hook-session",
  "--events",
  "primitive-hook-profile-bound-v2",
];

describe("help read as a capability check", () => {
  it("mirrors every pattern in the bundled skill's preflight", () => {
    const source = readFileSync(SKILL_PREFLIGHT, "utf8");
    const inScript = source
      .split("\n")
      .filter(
        (line) => line.includes("patterns") || line.includes(".test(wait)"),
      )
      .flatMap((line) => [
        ...line.matchAll(/\/((?:\\.|[^/\\\n])+)\/i?(?=[,\]).])/g),
      ])
      .map((match) => match[1]);
    const mirrored = Object.values(SKILL_PREFLIGHT_PATTERNS).flatMap(
      (patterns) => patterns.map((pattern) => pattern.source),
    );
    expect(new Set(mirrored)).toEqual(new Set(inScript));
  });

  it("satisfies the bundled skill's preflight", async () => {
    for (const [id, patterns] of Object.entries(SKILL_PREFLIGHT_PATTERNS)) {
      const help = oneLine(await commandHelp(id));
      for (const pattern of patterns)
        expect(help, `${id} ${pattern}`).toMatch(pattern);
    }
  });

  it("satisfies the Claude wake hook's listen check", async () => {
    const hook = readFileSync(WAKE_HOOK, "utf8");
    expect(hook).toContain('[cli, "listen", "--help"]');
    for (const marker of WAKE_HOOK_LISTEN_MARKERS)
      expect(hook).toContain(`"${marker}"`);
    const help = await commandHelp("listen");
    for (const marker of WAKE_HOOK_LISTEN_MARKERS)
      expect(help).toContain(marker);
  });
});
