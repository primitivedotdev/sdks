import { resolve } from "node:path";
import { operationManifest } from "@primitivedotdev/api-core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAuthenticatedCliApiClient: vi.fn(),
  getCreditBalance: vi.fn(),
  redeemCreditCode: vi.fn(),
}));

vi.mock("@primitivedotdev/api-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@primitivedotdev/api-core")>();
  return {
    ...actual,
    getCreditBalance: mocks.getCreditBalance,
    redeemCreditCode: mocks.redeemCreditCode,
  };
});

vi.mock("../../src/oclif/api-client.js", () => ({
  createAuthenticatedCliApiClient: mocks.createAuthenticatedCliApiClient,
}));

import {
  CreditsBalanceCommand,
  CreditsRedeemCommand,
  formatBalanceSummary,
  formatExpiry,
  formatMicros,
  formatRedemptionSummary,
} from "../../src/oclif/commands/credits.js";
import { COMMANDS, lookupOperation } from "../../src/oclif/index.js";

const CLI_ROOT = resolve(import.meta.dirname, "../..");

const REDEMPTION = {
  redemption_id: "red_1",
  amount_micros: "50000000",
  currency: "usd",
  granted_at: "2026-09-23T17:00:00.000Z",
  expires_at: "2026-12-31T00:00:00.000Z",
  label: null,
  replayed: false,
  message:
    "$50.00 in credits added. Expires Dec 31, 2026. Applies to usage from now on.",
};

type Runnable = {
  run(argv: string[], options: { root: string }): Promise<unknown>;
};

async function runCommand(
  command: Runnable,
  argv: string[],
): Promise<{
  exitCode: NodeJS.Process["exitCode"];
  stdout: string;
  stderr: string;
}> {
  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  const previousExitCode = process.exitCode;
  process.exitCode = undefined;
  const logSpy = vi.spyOn(console, "log").mockImplementation((message = "") => {
    stdoutChunks.push(`${String(message)}\n`);
  });
  const stderrSpy = vi
    .spyOn(process.stderr, "write")
    .mockImplementation((chunk) => {
      stderrChunks.push(String(chunk));
      return true;
    });
  try {
    await command.run(argv, { root: CLI_ROOT });
    return {
      exitCode: process.exitCode,
      stdout: stdoutChunks.join(""),
      stderr: stderrChunks.join(""),
    };
  } finally {
    logSpy.mockRestore();
    stderrSpy.mockRestore();
    process.exitCode = previousExitCode;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createAuthenticatedCliApiClient.mockResolvedValue({
    apiClient: { client: { host: "api" } },
    auth: { kind: "api-key", source: "flag" },
    baseUrlOverridden: false,
  });
  mocks.redeemCreditCode.mockResolvedValue({
    data: { success: true, data: REDEMPTION },
  });
  mocks.getCreditBalance.mockResolvedValue({
    data: {
      success: true,
      data: {
        budget: null,
        prepaid_credit: {
          currency: "usd",
          remaining_micros: "42500000",
          next_expires_at: null,
        },
      },
    },
  });
});

describe("credits command registration", () => {
  it("registers friendly and operation-shaped ids", () => {
    expect(COMMANDS["credits:redeem"]).toBe(CreditsRedeemCommand);
    expect(COMMANDS["credits:redeem-credit-code"]).toBe(CreditsRedeemCommand);
    expect(COMMANDS["credits:balance"]).toBe(CreditsBalanceCommand);
    expect(COMMANDS["credits:get-credit-balance"]).toBeDefined();
    expect(COMMANDS["credits:get-credit-balance"]).not.toBe(
      CreditsBalanceCommand,
    );
  });

  it("generates both operations from the spec", () => {
    expect(
      operationManifest.find((op) => op.operationId === "redeemCreditCode"),
    ).toMatchObject({
      method: "POST",
      path: "/credits/redeem",
      tag: "Credits",
    });
    expect(
      operationManifest.find((op) => op.operationId === "getCreditBalance"),
    ).toMatchObject({
      method: "GET",
      path: "/credits/balance",
      tag: "Credits",
    });
  });

  it("resolves the friendly ids in describe lookups", () => {
    expect(lookupOperation("credits:redeem").match?.operationId).toBe(
      "redeemCreditCode",
    );
    expect(lookupOperation("credits:balance").match?.operationId).toBe(
      "getCreditBalance",
    );
  });
});

