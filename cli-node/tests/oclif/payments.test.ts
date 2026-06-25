import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { X402Error } from "@primitivedotdev/sdk/x402";
import { describe, expect, it, vi } from "vitest";
import { readChallenge } from "../../src/oclif/commands/payments-pay.js";
import { readEmailChallenge } from "../../src/oclif/commands/payments-pay-email-step.js";
import {
  explorerTxUrl,
  formatUsdc,
  signerFromPrivateKey,
  usdcToBaseUnits,
  x402BaseUrl,
} from "../../src/oclif/commands/payments-shared.js";
import { COMMANDS } from "../../src/oclif/index.js";

// A well-known test key with a deterministic address, so the signer-derivation
// test is reproducible without embedding a real secret. This is viem's own
// documented example key (address 0xf39F...2266).
const TEST_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

describe("payments command registration", () => {
  it("registers the signing commands and their friendly aliases", () => {
    expect(COMMANDS["payments:register-payout-address"]).toBeDefined();
    expect(COMMANDS["payments:register-payout"]).toBeDefined();
    expect(COMMANDS["payments:pay-challenge"]).toBeDefined();
    expect(COMMANDS["payments:pay"]).toBeDefined();
    expect(COMMANDS["payments:pay-email-step"]).toBeDefined();
    expect(COMMANDS["payments:pay-email"]).toBeDefined();
  });

  it("keeps the non-signing operations as auto-generated commands", () => {
    expect(COMMANDS["payments:create-challenge"]).toBeDefined();
    expect(COMMANDS["payments:create-email-challenge"]).toBeDefined();
    expect(COMMANDS["payments:get-challenge"]).toBeDefined();
    expect(COMMANDS["payments:list-payout-addresses"]).toBeDefined();
    expect(COMMANDS["payments:get-spend-policy"]).toBeDefined();
    expect(COMMANDS["payments:update-spend-policy"]).toBeDefined();
  });

  it("registers the friendly charge verb", () => {
    expect(COMMANDS["payments:charge"]).toBeDefined();
  });
});

describe("usdcToBaseUnits", () => {
  it("converts whole and fractional USDC to base units", () => {
    expect(usdcToBaseUnits("0.01")).toBe("10000");
    expect(usdcToBaseUnits("1")).toBe("1000000");
    expect(usdcToBaseUnits("1.5")).toBe("1500000");
    expect(usdcToBaseUnits("0.000001")).toBe("1");
  });

  it("rejects non-positive, malformed, or over-precise input", () => {
    expect(usdcToBaseUnits("0")).toBeNull();
    expect(usdcToBaseUnits("-1")).toBeNull();
    expect(usdcToBaseUnits("abc")).toBeNull();
    expect(usdcToBaseUnits("0.0000001")).toBeNull(); // 7 decimals
  });
});

describe("formatUsdc", () => {
  it("formats base units back to a human amount", () => {
    expect(formatUsdc("10000")).toBe("0.01");
    expect(formatUsdc("1000000")).toBe("1");
    expect(formatUsdc("1500000")).toBe("1.5");
  });
});

describe("explorerTxUrl", () => {
  const tx = `0x${"a".repeat(64)}`;
  it("builds basescan URLs per network", () => {
    expect(explorerTxUrl("base", tx)).toBe(`https://basescan.org/tx/${tx}`);
    expect(explorerTxUrl("base-sepolia", tx)).toBe(
      `https://sepolia.basescan.org/tx/${tx}`,
    );
  });
  it("returns null for unknown networks or malformed tx", () => {
    expect(explorerTxUrl("ethereum", tx)).toBeNull();
    expect(explorerTxUrl("base", "0xnope")).toBeNull();
  });
});

describe("x402BaseUrl", () => {
  it("strips a trailing /v1 so the x402 client can re-append it", () => {
    expect(x402BaseUrl("https://api.primitive.dev/v1")).toBe(
      "https://api.primitive.dev",
    );
    expect(x402BaseUrl("https://api.primitive.dev/v1/")).toBe(
      "https://api.primitive.dev",
    );
  });

  it("leaves a host without /v1 unchanged", () => {
    expect(x402BaseUrl("http://localhost:8787")).toBe("http://localhost:8787");
  });
});

