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

const SIGNIN_OTP_COPY: SignupCommandCopy = {
  actionNoun: "sign-in",
  actionGerund: "signing in",
  confirmCommand: (email) => `signin otp confirm ${email} <code>`,
  resendCommand: (email) => `signin otp resend ${email}`,
  startCommand: (email) => `signin otp ${email}`,
};

const SIGNIN_EMAIL_COPY: SignupCommandCopy = {
  actionNoun: "sign-in",
  actionGerund: "signing in",
  confirmCommand: (email) => `signin confirm ${email} <code>`,
  resendCommand: (email) => `signin resend ${email}`,
  startCommand: (email) => `signin ${email}`,
};

const LOGIN_EMAIL_COPY: SignupCommandCopy = {
  actionNoun: "login",
  actionGerund: "logging in",
  confirmCommand: (email) => `login confirm ${email} <code>`,
  resendCommand: (email) => `login resend ${email}`,
  startCommand: (email) => `login ${email}`,
};

const LOGIN_OTP_COPY: SignupCommandCopy = {
  actionNoun: "login",
  actionGerund: "logging in",
  confirmCommand: (email) => `login otp confirm ${email} <code>`,
  resendCommand: (email) => `login otp resend ${email}`,
  startCommand: (email) => `login otp ${email}`,
};

const OTP_COPY: SignupCommandCopy = {
  actionNoun: "email-code auth",
  actionGerund: "authenticating",
  confirmCommand: (email) => `otp confirm ${email} <code>`,
  resendCommand: (email) => `otp resend ${email}`,
  startCommand: (email) => `otp ${email}`,
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
      description: "Signup code required to start email-code sign-in",
      env: "PRIMITIVE_SIGNUP_CODE",
    }),
  };
}

export class SigninCommand extends BrowserLoginCommand {
  static args = {
    email: Args.string({
      description:
        "Email address for email-code sign-in. Omit it to use browser approval.",
      required: false,
    }),
  };

  static description =
    `Sign in or log in to an existing Primitive account and save an org-scoped OAuth session locally.

Run \`primitive signin <email> --signup-code <code> --accept-terms\` for email-code sign-in, then \`primitive signin confirm <email> <code>\`. Run \`primitive signin\` with no email to use browser approval; \`primitive signin browser\` is the explicit browser form. \`primitive login\` supports the same flows with login-shaped commands. \`primitive otp <email>\` is the shortest email-code auth form. For new account creation, use \`primitive signup <email>\`.`;

  static summary = "Sign in to an existing account";

  static examples = [
    "<%= config.bin %> signin",
    "<%= config.bin %> signin browser",
    "<%= config.bin %> signin --no-browser",
    "<%= config.bin %> signin user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> signin confirm user@example.com 123456",
    "<%= config.bin %> signin otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> signin otp confirm user@example.com 123456",
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
    const commandClass = this.constructor as typeof SigninCommand;
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
    return "signin";
  }

  protected emailCodeCopy(): SignupCommandCopy {
    return SIGNIN_EMAIL_COPY;
  }
}

export class LoginCommand extends SigninCommand {
  static args = SigninCommand.args;

  static description =
    `Log in or sign in to an existing Primitive account and save an org-scoped OAuth session locally.

Run \`primitive login <email> --signup-code <code> --accept-terms\` for email-code login, then \`primitive login confirm <email> <code>\`. Run \`primitive login\` with no email to use browser approval; \`primitive login browser\` is the explicit browser form. \`primitive signin\` supports the same flows with signin-shaped commands. \`primitive otp <email>\` is the shortest email-code auth form. For new account creation, use \`primitive signup <email>\`.`;

  static summary = "Log in to an existing account";

  static examples = [
    "<%= config.bin %> login",
    "<%= config.bin %> login browser",
    "<%= config.bin %> login --no-browser",
    "<%= config.bin %> login user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> login confirm user@example.com 123456",
    "<%= config.bin %> login otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> login otp confirm user@example.com 123456",
  ];

  static flags = SigninCommand.flags;

  protected retryCommand(): string {
    return "login";
  }

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}

export class SigninBrowserCommand extends BrowserLoginCommand {
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
    const commandClass = this.constructor as typeof SigninOtpCommand;
    const { args, flags } = await this.parse(commandClass);
    const releaseCredentialsLock = acquireCredentialsLock(
      this.config.configDir,
    );
    try {
      await runSignupStartWithCredentialLock({
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
    return SIGNIN_OTP_COPY;
  }
}

export class LoginOtpCommand extends SigninOtpCommand {
  static args = SigninOtpCommand.args;

  static description =
    "Start email-code login using Primitive's signup/auth OTP flow, send a verification code, and save the pending token locally. Requires a signup code.";

  static summary = "Start OTP login";

  static examples = [
    "<%= config.bin %> login otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> login otp confirm user@example.com 123456",
  ];

  static flags = SigninOtpCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_OTP_COPY;
  }
}

export class OtpCommand extends SigninOtpCommand {
  static args = SigninOtpCommand.args;