describe("credit formatting", () => {
  it("formats micros as currency amounts", () => {
    expect(formatMicros("50000000", "usd")).toBe("$50.00");
    expect(formatMicros("1234567890000", "usd")).toBe("$1,234,567.89");
    expect(formatMicros("1500", "usd")).toBe("$0.0015");
    expect(formatMicros("0", "usd")).toBe("$0.00");
    expect(formatMicros("2500000", "eur")).toBe("2.50 EUR");
    expect(formatMicros("abc", "usd")).toBe("abc micros USD");
  });

  it("formats expiry dates", () => {
    expect(formatExpiry(null)).toBe("never");
    expect(formatExpiry(undefined)).toBe("never");
    expect(formatExpiry("2026-12-31T00:00:00.000Z")).toBe("2026-12-31");
    expect(formatExpiry("not a date")).toBe("not a date");
  });

  it("summarizes a fresh redemption and a replay", () => {
    expect(formatRedemptionSummary(REDEMPTION)).toBe(
      "Redeemed $50.00 in credit.\nExpires: 2026-12-31\nRedemption id: red_1",
    );
    const replay = formatRedemptionSummary({
      ...REDEMPTION,
      replayed: true,
      expires_at: null,
      label: "Launch week",
    });
    expect(replay).toContain("No new credit was added.");
    expect(replay).toContain("Expires: never");
    expect(replay).toContain("Promotion: Launch week");
  });

  it("summarizes every balance shape", () => {
    expect(
      formatBalanceSummary({
        budget: {
          currency: "usd",
          max_amount_micros: "20000000",
          spent_micros: "4500000",
          remaining_micros: "15500000",
          per_topup_cap_micros: "5000000",
          expires_at: null,
          status: "active",
        },
        prepaid_credit: {
          currency: "usd",
          remaining_micros: "4200000",
          next_expires_at: "2026-12-31T00:00:00.000Z",
        },
      }),
    ).toBe(
      "Prepaid credit: $4.20 (next expiry 2026-12-31)\nSpending budget: $15.50 of $20.00 remaining (status active, per top-up cap $5.00, expires never)",
    );
    expect(formatBalanceSummary({ budget: null, prepaid_credit: null })).toBe(
      "Prepaid credit: none\nSpending budget: none",
    );
    expect(formatBalanceSummary({ budget: null })).toContain(
      "Prepaid credit: not available right now",
    );
  });
});

