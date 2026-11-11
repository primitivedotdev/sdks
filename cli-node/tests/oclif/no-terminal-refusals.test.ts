import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  question: vi.fn(),
  startAgentClaim: vi.fn(),
  verifyAgentClaim: vi.fn(),
}));
vi.mock("../../src/oclif/api-client.js", async (original) => ({
  ...(await original<typeof import("../../src/oclif/api-client.js")>()),
  createAuthenticatedCliApiClient: mocks.auth,
}));
vi.mock("node:readline/promises", () => ({
  createInterface: () => ({ question: mocks.question, close: () => {} }),
}));
vi.mock("@primitivedotdev/api-core", async (original) => ({
  ...(await original<typeof import("@primitivedotdev/api-core")>()),
  startAgentClaim: mocks.startAgentClaim,
  verifyAgentClaim: mocks.verifyAgentClaim,
}));

import AgentUpgradeCommand from "../../src/oclif/commands/agent-upgrade.js";
import OrgLeaveCommand from "../../src/oclif/commands/org-leave.js";
import { SignupConfirmCommand } from "../../src/oclif/commands/signup.js";

const root = resolve(import.meta.dirname, "../..");

const CLAIM_INSTEAD =
  "to send the code, then `primitive agent claim-verify --verification-code <code>`.";
const VERIFY_INSTEAD =
  "To use the code you have, run `primitive agent claim-verify --verification-code <code>`.";

