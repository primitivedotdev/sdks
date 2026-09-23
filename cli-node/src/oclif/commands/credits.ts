import { randomUUID } from "node:crypto";
import { Args, Command, Flags } from "@oclif/core";
import type {
  CreditBalance,
  CreditRedemption,
} from "@primitivedotdev/api-core";
import { getCreditBalance, redeemCreditCode } from "@primitivedotdev/api-core";
import { createAuthenticatedCliApiClient } from "../api-client.js";
import {
  API_BASE_URL_FLAG_DESCRIPTION,
  extractErrorPayload,
  runWithTiming,
  surfaceUnauthorizedHint,
  TIME_FLAG_DESCRIPTION,
  writeErrorWithHints,
} from "../api-command.js";

// Friendly credit commands. The generated operation wrappers stay available
// as credits:get-credit-balance for raw API parity; redeem is hand-rolled for
// both ids because the generated wrapper cannot send the required
// Idempotency-Key header.

const API_KEY_FLAG = Flags.string({
  description:
    "Primitive API key override (defaults to PRIMITIVE_API_KEY or saved OAuth login credentials)",
  env: "PRIMITIVE_API_KEY",
});

const API_BASE_URL_FLAG = Flags.string({
  description: API_BASE_URL_FLAG_DESCRIPTION,
  env: "PRIMITIVE_API_BASE_URL",
  hidden: true,
});

const MICROS_PER_UNIT = 1_000_000n;

/**
 * Format an integer micros string as a currency amount. USD renders as
 * `$12.50`; other currencies as `12.50 EUR`. Two decimals are always shown,
 * and up to six when the amount has sub-cent precision. Input that is not a
 * non-negative integer string is returned unchanged with the currency code.
 */
export function formatMicros(micros: string, currency: string): string {
  const code = currency.toUpperCase();
  if (!/^[0-9]+$/.test(micros)) return `${micros} micros ${code}`.trim();
  const value = BigInt(micros);
  const whole = value / MICROS_PER_UNIT;
  const fraction = (value % MICROS_PER_UNIT)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  const amount = `${whole.toLocaleString("en-US")}.${fraction}`;
  return code === "USD" ? `$${amount}` : `${amount} ${code}`;
}

export function formatExpiry(value: string | null | undefined): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

export function formatRedemptionSummary(redemption: CreditRedemption): string {
  const lines = [
    redemption.replayed
      ? `Already redeemed with this idempotency key: ${formatMicros(redemption.amount_micros, redemption.currency)} in credit. No new credit was added.`
      : `Redeemed ${formatMicros(redemption.amount_micros, redemption.currency)} in credit.`,
    `Expires: ${formatExpiry(redemption.expires_at)}`,
  ];
  if (redemption.label?.trim()) lines.push(`Promotion: ${redemption.label}`);
  lines.push(`Redemption id: ${redemption.redemption_id}`);
  return lines.join("\n");
}

export function formatBalanceSummary(balance: CreditBalance): string {
  const lines: string[] = [];
  const prepaid = balance.prepaid_credit;
  if (prepaid === undefined) {
    lines.push("Prepaid credit: not available right now, try again shortly");
  } else if (prepaid === null) {
    lines.push("Prepaid credit: none");
  } else {
    const expiry = prepaid.next_expires_at
      ? `next expiry ${formatExpiry(prepaid.next_expires_at)}`
      : "no expiry";
    lines.push(
      `Prepaid credit: ${formatMicros(prepaid.remaining_micros, prepaid.currency)} (${expiry})`,
    );
  }
  const budget = balance.budget;
  if (!budget) {
    lines.push("Spending budget: none");
  } else {
    const details = [`status ${budget.status}`];
    if (budget.per_topup_cap_micros) {
      details.push(
        `per top-up cap ${formatMicros(budget.per_topup_cap_micros, budget.currency)}`,
      );
    }
    details.push(`expires ${formatExpiry(budget.expires_at)}`);
    lines.push(
      `Spending budget: ${formatMicros(budget.remaining_micros, budget.currency)} of ${formatMicros(budget.max_amount_micros, budget.currency)} remaining (${details.join(", ")})`,
    );
  }
  return lines.join("\n");
}

type ApiErrorBody = { code?: unknown; message?: unknown };

/**
 * Print a failed request. A server refusal (an error envelope with a
 * message) prints the message as the primary line, since the redeem route
 * writes it to be shown to the user; anything else falls back to the shared
 * error renderer. Always sets a non-zero exit code.
 */
export function reportCreditsError(
  error: unknown,
  context: Omit<Parameters<typeof surfaceUnauthorizedHint>[0], "payload">,
  options: { json: boolean; prefix: string },
): void {
  const payload = extractErrorPayload(error);
  const body = payload as ApiErrorBody | null;
  if (
    !options.json &&
    body &&
    typeof body === "object" &&
    typeof body.message === "string" &&
    typeof body.code === "string" &&
    // unauthorized keeps the shared renderer, which adds the credentials hint.
    body.code !== "unauthorized"
  ) {
    process.stderr.write(`${options.prefix}: ${body.message}\n`);
    process.stderr.write(`Error code: ${body.code}\n`);
  } else {
    writeErrorWithHints(payload);
  }
  surfaceUnauthorizedHint({ ...context, payload });
  process.exitCode = 1;
}

