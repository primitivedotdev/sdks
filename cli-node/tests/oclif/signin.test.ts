import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Errors } from "@oclif/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LoginBrowserCommand,
  LoginCommand,
  LoginConfirmCommand,
  LoginOtpCommand,
  LoginOtpConfirmCommand,
  LoginOtpResendCommand,
  LoginResendCommand,
  OtpCommand,
  OtpConfirmCommand,
  OtpResendCommand,
  SigninBrowserCommand,
  SigninCommand,
  SigninConfirmCommand,
  SigninOtpCommand,
  SigninOtpConfirmCommand,
  SigninOtpResendCommand,
  SigninResendCommand,
} from "../../src/oclif/commands/signin.js";
import SignupCommand, {
  SignupInteractiveCommand,
} from "../../src/oclif/commands/signup.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("signin commands", () => {
  it("routes exact sign-in command shapes", () => {
    expect(COMMANDS.signin).toBe(SigninCommand);
    expect(COMMANDS.login).toBe(LoginCommand);
    expect(COMMANDS.otp).toBe(OtpCommand);
    expect(COMMANDS["login:browser"]).toBe(LoginBrowserCommand);
    expect(COMMANDS["login:confirm"]).toBe(LoginConfirmCommand);
    expect(COMMANDS["login:otp"]).toBe(LoginOtpCommand);
    expect(COMMANDS["login:otp:confirm"]).toBe(LoginOtpConfirmCommand);
    expect(COMMANDS["login:otp:resend"]).toBe(LoginOtpResendCommand);
    expect(COMMANDS["login:resend"]).toBe(LoginResendCommand);
    expect(COMMANDS["otp:confirm"]).toBe(OtpConfirmCommand);
    expect(COMMANDS["otp:resend"]).toBe(OtpResendCommand);
    expect(COMMANDS["signin:browser"]).toBe(SigninBrowserCommand);
    expect(COMMANDS["signin:confirm"]).toBe(SigninConfirmCommand);
    expect(COMMANDS["signin:otp"]).toBe(SigninOtpCommand);
    expect(COMMANDS["signin:otp:confirm"]).toBe(SigninOtpConfirmCommand);
    expect(COMMANDS["signin:otp:resend"]).toBe(SigninOtpResendCommand);
    expect(COMMANDS["signin:resend"]).toBe(SigninResendCommand);
  });

  it("makes browser auth, email auth, and signup boundaries discoverable from help text", () => {
    expect(SigninCommand.description).toContain("primitive signin browser");
    expect(SigninCommand.description).toContain("primitive signin <email>");
    expect(SigninCommand.description).toContain("primitive signin confirm");
    expect(SigninCommand.description).toContain("primitive login");
    expect(SigninCommand.description).toContain("primitive otp <email>");
    expect(SigninCommand.description).toContain("primitive signup <email>");
    expect(SigninCommand.examples).toContain(
      "<%= config.bin %> signin user@example.com --accept-terms",
    );
    expect(SigninCommand.examples).toContain(
      "<%= config.bin %> signin confirm user@example.com 123456",
    );
    expect(SigninCommand.examples).toContain(
      "<%= config.bin %> signin otp confirm user@example.com 123456",
    );
    expect(SigninCommand.args.email.description).toContain("email-code");
    expect(Object.hasOwn(SigninCommand.flags, "signup-code")).toBe(false);
    expect(SigninCommand.flags.force.description).toContain(
      "without first verifying the existing session",
    );

    expect(LoginCommand.description).toContain("primitive login browser");
    expect(LoginCommand.description).toContain("primitive login <email>");
    expect(LoginCommand.description).toContain("primitive login confirm");
    expect(LoginCommand.description).toContain("primitive signin");
    expect(LoginCommand.description).toContain("primitive otp <email>");
    expect(LoginCommand.examples).toContain(
      "<%= config.bin %> login user@example.com --accept-terms",
    );
    expect(LoginCommand.flags.force.description).toContain(
      "without first verifying the existing session",
    );
  });

  it("says that an email address can create an account, and which addresses need the browser", () => {
    for (const command of [LoginCommand, SigninCommand]) {
      expect(command.summary).not.toContain("existing account");
      expect(command.description).not.toContain("existing Primitive account");
      expect(command.description).toContain(
        "or creates a new account when none does",
      );
      expect(command.description).toContain(
        "Primitive sends no emailed code to an address on a domain it receives mail for",
      );
    }
    for (const command of [LoginOtpCommand, SigninOtpCommand, OtpCommand]) {
      expect(command.description).toContain(
        "or creates a new account when none does",
      );
    }
    expect(SigninCommand.args.email.description).toContain(
      "or creates one when none does",
    );
  });

  it("documents the OTP sign-in command family", () => {
    expect(SigninOtpCommand.description).toContain("signup/auth OTP flow");
    expect(SigninOtpCommand.description).not.toContain("signup code");
    expect(SigninOtpConfirmCommand.description).toContain(
      "Confirm a pending OTP sign-in",
    );
    expect(SigninOtpResendCommand.description).toContain(
      "Resend the verification code",
    );
    expect(SigninConfirmCommand.description).toContain(
      "Confirm a pending email-code sign-in",
    );
    expect(SigninResendCommand.description).toContain(
      "Resend the verification code",
    );
    expect(LoginOtpCommand.description).toContain("signup/auth OTP flow");
    expect(LoginOtpConfirmCommand.description).toContain(
      "Confirm a pending OTP login",
    );
    expect(LoginOtpResendCommand.description).toContain(
      "Resend the verification code",
    );
    expect(OtpCommand.description).toContain("email-code authentication");
    expect(OtpConfirmCommand.description).toContain(
      "Confirm pending email-code authentication",
    );
    expect(OtpResendCommand.description).toContain(
      "pending email-code authentication",
    );
  });

  it("keeps OTP start flags aligned with the signup/auth contract", () => {
    expect(Object.hasOwn(SigninCommand.flags, "signup-code")).toBe(false);
    expect(SigninCommand.flags["accept-terms"]).toBeDefined();
    expect(Object.hasOwn(LoginCommand.flags, "signup-code")).toBe(false);
    expect(LoginCommand.flags["accept-terms"]).toBeDefined();
    expect(Object.hasOwn(SigninOtpCommand.flags, "signup-code")).toBe(false);
    expect(SigninOtpCommand.flags["accept-terms"]).toBeDefined();
    expect(Object.hasOwn(LoginOtpCommand.flags, "signup-code")).toBe(false);
    expect(LoginOtpCommand.flags["accept-terms"]).toBeDefined();
    expect(Object.hasOwn(OtpCommand.flags, "signup-code")).toBe(false);
    expect(OtpCommand.flags["accept-terms"]).toBeDefined();
    expect(SigninConfirmCommand.flags["org-id"]).toBeDefined();
    expect(LoginConfirmCommand.flags["org-id"]).toBeDefined();
    expect(OtpConfirmCommand.flags["org-id"]).toBeDefined();
    expect(SigninOtpConfirmCommand.flags["org-id"]).toBeDefined();
  });
});

