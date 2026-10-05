import { describe, expect, it } from "vitest";
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