export class CreditsRedeemCommand extends Command {
  static description = `Redeem a credit code for your organization.

  Prints the credit added and when it expires. On a refusal (an invalid,
  already redeemed or ineligible code, for example) the server's message is
  printed and the command exits non-zero.

  Redeeming needs an organization owner or admin. With an API key, the key's
  creator must currently be an owner or admin.

  The request carries an Idempotency-Key. One is generated for each run; pass
  --idempotency-key to retry the same redemption safely, for example after a
  network error. Retrying with the same key and code returns the original
  grant and adds no second credit.`;

  static summary = "Redeem a credit code";

  static examples = [
    "<%= config.bin %> credits redeem LAUNCH50",
    "<%= config.bin %> credits redeem LAUNCH50 --idempotency-key redeem-launch50-1",
    "<%= config.bin %> credits redeem LAUNCH50 --json",
  ];

  static args = {
    code: Args.string({
      description: "The credit code to redeem.",
      required: true,
    }),
  };

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    "idempotency-key": Flags.string({
      description:
        "Idempotency key for the request, at most 200 characters. Defaults to a new random key per run; reuse a key only to retry the same code.",
    }),
    json: Flags.boolean({
      description:
        "Print the full redemption JSON on success, or the error JSON on failure.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { args, flags } = await this.parse(CreditsRedeemCommand);

    const code = args.code.trim();
    if (!code) {
      process.stderr.write("The credit code must not be empty.\n");
      process.exitCode = 1;
      return;
    }
    const idempotencyKey =
      flags["idempotency-key"]?.trim() || `cli-redeem-${randomUUID()}`;
    if (idempotencyKey.length > 200) {
      process.stderr.write(
        "--idempotency-key must be at most 200 characters.\n",
      );
      process.exitCode = 1;
      return;
    }
    // Same rule the server applies: printable ASCII without spaces.
    if (!/^[\x21-\x7E]+$/.test(idempotencyKey)) {
      process.stderr.write(
        "--idempotency-key must contain only printable ASCII characters, without spaces.\n",
      );
      process.exitCode = 1;
      return;
    }

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await redeemCreditCode({
        client: apiClient.client,
        body: { code },
        headers: { "Idempotency-Key": idempotencyKey },
        responseStyle: "fields",
      });

      if (result.error) {
        reportCreditsError(
          result.error,
          { auth, baseUrlOverridden, configDir: this.config.configDir },
          { json: Boolean(flags.json), prefix: `Could not redeem ${code}` },
        );
        return;
      }

      const redemption = (
        result.data as { data?: CreditRedemption } | undefined
      )?.data;
      if (!redemption) {
        process.stderr.write("Server returned an empty redemption body.\n");
        process.exitCode = 1;
        return;
      }
      if (flags.json) {
        this.log(JSON.stringify(redemption, null, 2));
        return;
      }
      this.log(formatRedemptionSummary(redemption));
    });
  }
}

export class CreditsBalanceCommand extends Command {
  static description = `Show your organization's credit balance.

  Prints the prepaid credit (top-ups, redeemed credit codes and granted
  credit) that can still pay for usage, and the agent spending budget when an
  operator has funded one. Pass --json for the raw response.`;

  static summary = "Show the credit balance";

  static examples = [
    "<%= config.bin %> credits balance",
    "<%= config.bin %> credits balance --json",
  ];

  static flags = {
    "api-key": API_KEY_FLAG,
    "api-base-url": API_BASE_URL_FLAG,
    json: Flags.boolean({
      description: "Print the full balance JSON response.",
    }),
    time: Flags.boolean({ description: TIME_FLAG_DESCRIPTION }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(CreditsBalanceCommand);

    const { apiClient, auth, baseUrlOverridden } =
      await createAuthenticatedCliApiClient({
        apiKey: flags["api-key"],
        apiBaseUrl: flags["api-base-url"],
        configDir: this.config.configDir,
      });

    await runWithTiming(flags.time, async () => {
      const result = await getCreditBalance({
        client: apiClient.client,
        responseStyle: "fields",
      });

      if (result.error) {
        reportCreditsError(
          result.error,
          { auth, baseUrlOverridden, configDir: this.config.configDir },
          { json: Boolean(flags.json), prefix: "Could not read the balance" },
        );
        return;
      }

      const balance = (result.data as { data?: CreditBalance } | undefined)
        ?.data;
      if (!balance) {
        process.stderr.write("Server returned an empty balance body.\n");
        process.exitCode = 1;
        return;
      }
      if (flags.json) {
        this.log(JSON.stringify(balance, null, 2));
        return;
      }
      this.log(formatBalanceSummary(balance));
    });
  }
}