const root = resolve(import.meta.dirname, "../..");
const API_BASE_URL = "https://api.example.test/v1";

// Run the commands as a script or an agent does: no terminal on stdin or
// stderr, and an API that refuses an emailed code for a managed domain.
describe("email-code login from a script", () => {
  let configDir: string;
  let fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>;
  let stdinTTY: PropertyDescriptor | undefined;
  let stderrTTY: PropertyDescriptor | undefined;

  beforeEach(() => {
    configDir = mkdtempSync(join(tmpdir(), "primitive-cli-signin-test-"));
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", configDir);
    // Keep this shell's own agent profile or API key out of the commands.
    vi.stubEnv("PRIMITIVE_AGENT_PROFILE", undefined);
    vi.stubEnv("PRIMITIVE_AGENT_ADDRESS", undefined);
    vi.stubEnv("PRIMITIVE_API_KEY", undefined);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdinTTY = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
    stderrTTY = Object.getOwnPropertyDescriptor(process.stderr, "isTTY");
    Object.defineProperty(process.stdin, "isTTY", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: undefined,
    });
    fetchMock = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: "managed_domain",
              message:
                "You can't sign up with an email address on a domain that's managed by Primitive. Use a different email address.",
            },
          }),
          { status: 400, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    for (const [stream, descriptor] of [
      [process.stdin, stdinTTY],
      [process.stderr, stderrTTY],
    ] as const) {
      if (descriptor) Object.defineProperty(stream, "isTTY", descriptor);
      else delete (stream as { isTTY?: boolean }).isTTY;
    }
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    rmSync(configDir, { force: true, recursive: true });
  });

  async function runFails(
    command: {
      run: (argv: string[], opts: { root: string }) => Promise<unknown>;
    },
    argv: string[],
  ): Promise<Errors.CLIError> {
    const error = await command
      .run([...argv, "--api-base-url", API_BASE_URL], { root })
      .then(
        () => null,
        (caught: unknown) => caught,
      );
    if (!(error instanceof Errors.CLIError)) {
      throw new Error(`expected a CLIError, got ${String(error)}`);
    }
    return error;
  }

  it.each([
    ["login otp", LoginOtpCommand],
    ["login", LoginCommand],
    ["signin", SigninCommand],
    ["signin otp", SigninOtpCommand],
    ["otp", OtpCommand],
    ["signup", SignupCommand],
  ] as const)(
    "%s <email> without --accept-terms refuses with exit 2 before touching anything",
    async (name, command) => {
      // A config directory that does not exist yet: the refusal comes before
      // the credentials lock would create it.
      const fresh = join(configDir, "fresh");
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", fresh);

      const error = await runFails(command, ["member@managed.example"]);

      expect(error.oclif.exit).toBe(2);
      expect(error.message).toContain(
        `add --accept-terms to the same command, for example \`primitive ${name} member@managed.example --accept-terms\`.`,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(existsSync(fresh)).toBe(false);
    },
  );

  it.each([
    ["login otp", LoginOtpCommand],
    ["signin otp", SigninOtpCommand],
    ["otp", OtpCommand],
    ["signup", SignupCommand],
  ] as const)(
    "%s without an email refuses with exit 2 instead of prompting",
    async (name, command) => {
      const fresh = join(configDir, "fresh");
      vi.stubEnv("PRIMITIVE_CONFIG_DIR", fresh);

      const error = await runFails(command, ["--accept-terms"]);

      expect(error.oclif.exit).toBe(2);
      expect(error.message).toContain(
        `\`primitive ${name} <email> --accept-terms\``,
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(existsSync(fresh)).toBe(false);
    },
  );

  it("signup interactive refuses with exit 2 before touching anything", async () => {
    const fresh = join(configDir, "fresh");
    vi.stubEnv("PRIMITIVE_CONFIG_DIR", fresh);

    const error = await runFails(SignupInteractiveCommand, ["--accept-terms"]);

    expect(error.oclif.exit).toBe(2);
    expect(error.message).toContain(
      "`primitive signup interactive` needs a terminal",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(existsSync(fresh)).toBe(false);
  });

  it.each([
    ["login --accept-terms", ["--accept-terms"]],
    [
      "login <email> --permission",
      ["member@example.com", "--accept-terms", "--permission", "mail:read"],
    ],
  ])("%s is a usage error (exit 2)", async (_case, argv) => {
    const error = await runFails(LoginCommand, argv);

    expect(error.oclif.exit).toBe(2);
    expect(error.message).toMatch(
      /needs an email address|--permission applies to browser login/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["login otp", "login browser", LoginOtpCommand],
    ["login", "login browser", LoginCommand],
    ["otp", "login browser", OtpCommand],
    ["signin", "signin browser", SigninCommand],
    ["signin otp", "signin browser", SigninOtpCommand],
  ] as const)(
    "%s <email> answers managed_domain with %s",
    async (_name, browser, command) => {
      const error = await runFails(command, [
        "member@managed.example",
        "--accept-terms",
      ]);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(error.oclif.exit).toBe(1);
      expect(error.code).toBe("managed_domain");
      expect(error.message).toBe(
        `Primitive sends no emailed code to addresses on managed.example, a domain it receives mail for. Use browser login instead: run \`primitive ${browser} --no-browser\` and open the link it prints.`,
      );
    },
  );
});