describe("credits redeem", () => {
  it("redeems with a generated Idempotency-Key and prints the grant", async () => {
    const result = await runCommand(CreditsRedeemCommand, [" LAUNCH50 "]);

    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toContain("Redeemed $50.00 in credit.");
    expect(result.stdout).toContain("Expires: 2026-12-31");
    expect(mocks.redeemCreditCode).toHaveBeenCalledTimes(1);
    const [call] = mocks.redeemCreditCode.mock.calls[0] ?? [];
    expect(call.body).toEqual({ code: "LAUNCH50" });
    expect(call.headers["Idempotency-Key"]).toMatch(
      /^cli-redeem-[0-9a-f-]{36}$/,
    );
  });

  it("uses a new key per run and the supplied key when given", async () => {
    await runCommand(CreditsRedeemCommand, ["LAUNCH50"]);
    await runCommand(CreditsRedeemCommand, ["LAUNCH50"]);
    await runCommand(CreditsRedeemCommand, [
      "LAUNCH50",
      "--idempotency-key",
      "retry-1",
    ]);
    const keys = mocks.redeemCreditCode.mock.calls.map(
      (call) => call[0].headers["Idempotency-Key"],
    );
    expect(keys[0]).not.toBe(keys[1]);
    expect(keys[2]).toBe("retry-1");
  });

  it("prints the JSON redemption with --json", async () => {
    const result = await runCommand(CreditsRedeemCommand, [
      "LAUNCH50",
      "--json",
    ]);
    expect(JSON.parse(result.stdout)).toEqual(REDEMPTION);
  });

  it("prints the refusal message and exits non-zero", async () => {
    mocks.redeemCreditCode.mockResolvedValue({
      error: {
        success: false,
        error: {
          code: "credit_code_already_redeemed",
          message: "Your organization has already redeemed this promotion.",
        },
      },
    });
    const result = await runCommand(CreditsRedeemCommand, ["LAUNCH50"]);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      "Could not redeem LAUNCH50: Your organization has already redeemed this promotion.",
    );
    expect(result.stderr).toContain("Error code: credit_code_already_redeemed");
  });

  it("keeps the error JSON and the credentials hint for unauthorized", async () => {
    mocks.redeemCreditCode.mockResolvedValue({
      error: {
        success: false,
        error: { code: "unauthorized", message: "Invalid or missing API key" },
      },
    });
    const result = await runCommand(CreditsRedeemCommand, ["LAUNCH50"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"code": "unauthorized"');
    expect(result.stderr).toContain("Hint:");
  });

  it("prints the error JSON on refusal with --json", async () => {
    mocks.redeemCreditCode.mockResolvedValue({
      error: {
        success: false,
        error: { code: "credit_code_invalid", message: "Not valid." },
      },
    });
    const result = await runCommand(CreditsRedeemCommand, [
      "LAUNCH50",
      "--json",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('"code": "credit_code_invalid"');
  });

  it("rejects a blank code or an overlong key before calling the API", async () => {
    const blank = await runCommand(CreditsRedeemCommand, ["   "]);
    expect(blank.exitCode).toBe(1);
    expect(blank.stderr).toContain("must not be empty");
    const long = await runCommand(CreditsRedeemCommand, [
      "LAUNCH50",
      "--idempotency-key",
      "k".repeat(201),
    ]);
    expect(long.exitCode).toBe(1);
    expect(long.stderr).toContain("at most 200 characters");
    for (const key of ["a b", "café"]) {
      const invalid = await runCommand(CreditsRedeemCommand, [
        "LAUNCH50",
        "--idempotency-key",
        key,
      ]);
      expect(invalid.exitCode).toBe(1);
      expect(invalid.stderr).toContain("printable ASCII");
    }
    expect(mocks.redeemCreditCode).not.toHaveBeenCalled();
  });

  it("fails on an empty success body", async () => {
    mocks.redeemCreditCode.mockResolvedValue({ data: { success: true } });
    const result = await runCommand(CreditsRedeemCommand, ["LAUNCH50"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("empty redemption body");
  });
});

describe("credits balance", () => {
  it("prints a readable summary", async () => {
    const result = await runCommand(CreditsBalanceCommand, []);
    expect(result.exitCode).toBeUndefined();
    expect(result.stdout).toBe(
      "Prepaid credit: $42.50 (no expiry)\nSpending budget: none\n",
    );
  });

  it("prints the raw balance with --json", async () => {
    const result = await runCommand(CreditsBalanceCommand, ["--json"]);
    expect(JSON.parse(result.stdout)).toEqual({
      budget: null,
      prepaid_credit: {
        currency: "usd",
        remaining_micros: "42500000",
        next_expires_at: null,
      },
    });
  });

  it("reports failures with a non-zero exit", async () => {
    mocks.getCreditBalance.mockResolvedValue({
      error: {
        success: false,
        error: { code: "rate_limit_exceeded", message: "Rate limit exceeded" },
      },
    });
    const result = await runCommand(CreditsBalanceCommand, []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "Could not read the balance: Rate limit exceeded",
    );
  });

  it("fails on an empty success body", async () => {
    mocks.getCreditBalance.mockResolvedValue({ data: { success: true } });
    const result = await runCommand(CreditsBalanceCommand, []);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("empty balance body");
  });
});