  static description =
    "Start email-code authentication, send a verification code, and save the pending token locally. Requires a signup code.";

  static summary = "Start email-code auth";

  static examples = [
    "<%= config.bin %> otp user@example.com --signup-code invite-code --accept-terms",
    "<%= config.bin %> otp confirm user@example.com 123456",
  ];

  static flags = SigninOtpCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return OTP_COPY;
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
    const commandClass = this.constructor as typeof SigninOtpConfirmCommand;
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
    return SIGNIN_OTP_COPY;
  }
}

export class SigninConfirmCommand extends SigninOtpConfirmCommand {
  static args = SigninOtpConfirmCommand.args;

  static description =
    "Confirm a pending email-code sign-in, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm email-code sign-in";

  static examples = [
    "<%= config.bin %> signin confirm user@example.com 123456",
    "<%= config.bin %> signin confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = SigninOtpConfirmCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return SIGNIN_EMAIL_COPY;
  }
}

export class LoginConfirmCommand extends SigninOtpConfirmCommand {
  static args = SigninOtpConfirmCommand.args;

  static description =
    "Confirm a pending email-code login, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm email-code login";

  static examples = [
    "<%= config.bin %> login confirm user@example.com 123456",
    "<%= config.bin %> login confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = SigninOtpConfirmCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}

export class LoginOtpConfirmCommand extends SigninOtpConfirmCommand {
  static args = SigninOtpConfirmCommand.args;

  static description =
    "Confirm a pending OTP login, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm OTP login";

  static examples = [
    "<%= config.bin %> login otp confirm user@example.com 123456",
    "<%= config.bin %> login otp confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = SigninOtpConfirmCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_OTP_COPY;
  }
}

export class OtpConfirmCommand extends SigninOtpConfirmCommand {
  static args = SigninOtpConfirmCommand.args;

  static description =
    "Confirm pending email-code authentication, create an OAuth session, and save CLI credentials locally.";

  static summary = "Confirm email-code auth";

  static examples = [
    "<%= config.bin %> otp confirm user@example.com 123456",
    "<%= config.bin %> otp confirm user@example.com 123456 --org-id 00000000-0000-4000-8000-000000000000",
  ];

  static flags = SigninOtpConfirmCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return OTP_COPY;
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
    "api-base-url": Flags.string({
      description:
        "Override the primary API base URL. Internal testing only; not documented to customers.",
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
  };

  async run(): Promise<void> {
    const commandClass = this.constructor as typeof SigninOtpResendCommand;
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
    return SIGNIN_OTP_COPY;
  }
}

export class SigninResendCommand extends SigninOtpResendCommand {
  static args = SigninOtpResendCommand.args;

  static description =
    "Resend the verification code for a pending email-code sign-in.";

  static summary = "Resend email-code sign-in code";

  static examples = ["<%= config.bin %> signin resend user@example.com"];

  static flags = SigninOtpResendCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return SIGNIN_EMAIL_COPY;
  }
}

export class LoginResendCommand extends SigninOtpResendCommand {
  static args = SigninOtpResendCommand.args;

  static description =
    "Resend the verification code for a pending email-code login.";

  static summary = "Resend email-code login code";

  static examples = ["<%= config.bin %> login resend user@example.com"];

  static flags = SigninOtpResendCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_EMAIL_COPY;
  }
}

export class LoginOtpResendCommand extends SigninOtpResendCommand {
  static args = SigninOtpResendCommand.args;

  static description = "Resend the verification code for a pending OTP login.";

  static summary = "Resend OTP login code";

  static examples = ["<%= config.bin %> login otp resend user@example.com"];

  static flags = SigninOtpResendCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return LOGIN_OTP_COPY;
  }
}

export class OtpResendCommand extends SigninOtpResendCommand {
  static args = SigninOtpResendCommand.args;

  static description =
    "Resend the verification code for pending email-code authentication.";

  static summary = "Resend email-code auth code";

  static examples = ["<%= config.bin %> otp resend user@example.com"];

  static flags = SigninOtpResendCommand.flags;

  protected emailCodeCopy(): SignupCommandCopy {
    return OTP_COPY;
  }
}
