import { describe, expect, it } from "vitest";
import {
  LoginBrowserCommand,
  LoginCommand,
  LoginConfirmCommand,
  LoginResendCommand,
} from "../../src/oclif/commands/signin.js";
import { COMMANDS } from "../../src/oclif/index.js";

describe("login commands", () => {
  it("routes exact login command shapes", () => {
    expect(COMMANDS.login).toBe(LoginCommand);
    expect(COMMANDS["login:browser"]).toBe(LoginBrowserCommand);
    expect(COMMANDS["login:confirm"]).toBe(LoginConfirmCommand);
    expect(COMMANDS["login:resend"]).toBe(LoginResendCommand);
    expect(COMMANDS.signin).toBeUndefined();
    expect(COMMANDS.otp).toBeUndefined();
    expect(COMMANDS["login:otp"]).toBeUndefined();
  });

  it("makes browser auth, email auth, and signup boundaries discoverable from help text", () => {
    expect(LoginCommand.description).toContain("primitive login browser");
    expect(LoginCommand.description).toContain("primitive login <email>");
    expect(LoginCommand.description).toContain("primitive login confirm");
    expect(LoginCommand.description).toContain("primitive signup <email>");
    expect(LoginCommand.description).not.toContain("primitive signin");
    expect(LoginCommand.description).not.toContain("primitive otp");
    expect(LoginCommand.examples).toContain(
      "<%= config.bin %> login user@example.com --signup-code invite-code --accept-terms",
    );
    expect(LoginCommand.flags.force.description).toContain(
      "without first verifying the existing session",
    );
  });

  it("keeps login email-code flags aligned with the signup/auth contract", () => {
    expect(LoginCommand.flags["signup-code"]).toBeDefined();
    expect(LoginCommand.flags["accept-terms"]).toBeDefined();
  });
});
