import { describe, expect, it } from "vitest";
import {
  SigninBrowserCommand,
  SigninCommand,
  SigninOtpCommand,
  SigninOtpConfirmCommand,
  SigninOtpResendCommand,
} from "../../src/oclif/commands/signin.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("signin commands", () => {
  it("routes exact sign-in command shapes", () => {
    expect(COMMANDS.signin).toBe(SigninCommand);
    expect(COMMANDS["signin:browser"]).toBe(SigninBrowserCommand);
    expect(COMMANDS["signin:otp"]).toBe(SigninOtpCommand);
    expect(COMMANDS["signin:otp:confirm"]).toBe(SigninOtpConfirmCommand);
    expect(COMMANDS["signin:otp:resend"]).toBe(SigninOtpResendCommand);
    expect(COMMANDS.login).not.toBe(SigninCommand);
  });

  it("makes browser sign-in and signup boundaries discoverable from help text", () => {
    expect(SigninCommand.description).toContain("primitive signin browser");
    expect(SigninCommand.description).toContain("primitive signin otp <email>");
    expect(SigninCommand.description).toContain("primitive signin otp confirm");
    expect(SigninCommand.description).toContain("primitive signup <email>");
    expect(SigninCommand.examples).toContain(
      "<%= config.bin %> signin otp confirm user@example.com 123456",
    );
  });

  it("documents the OTP sign-in command family", () => {
    expect(SigninOtpCommand.description).toContain("signup/auth OTP flow");
    expect(SigninOtpCommand.description).toContain("Requires a signup code");
    expect(SigninOtpConfirmCommand.description).toContain(
      "Confirm a pending OTP sign-in",
    );
    expect(SigninOtpResendCommand.description).toContain(
      "Resend the verification code",
    );
  });

  it("keeps OTP start flags aligned with the signup/auth contract", () => {
    expect(SigninOtpCommand.flags["signup-code"]).toBeDefined();
    expect(SigninOtpCommand.flags["accept-terms"]).toBeDefined();
    expect(SigninOtpConfirmCommand.flags["org-id"]).toBeDefined();
  });
});
