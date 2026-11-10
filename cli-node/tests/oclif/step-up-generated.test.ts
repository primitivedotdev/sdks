import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The terminal: interactive, with a person who pastes `pasted` at the prompt.
const terminal = vi.hoisted(() => ({
  pasted: "tok-9",
  prompts: 0,
  opened: [] as string[],
}));
vi.mock("../../src/oclif/step-up-approval.js", async (original) => {
  const actual =
    await original<typeof import("../../src/oclif/step-up-approval.js")>();
  return {
    ...actual,
    terminalApprovalIo: (
      options: Parameters<typeof actual.terminalApprovalIo>[0],
    ) => ({
      ...actual.terminalApprovalIo(options),
      interactive: !options.json,
      open: (url: string) => terminal.opened.push(url),
      prompt: async () => {
        terminal.prompts += 1;
        return terminal.pasted;
      },
      write: () => undefined,
    }),
  };
});

import { COMMANDS } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");
const APPROVAL_URL = "https://app.example.test/app/settings/step-up?purpose=x";

type Sent = {
  method: string;
  url: string;
  body: string;
  stepUp: string | null;
};
let sent: Sent[] = [];
let refuseEvery = false;
let home = "";
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  sent = [];
  refuseEvery = false;
  terminal.pasted = "tok-9";
  terminal.prompts = 0;
  terminal.opened = [];
  home = mkdtempSync(join(tmpdir(), "primitive-step-up-"));
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("PRIMITIVE_")) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
  }
  Object.assign(process.env, {
    PRIMITIVE_API_KEY: "prim_test_step_up",
    PRIMITIVE_API_BASE_URL: "https://api.step-up.test/v1",
    PRIMITIVE_CONFIG_DIR: join(home, "primitive"),
    PRIMITIVE_SKIP_NEW_VERSION_CHECK: "true",
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request ? input : new Request(input, init);
      sent.push({
        method: request.method,
        url: request.url,
        body: await request.clone().text(),
        stepUp: request.headers.get("Primitive-Step-Up"),
      });
      const refuse = refuseEvery || sent.length === 1;
      return Response.json(
        refuse
          ? {
              success: false,
              error: {
                code: "step_up_required",
                message: "Approve this request in the browser.",
                details: { step_up_url: APPROVAL_URL },
              },
            }
          : { success: true, data: { id: "ep_1" } },
        { status: refuse ? 403 : 200 },
      );
    }),
  );
  vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  vi.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("PRIMITIVE_")) delete process.env[name];
  }
  for (const [name, value] of Object.entries(saved)) {
    if (value !== undefined) process.env[name] = value;
  }
  process.exitCode = undefined;
  rmSync(home, { force: true, recursive: true });
});

async function run(id: string, argv: string[]): Promise<void> {
  await (
    COMMANDS[id] as unknown as {
      run(argv: string[], options: { root: string }): Promise<unknown>;
    }
  ).run(argv, { root: CLI_ROOT });
}

const UPDATE = [
  "--id",
  "00000000-0000-4000-8000-000000000001",
  "--url",
  "https://example.com/hook",
];

describe("browser approval on a generated command", () => {
  it("asks for the token and sends the same request once more with it", async () => {
    await run("endpoints:update", UPDATE);
    expect(process.exitCode ?? 0).toBe(0);
    expect(terminal.prompts).toBe(1);
    expect(terminal.opened).toEqual([APPROVAL_URL]);
    expect(sent).toHaveLength(2);
    expect(sent[0]?.stepUp).toBeNull();
    expect(sent[1]?.stepUp).toBe("tok-9");
    expect(sent[1]?.method).toBe(sent[0]?.method);
    expect(sent[1]?.url).toBe(sent[0]?.url);
    expect(sent[1]?.body).toBe(sent[0]?.body);
  });

  it("does not open the browser with --no-browser", async () => {
    await run("endpoints:update", [...UPDATE, "--no-browser"]);
    expect(terminal.opened).toEqual([]);
    expect(sent).toHaveLength(2);
  });

  it("retries at most once", async () => {
    refuseEvery = true;
    await run("endpoints:create", ["--url", "https://example.com/hook"]);
    expect(sent).toHaveLength(2);
    expect(process.exitCode).toBe(1);
  });

  it("sends nothing more when no token is pasted, or one that cannot be sent", async () => {
    for (const pasted of ["", "tok\nX", "tok\u0001X"]) {
      sent = [];
      process.exitCode = undefined;
      terminal.pasted = pasted;
      await run("endpoints:update", UPDATE);
      expect(sent, JSON.stringify(pasted)).toHaveLength(1);
      expect(process.exitCode).toBe(1);
    }
  });

  it("offers the approval flags on webhook writes", () => {
    for (const id of ["endpoints:create", "endpoints:update"]) {
      const flags = (
        COMMANDS[id] as unknown as {
          flags: Record<string, { aliases?: string[] }>;
        }
      ).flags;
      expect(flags["step-up-token"]?.aliases, id).toEqual([
        "primitive-step-up",
      ]);
      expect(flags.browser, id).toBeDefined();
    }
  });

  it("drops whitespace around a pasted token, a Windows line ending included", async () => {
    terminal.pasted = "\t tok-9 \r\n";
    await run("endpoints:update", UPDATE);
    expect(sent.map((s) => s.stepUp)).toEqual([null, "tok-9"]);
  });

  it("never prompts with a token already given", async () => {
    await run("endpoints:update", [...UPDATE, "--step-up-token", "given"]);
    expect(terminal.prompts).toBe(0);
    expect(sent.map((s) => s.stepUp)).toEqual(["given"]);
  });
});
