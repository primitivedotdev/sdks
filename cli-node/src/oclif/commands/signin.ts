import { Args, Command, Errors, Flags } from "@oclif/core";
import { acquireCliCredentialsLock } from "../auth.js";
import LoginCommand from "./login.js";
import {
  runSignupConfirmWithCredentialLock,
  runSignupResendWithCredentialLock,
  runSignupStartWithCredentialLock,
  type SignupCommandCopy,
} from "./signup.js";

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

const SIGNIN_OTP_COPY: SignupCommandCopy = {
  actionNoun: "sign-in",
  actionGerund: "signing in",
  confirmCommand: (email) => `signin otp confirm ${email} <code>`,
  resendCommand: (email) => `signin otp resend ${email}`,
  startCommand: (email) => `signin otp ${email}`,
};

function acquireCredentialsLock(configDir: string): () => void {
  try {
    return acquireCliCredentialsLock(configDir);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw cliError(detail);
  }
}

function commonOtpStartFlags() {
  return {
    "accept-terms": Flags.boolean({
      description:
        "Confirm acceptance of Primitive's Terms of Service and Privacy Policy",
    }),
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    "device-name": Flags.string({
      description: "Device name used for the created CLI OAuth session",
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials or pending sign-in state when needed",
    }),
    "signup-code": Flags.string({
      description: "Signup code required to start OTP sign-in",
      env: "PRIMITIVE_SIGNUP_CODE",
    }),
  };
}

export class SigninCommand extends LoginCommand {
  static description =
    `Sign in to an existing Primitive account with browser approval and save an org-scoped OAuth session locally.

This is the canonical sign-in command. It defaults to the same browser approval flow as \`primitive signin browser\`. For email-code sign-in, use \`primitive signin otp <email> --signup-code <code>\`, then \`primitive signin otp confirm <email> <code>\`. For new account creation, use \`primitive signup <email>\`.`;

  static summary = "Sign in to an existing account";

  static examples = [
    "<%= config.bin %> signin",
    "<%= config.bin %> signin browser",
    "<%= config.bin %> signin --no-browser",
    "<%= config.bin %> signin otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> signin otp confirm user@example.com 123456",
  ];

  protected retryCommand(): string {
    return "signin";
  }
}

export class SigninBrowserCommand extends LoginCommand {
  static description =
    "Sign in to an existing Primitive account by opening Primitive in your browser and saving an org-scoped OAuth session locally.";

  static summary = "Sign in with browser approval";

  static examples = [
    "<%= config.bin %> signin browser",
    "<%= config.bin %> signin browser --device-name work-laptop",
    "<%= config.bin %> signin browser --no-browser",
    "<%= config.bin %> signin browser --force",
  ];

  protected retryCommand(): string {
    return "signin browser";
  }
}

export class SigninOtpCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address to sign in with",
      required: false,
    }),
  };

  static description =
    "Start email-code sign-in using Primitive's signup/auth OTP flow, send a verification code, and save the pending token locally. Requires a signup code.";

  static summary = "Start OTP sign-in";

  static examples = [
    "<%= config.bin %> signin otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> signin otp confirm user@example.com 123456",
  ];

  static flags = commonOtpStartFlags();

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SigninOtpCommand);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupStartWithCredentialLock({
        configDir: this.config.configDir,
        copy: SIGNIN_OTP_COPY,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export class SigninOtpConfirmCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start OTP sign-in",
      required: true,
    }),
    code: Args.string({
      description: "Verification code from the sign-in email",
      required: true,
    }),
  };

  static description =
    "Confirm a pending OTP sign-in, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm OTP sign-in";

  static examples = [
    "<%= config.bin %> signin otp confirm user@example.com 123456",
    "<%= config.bin %> signin otp confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
    force: Flags.boolean({
      char: "f",
      description: "Replace saved credentials after verification",
    }),
    "org-id": Flags.string({
      description:
        "Workspace id to target when the email belongs to multiple workspaces",
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SigninOtpConfirmCommand);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupConfirmWithCredentialLock({
        code: args.code,
        configDir: this.config.configDir,
        copy: SIGNIN_OTP_COPY,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}

export class SigninOtpResendCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start OTP sign-in",
      required: true,
    }),
  };

  static description =
    "Resend the verification code for a pending OTP sign-in.";

  static summary = "Resend OTP sign-in code";

  static examples = ["<%= config.bin %> signin otp resend user@example.com"];

  static flags = {
    "api-base-url-1": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL_1",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(SigninOtpResendCommand);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupResendWithCredentialLock({
        configDir: this.config.configDir,
        copy: SIGNIN_OTP_COPY,
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }
}