// Run each command as a script or an agent does: no terminal on stdin or
// stderr, unless a case sets one. A refusal must come before any credential
// is read or request sent.
describe("commands that would prompt, run without a terminal", () => {
  let configDir: string;
  let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let stdinTTY: PropertyDescriptor | undefined;
  let stderrTTY: PropertyDescriptor | undefined;
  let exitCode: typeof process.exitCode;

  function setTerminals(
    stdin: boolean | undefined,
    stderr: boolean | undefined,
  ): void {
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: stdin,
    });
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: stderr,
    });
  }

  beforeEach(() => {
    exitCode = process.exitCode;
    configDir = join(
      mkdtempSync(join(tmpdir(), "primitive-cli-no-tty-test-")),
      "fresh",
    );
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", undefined);
    vi.stubEnv("PRIMITIVE_AGENT_ADDRESS", undefined);
    vi.stubEnv("PRIMITIVE_API_KEY", undefined);
    vi.stubEnv("UNSET_CODE_VARIABLE", undefined);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    stderrTTY = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
    setTerminals(undefined, undefined);
    fetchMock = vi.fn<typeof globalThis.fetch>(async () => {
      throw new Error("no request expected");
    });
    vi.stubGlobal("fetch", fetchMock);
    mocks.auth.mockReset();
    mocks.auth.mockRejectedValue(new Error("no credential expected"));
    mocks.question.mockReset();
    mocks.startAgentClaim.mockReset();
    mocks.verifyAgentClaim.mockReset();
  });

  afterEach(() => {
    for (const [stream, descriptor] of [
      [process.stdin, stdinTTY],
      [process.stderr, stderrTTY],
    ] as const) {
      if (descriptor) Object.defineProperty(stream, "isTTY", descriptor);
      else delete (stream as { isTTY?: boolean }).isTTY;
    }
    process.exitCode = exitCode;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(resolve(configDir, ".."), { force: true, recursive: true });
  });

  async function runFails(
    command: {
      run: (argv: string[], opts: { root: string }) => Promise<unknown>;
    },
    argv: string[],
  ): Promise<Errors.CLIError> {
    const error = await command.run(argv, { root }).then(
      () => null,
      (caught: unknown) => caught,
    );
    if (!(error instanceof Errors.CLIError)) {
      throw new Error(`expected a CLIError, got ${String(error)}`);
    }
    return error;
  }

  function expectNothingTouched(): void {
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(configDir)).toBe(false);
  }

  describe("agent upgrade", () => {
    it.each([
      ["no flags", [], "<address>"],
      ["--email", ["--email", "member@example.com"], "member@example.com"],
    ])(
      "with %s and no terminal exits 2 before sending a code",
      async (_case, argv, address) => {
        const error = await runFails(AgentUpgradeCommand, argv);

        expect(error.oclif.exit).toBe(2);
        expect(error.message).toContain(
          `run \`primitive agent claim --email ${address}\` ${CLAIM_INSTEAD}`,
        );
        expectNothingTouched();
      },
    );

    it.each([
      ["only stdin", true, undefined],
      ["only stderr", undefined, true],
    ])("with a terminal on %s still refuses", async (_case, stdin, stderr) => {
      setTerminals(stdin, stderr);

      const error = await runFails(AgentUpgradeCommand, [
        "--email",
        "member@example.com",
      ]);

      expect(error.oclif.exit).toBe(2);
      expect(error.message).toContain(CLAIM_INSTEAD);
      expectNothingTouched();
    });

    // Each start replaces the code sent before, so a code passed in can
    // never be the one this run sends: refused at a terminal too.
    it.each([
      ["no terminal", false],
      ["a terminal", true],
    ])(
      "refuses --code with %s and names claim-verify",
      async (_case, terminal) => {
        if (terminal) setTerminals(true, true);

        const error = await runFails(AgentUpgradeCommand, [
          "--email",
          "member@example.com",
          "--code",
          "123456",
        ]);

        expect(error.oclif.exit).toBe(2);
        expect(error.message).toContain(VERIFY_INSTEAD);
        expectNothingTouched();
      },
    );

    it("at a terminal asks for a blank --email instead of sending it", async () => {
      setTerminals(true, true);
      mocks.auth.mockResolvedValue({ apiClient: { client: {} } });
      mocks.question.mockResolvedValue("member@example.com");
      mocks.startAgentClaim.mockResolvedValue({
        error: { error: { code: "test_stop", message: "Stopped by test" } },
      });

      await AgentUpgradeCommand.run(["--email", " "], { root }).catch(
        () => undefined,
      );

      expect(mocks.auth).toHaveBeenCalledOnce();
      expect(mocks.question).toHaveBeenCalledWith("Email to confirm: ");
      expect(mocks.startAgentClaim).toHaveBeenCalledWith(
        expect.objectContaining({ body: { email: "member@example.com" } }),
      );
    });

    it("at a terminal sends a code, asks for it and verifies what was typed", async () => {
      setTerminals(true, true);
      mocks.auth.mockResolvedValue({ apiClient: { client: {} } });
      mocks.question.mockResolvedValue("654321");
      mocks.startAgentClaim.mockResolvedValue({ data: { data: {} } });
      mocks.verifyAgentClaim.mockResolvedValue({
        error: { error: { code: "test_stop", message: "Stopped by test" } },
      });

      await AgentUpgradeCommand.run(["--email", " member@example.com "], {
        root,
      }).catch(() => undefined);

      expect(mocks.startAgentClaim).toHaveBeenCalledWith(
        expect.objectContaining({ body: { email: "member@example.com" } }),
      );
      expect(mocks.question).toHaveBeenCalledWith("Verification code: ");
      expect(mocks.verifyAgentClaim).toHaveBeenCalledWith(
        expect.objectContaining({ body: { verification_code: "654321" } }),
      );
    });
  });

  describe("org leave", () => {
    it("without --yes and no terminal exits 2 before reading the login", async () => {
      const error = await runFails(OrgLeaveCommand, []);

      expect(error.oclif.exit).toBe(2);
      expect(error.message).toBe(
        "Not leaving: no terminal to confirm in. Pass --yes to leave without confirmation.",
      );
      expectNothingTouched();
    });

    it.each([
      ["only stdin", true, undefined],
      ["only stderr", undefined, true],
    ])(
      "without --yes and a terminal on %s still refuses",
      async (_case, stdin, stderr) => {
        setTerminals(stdin, stderr);

        const error = await runFails(OrgLeaveCommand, []);

        expect(error.oclif.exit).toBe(2);
        expectNothingTouched();
      },
    );

    it.each([
      ["--yes and no terminal", ["--yes"], false],
      ["no --yes at a terminal", [], true],
    ])("with %s goes on to read the login", async (_case, argv, terminal) => {
      if (terminal) setTerminals(true, true);

      await OrgLeaveCommand.run(argv, { root }).catch(() => undefined);

      expect(mocks.auth).toHaveBeenCalledOnce();
    });
  });

  describe("signup confirm", () => {
    it.each([
      [
        "no code source",
        ["member@example.com"],
        false,
        "Pass the verification code as a positional argument",
      ],
      [
        "two code sources",
        ["member@example.com", "123456", "--code-from-env", "CODE"],
        false,
        "Pass exactly one source for the verification code",
      ],
      [
        "an unset --code-from-env variable",
        ["member@example.com", "--code-from-env", "UNSET_CODE_VARIABLE"],
        false,
        "--code-from-env UNSET_CODE_VARIABLE: environment variable is not set.",
      ],
      [
        "an unreadable --code-from-file",
        [
          "member@example.com",
          "--code-from-file",
          "/nonexistent/primitive-cli-test/code",
        ],
        false,
        "--code-from-file /nonexistent/primitive-cli-test/code: could not read file",
      ],
      [
        "--code-from-stdin at a terminal",
        ["member@example.com", "--code-from-stdin"],
        true,
        "--code-from-stdin: stdin is a TTY",
      ],
    ])(
      "with %s is a usage error (exit 2)",
      async (_case, argv, terminal, message) => {
        if (terminal) setTerminals(true, true);

        const error = await runFails(SignupConfirmCommand, argv);

        expect(error.oclif.exit).toBe(2);
        expect(error.message).toContain(message);
        expectNothingTouched();
      },
    );
  });
});