describe("signerFromPrivateKey", () => {
  it("derives the expected address from a 0x-prefixed key", () => {
    const signer = signerFromPrivateKey(TEST_KEY);
    expect(signer.address).toBe(TEST_ADDRESS);
  });

  it("accepts a key without the 0x prefix", () => {
    const signer = signerFromPrivateKey(TEST_KEY.slice(2));
    expect(signer.address).toBe(TEST_ADDRESS);
  });

  it("rejects a malformed key with a status-0 X402Error", () => {
    expect(() => signerFromPrivateKey("not-a-key")).toThrow(X402Error);
    try {
      signerFromPrivateKey("");
    } catch (err) {
      expect(err).toBeInstanceOf(X402Error);
      expect((err as X402Error).status).toBe(0);
    }
  });
});

describe("readChallenge", () => {
  const challenge = {
    id: "11111111-1111-4111-8111-111111111111",
    network: "base-sepolia",
  };

  it("parses an inline bare challenge object", () => {
    expect(readChallenge({ inline: JSON.stringify(challenge) })).toEqual(
      challenge,
    );
  });

  it("unwraps a { data: ... } envelope so create-challenge output pipes in", () => {
    expect(
      readChallenge({ inline: JSON.stringify({ data: challenge }) }),
    ).toEqual(challenge);
  });

  it("reads from a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "x402-"));
    const file = join(dir, "challenge.json");
    writeFileSync(file, JSON.stringify(challenge));
    expect(readChallenge({ file })).toEqual(challenge);
  });

  it("rejects invalid JSON", () => {
    expect(() => readChallenge({ inline: "{not json" })).toThrow(
      /not valid JSON/,
    );
  });

  it("rejects empty input", () => {
    expect(() => readChallenge({ inline: "   " })).toThrow(/no challenge/);
  });
});

describe("readEmailChallenge", () => {
  const emailChallenge = {
    interaction_id: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
    challenge_id: "22222222-2222-4222-8222-222222222222",
    challenge: { expires_at: "2099-01-01T00:00:00.000Z" },
  };

  it("parses an inline bare email-challenge object", () => {
    expect(
      readEmailChallenge({ inline: JSON.stringify(emailChallenge) }),
    ).toEqual(emailChallenge);
  });

  it("unwraps a { data: ... } envelope so create-email-challenge output pipes in", () => {
    expect(
      readEmailChallenge({ inline: JSON.stringify({ data: emailChallenge }) }),
    ).toEqual(emailChallenge);
  });

  it("reads from a file", () => {
    const dir = mkdtempSync(join(tmpdir(), "x402-email-"));
    const file = join(dir, "challenge.json");
    writeFileSync(file, JSON.stringify(emailChallenge));
    expect(readEmailChallenge({ file })).toEqual(emailChallenge);
  });

  it("rejects invalid JSON", () => {
    expect(() => readEmailChallenge({ inline: "{not json" })).toThrow(
      /not valid JSON/,
    );
  });

  it("rejects empty input", () => {
    expect(() => readEmailChallenge({ inline: "   " })).toThrow(/no challenge/);
  });

  it("rejects a { data: null } envelope instead of returning null", () => {
    expect(() =>
      readEmailChallenge({ inline: JSON.stringify({ data: null }) }),
    ).toThrow(/no `data` object/);
  });
});

describe("reportX402Error", () => {
  it("prefers the server error envelope when present", async () => {
    const { reportX402Error } = await import(
      "../../src/oclif/commands/payments-shared.js"
    );
    const writes: string[] = [];
    const spy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        writes.push(String(chunk));
        return true;
      });
    const err = new X402Error("declined", 422, {
      success: false,
      error: {
        code: "payment_declined",
        message: "exceeds the per-payment cap",
      },
    });
    reportX402Error(err, {
      auth: {
        source: "flag-or-env",
        apiKey: "k",
        apiBaseUrl: "u",
        credentials: null,
      },
      baseUrlOverridden: false,
      configDir: "/tmp",
    });
    spy.mockRestore();
    expect(writes.join("")).toContain("exceeds the per-payment cap");
  });
});
