import { Command, Flags } from "@oclif/core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  runWithTiming,
  TIME_FLAG_DESCRIPTION,
} from "../api-command.js";
import {
  buildX402Client,
  formatUsdc,
  reportX402Error,
  usdcToBaseUnits,
} from "./payments-shared.js";

// `primitive payments charge` is the payee verb for requesting a payment. It
// matches the SDK's `charge()` and adds a human `--amount-usdc` so callers do
// not have to convert to base units by hand. The challenge JSON is printed to
// stdout so it can be piped or saved and handed to the payer; a one-line human
// summary goes to stderr. The auto-generated `payments create-challenge` remains
// for callers who want the raw operation with base-unit amounts.

class PaymentsChargeCommand extends Command {
  static description =
    `Request an x402 payment by creating a challenge (payee side).

  Give the amount as human USDC with --amount-usdc (e.g. 0.01) or as token base
  units with --amount (e.g. 10000). The challenge JSON is printed to stdout;
  hand it to the payer (for example in an email reply) so they can pay it. The
  payee must have a registered payout address first.`;

  static summary = "Request an x402 payment (create a challenge)";

  static examples = [
    "<%= config.bin %> payments charge --amount-usdc 0.01",
    "<%= config.bin %> payments charge --amount 10000 --network base",
    "<%= config.bin %> payments charge --amount-usdc 1.50 > challenge.json",
  ];

  static flags = {
    "api-key": Flags.string({
      description:
        "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
      env: "PRIMITIVE_API_KEY",
    }),
    "api-base-url": Flags.string({
      description: API_BASE_URL_FLAG_DESCRIPTION,
      env: "PRIMITIVE_API_BASE_URL",
      hidden: true,
    }),
    "amount-usdc": Flags.string({
      description:
        "Amount to collect in USDC, e.g. 0.01. Converted to base units.",
      exclusive: ["amount"],
    }),
    amount: Flags.string({
      description:
        "Amount to collect in token base units, e.g. 10000 (0.01 USDC).",
      exclusive: ["amount-usdc"],
    }),
    network: Flags.string({
      description: "Chain to collect on.",
      options: ["base", "base-sepolia"],
      default: "base-sepolia",
    }),
    "payer-org": Flags.string({
      description:
        "Restrict who can pay to this organization id (on-net binding).",
    }),
    description: Flags.string({
      description: "Human-readable description of what the payment is for.",
    }),
    resource: Flags.string({
      description: "A URL identifying the thing being paid for.",
    }),
    "expires-in": Flags.integer({
      description:
        "Seconds until the challenge expires (60-86400; default 3600).",
    }),
    "idempotency-key": Flags.string({
      description:
        "Retry-safe key: charging again with the same key returns the original challenge instead of a duplicate.",
    }),
    time: Flags.boolean({
      description: TIME_FLAG_DESCRIPTION,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(PaymentsChargeCommand);

    let amount: string | undefined;
    if (flags["amount-usdc"] !== undefined) {
      const base = usdcToBaseUnits(flags["amount-usdc"]);
      if (!base) {
        process.stderr.write(
          `Invalid --amount-usdc "${flags["amount-usdc"]}". Use a positive amount with at most 6 decimals, e.g. 0.01.\n`,
        );
        process.exitCode = 1;
        return;
      }
      amount = base;
    } else if (flags.amount !== undefined) {
      amount = flags.amount;
    } else {
      process.stderr.write(
        "Provide --amount-usdc <usdc> (e.g. 0.01) or --amount <base-units> (e.g. 10000).\n",
      );
      process.exitCode = 1;
      return;
    }

    const { auth, baseUrlOverridden, requestConfig } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const client = buildX402Client({
        apiKey: auth.apiKey,
        resolvedApiBaseUrl: requestConfig.resolvedApiBaseUrl,
      });
      if (!client) {
        process.exitCode = 1;
        return;
      }

      try {
        const challenge = await client.charge({
          amount: amount as string,
          network: flags.network,
          ...(flags["payer-org"] ? { payerOrg: flags["payer-org"] } : {}),
          ...(flags.description ? { description: flags.description } : {}),
          ...(flags.resource ? { resource: flags.resource } : {}),
          ...(flags["expires-in"] !== undefined
            ? { expiresIn: flags["expires-in"] }
            : {}),
          ...(flags["idempotency-key"]
            ? { idempotencyKey: flags["idempotency-key"] }
            : {}),
        });
        // Summary to stderr so stdout stays a clean, pipeable challenge object.
        process.stderr.write(
          `Challenge ${challenge.id} for ${formatUsdc(challenge.amount)} USDC on ${challenge.network}. Hand the JSON below to the payer; they settle it with \`primitive payments pay\`.\n`,
        );
        this.log(JSON.stringify(challenge, null, 2));
      } catch (error) {
        reportX402Error(error, {
          auth,
          baseUrlOverridden,
          configDir: this.config.configDir,
        });
        process.exitCode = 1;
      }
    });
  }
}

export default PaymentsChargeCommand;
