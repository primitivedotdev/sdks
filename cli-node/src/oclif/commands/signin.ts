import { Args, Command, Errors, Flags } from "@oclif/core";
import { acquireCliCredentialsLock } from "../auth.js";
import BrowserLoginCommand, { type LoginFlags } from "./login.js";
import {
  runSignupConfirmWithCredentialLock,
  runSignupResendWithCredentialLock,
  runSignupStartWithCredentialLock,
  type SignupCommandCopy,
  type SignupFlags,
} from "./signup.js";

function cliError(message: string): Errors.CLIError {
  return new Errors.CLIError(message, { exit: 1 });
}

const LOGIN_EMAIL_COPY: SignupCommandCopy = {
  actionNoun: "login",
  actionGerund: "logging in",
  confirmCommand: (email) => `login confirm ${email} <code>`,
  resendCommand: (email) => `login resend ${email}`,
  startCommand: (email) => `login ${email}`,
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
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "device-name": Flags.string({
      description: "Device name used for the created CLI OAuth session",
    }),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials or pending email-code auth state when needed",
    }),
    "signup-code": Flags.string({
      description: "Signup code required to start email-code login",
      env: "PRIMITIVE_SIGNUP_CODE",
    }),
  };
}

export class LoginCommand extends BrowserLoginCommand {
  static args = {
    email: Args.string({
      description:
        "Email address for email-code login. Omit it to use browser approval.",
      required: false,
    }),
  };

  static description =
    `Log in to an existing Primitive account and save an org-scoped OAuth session locally.

Run \`primitive login <email> --signup-code <code> --accept-terms\` for email-code login, then \`primitive login confirm <email> <code>\`. Run \`primitive login\` with no email to use browser approval; \`primitive login browser\` is the explicit browser form. For new account creation, use \`primitive signup <email>\`.`;

  static summary = "Log in to an existing account";

  static examples = [
    "<%= config.bin %> login",
    "<%= config.bin %> login browser",
    "<%= config.bin %> login --no-browser",
    "<%= config.bin %> login user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> login confirm user@example.com 123456",
  ];

  static flags = {
    ...BrowserLoginCommand.flags,
    ...commonOtpStartFlags(),
    force: Flags.boolean({
      char: "f",
      description:
        "Replace saved credentials or pending email-code auth state when needed, without first verifying the existing session",
    }),
  };

  async run(): Promise<void> {
    const commandClass = this.constructor as typeof LoginCommand;
    const { args, flags } = await this.parse(commandClass);

    if (!args.email) {
      if (flags["signup-code"] || flags["accept-terms"]) {
        throw cliError(
          `Email-code auth needs an email address. Run \`primitive ${this.emailCodeCopy().startCommand("<email>")} --signup-code <code> --accept-terms\`.`,
        );
      }
      await this.runBrowserLogin(flags as LoginFlags, this.retryCommand());
      return;
    }

    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupStartWithCredentialLock({
        configDir: this.config.configDir,
        copy: this.emailCodeCopy(),
        email: args.email,
        flags: flags as SignupFlags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }

  protected retryCommand(): string {
    return "login";
  }

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}

export class LoginBrowserCommand extends BrowserLoginCommand {
  static description =
    "Log in to an existing Primitive account by opening Primitive in your browser and saving an org-scoped OAuth session locally.";

  static summary = "Log in with browser approval";

  static examples = [
    "<%= config.bin %> login browser",
    "<%= config.bin %> login browser --device-name work-laptop",
    "<%= config.bin %> login browser --no-browser",
    "<%= config.bin %> login browser --force",
  ];

  protected retryCommand(): string {
    return "login browser";
  }
}

export class LoginConfirmCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start email-code login",
      required: true,
    }),
    code: Args.string({
      description: "Verification code from the login email",
      required: true,
    }),
  };

  static description =
    "Confirm a pending email-code login, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm email-code login";

  static examples = [
    "<%= config.bin %> login confirm user@example.com 123456",
    "<%= config.bin %> login confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
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
    const commandClass = this.constructor as typeof LoginConfirmCommand;
    const { args, flags } = await this.parse(commandClass);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupConfirmWithCredentialLock({
        code: args.code,
        configDir: this.config.configDir,
        copy: this.emailCodeCopy(),
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}

export class LoginResendCommand extends Command {
  static args = {
    email: Args.string({
      description: "Email address used to start email-code login",
      required: true,
    }),
  };

  static description =
    "Resend the verification code for a pending email-code login.";

  static summary = "Resend email-code login code";

  static examples = ["<%= config.bin %> login resend user@example.com"];

  static flags = {
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const commandClass = this.constructor as typeof LoginResendCommand;
    const { args, flags } = await this.parse(commandClass);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupResendWithCredentialLock({
        configDir: this.config.configDir,
        copy: this.emailCodeCopy(),
        email: args.email,
        flags,
      });
    } finally {
      releaseCredentialsLock();
    }
  }

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}
