import { Command, Flags } from "@oclif/core";
import { resolveCliApiRequestConfig } from "../api-client.js";
import { API_BASE_URL_FLAG_DESCRIPTION } from "../api-command.js";
import { openBrowser } from "../browser-login-prompt.js";

const BILLING_PAGE_PATH = "/app/settings/billing";

export const BILLING_CLI_NOTE =
  "Reading and managing billing from the CLI will come in a future release.";

/** The dashboard's billing page, on the site that serves this API. */
export function billingPageUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl);
  url.hostname = url.hostname.replace(/^api\./, "");
  url.pathname = BILLING_PAGE_PATH;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Whether a browser can open here: an interactive session on a desktop. */
export function canOpenBrowser(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  isTTY: boolean | undefined,
): boolean {
  if (!isTTY || env.CI || env.SSH_CONNECTION || env.SSH_TTY) return false;
  return platform !== "linux" || Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

class BillingCommand extends Command {
  static description =
    `Open the billing page of the Primitive dashboard in your browser. With --no-browser, or where no browser can open, print its link instead. ${BILLING_CLI_NOTE}`;

  static summary = "Open the dashboard's billing page";

  static examples = [
    "<%= config.bin %> billing",
    "<%= config.bin %> billing --no-browser",
  ];

  static flags = {
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "no-browser": Flags.boolean({
      description: "Print the link instead of opening a browser",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BillingCommand);
    const { resolvedApiBaseUrl } = resolveCliApiRequestConfig({
      apiBaseUrl: flags["api-base-url"],
      configDir: this.config.configDir,
    });
    const url = billingPageUrl(resolvedApiBaseUrl);
    const open =
      !flags["no-browser"] &&
      canOpenBrowser(process.env, process.platform, process.stdout.isTTY);
    if (open) openBrowser(url);
    this.log(open ? `Opening the billing page in your browser: ${url}` : url);
    this.log(BILLING_CLI_NOTE);
  }
}

export default BillingCommand;
