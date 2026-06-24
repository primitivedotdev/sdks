import { getAddress, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  buildExactEvmPaymentPayload,
  buildPayoutRegistrationMessage,
  computePaymentValidityWindow,
  deriveEip3009Nonce,
  type NonceBinding,
  signInteractionPayment,
  type TokenDomain,
  type TransferAuthorization,
  toPaymentPayload,
  transferWithAuthorizationTypedData,
} from "./sign.js";

// Canonical binding + the NORMATIVE nonce the platform verifier recomputes. This
// value MUST stay identical to the server's vector, or every payment fails
// verification. Do not change it without changing the server in lockstep.
const CANONICAL: NonceBinding = {
  interactionId: "a1b2c3d4-0000-0000-0000-000000000001@payer.example",
  challengeStepId: "f00dface-0000-0000-0000-0000000000aa",
  challengeNonce:
    "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899",
};
const NORMATIVE_NONCE =
  "0xc955a08812ab83f9e25c92e5162267b913957c3cc8678de1cf1449f77b516c6e";

describe("deriveEip3009Nonce", () => {
  it("matches the normative platform vector to the byte", () => {
    expect(deriveEip3009Nonce(CANONICAL)).toBe(NORMATIVE_NONCE);
  });

  it("is case-insensitive over the identifiers", () => {
    expect(
      deriveEip3009Nonce({
        ...CANONICAL,
        interactionId: CANONICAL.interactionId.toUpperCase(),
        challengeStepId: CANONICAL.challengeStepId.toUpperCase(),
      }),
    ).toBe(NORMATIVE_NONCE);
  });

  it("changes when any binding field changes", () => {
    const other = deriveEip3009Nonce({
      ...CANONICAL,
      challengeStepId: "f00dface-0000-0000-0000-0000000000ab",
    });
    expect(other).not.toBe(NORMATIVE_NONCE);
  });

  it("rejects a malformed challenge nonce", () => {
    expect(() =>
      deriveEip3009Nonce({ ...CANONICAL, challengeNonce: "xyz" }),
    ).toThrow();
    expect(() =>
      deriveEip3009Nonce({
        ...CANONICAL,
        challengeNonce: CANONICAL.challengeNonce.toUpperCase(),
      }),
    ).toThrow();
  });
});

describe("transferWithAuthorizationTypedData", () => {
  const auth: TransferAuthorization = {
    from: "0x2222222222222222222222222222222222222222",
    to: "0x1111111111111111111111111111111111111111",
    value: 10000n,
    validAfter: 1n,
    validBefore: 99999n,
    nonce: NORMATIVE_NONCE,
  };

  it("builds the EIP-712 struct with the fixed field order", () => {
    const td = transferWithAuthorizationTypedData(
      {
        name: "USDC",
        version: "2",
        chainId: 84532,
        verifyingContract: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      },
      auth,
    );
    expect(td.primaryType).toBe("TransferWithAuthorization");
    expect(td.domain).toMatchObject({
      name: "USDC",
      version: "2",
      chainId: 84532,
    });
    expect(td.types.TransferWithAuthorization.map((f) => f.name)).toEqual([
      "from",
      "to",
      "value",
      "validAfter",
      "validBefore",
      "nonce",
    ]);
  });
});

describe("toPaymentPayload", () => {
  it("stringifies the numeric fields for the wire", () => {
    const auth: TransferAuthorization = {
      from: "0x2222222222222222222222222222222222222222",
      to: "0x1111111111111111111111111111111111111111",
      value: 10000n,
      validAfter: 1n,
      validBefore: 99999n,
      nonce: NORMATIVE_NONCE,
    };
    const p = toPaymentPayload("base-sepolia", auth, "0xdeadbeef");
    expect(p).toMatchObject({
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: {
        signature: "0xdeadbeef",
        authorization: {
          value: "10000",
          validAfter: "1",
          validBefore: "99999",
        },
      },
    });
  });
});

describe("buildPayoutRegistrationMessage", () => {
  it("builds the byte-identical platform message", () => {
    const msg = buildPayoutRegistrationMessage({
      org: "11111111-1111-4111-8111-111111111111",
      address: "0x2222222222222222222222222222222222222222",
      network: "base-sepolia",
      issuedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(msg).toBe(
      "Primitive x402 payout address authorization\n\nI authorize this address as a payout destination for my Primitive organization.\n\norg: 11111111-1111-4111-8111-111111111111\naddress: 0x2222222222222222222222222222222222222222\nnetwork: base-sepolia\nissued: 2026-01-01T00:00:00.000Z",
    );
  });

  it("lowercases the address in the signed bytes", () => {
    const msg = buildPayoutRegistrationMessage({
      org: "o",
      address: "0xAbCdEf0000000000000000000000000000000000",
      network: "base",
      issuedAt: "t",
    });
    expect(msg).toContain(
      "address: 0xabcdef0000000000000000000000000000000000",
    );
  });
});

// USDC on Base Sepolia. The on-chain EIP-712 domain name is "USDC" (mainnet USDC
// reports "USD Coin" instead). A wrong name silently breaks verification.
const USDC_BASE_SEPOLIA: TokenDomain = {
  name: "USDC",
  version: "2",
  chainId: 84532,
  verifyingContract: getAddress("0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
};

const PAY_TO = getAddress("0x1111111111111111111111111111111111111111");
const AMOUNT = 10000n; // 0.01 USDC (6 decimals)

function newSigner() {
  const account = privateKeyToAccount(generatePrivateKey());
  const sign = (td: ReturnType<typeof transferWithAuthorizationTypedData>) =>
    account.signTypedData(td);
  return { account, sign, payer: account.address };
}

describe("computePaymentValidityWindow", () => {
  it("sets validBefore to expiry + margin and validAfter to now - skew", () => {
    const w = computePaymentValidityWindow({
      challengeExpiresAtSec: 2000,
      nowSec: 1000,
      settlementMarginSec: 300,
      clockSkewSec: 120,
    });
    expect(w.validBefore).toBe(2300n);
    expect(w.validAfter).toBe(880n);
  });

  it("uses minute-scale defaults (on-net: not days)", () => {
    const w = computePaymentValidityWindow({
      challengeExpiresAtSec: 2000,
      nowSec: 1000,
    });
    expect(w.validBefore).toBe(2000n + 300n);
    expect(w.validAfter).toBe(1000n - 300n);
  });

  it("throws when the window is degenerate (challenge already long expired)", () => {
    expect(() =>
      computePaymentValidityWindow({
        challengeExpiresAtSec: 1000,
        nowSec: 100000,
        settlementMarginSec: 60,
        clockSkewSec: 60,
      }),
    ).toThrow(/invalid validity window/);
  });

  it("throws when the total window exceeds the cap (expiry too far out)", () => {
    expect(() =>
      computePaymentValidityWindow({
        challengeExpiresAtSec: 1000 + 48 * 60 * 60, // 48h out, past the 24h cap
        nowSec: 1000,
      }),
    ).toThrow(/exceeds the .* cap/);
  });
});

describe("signInteractionPayment", () => {
  it("injects the interaction-bound nonce, not a random one", async () => {
    const { sign, payer } = newSigner();
    const { validAfter, validBefore } = computePaymentValidityWindow({
      challengeExpiresAtSec: 1_900_003_600,
      nowSec: 1_900_000_000,
    });
    const { authorization } = await signInteractionPayment({
      sign,
      payer,
      domain: USDC_BASE_SEPOLIA,
      payTo: PAY_TO,
      amount: AMOUNT,
      nonceBinding: CANONICAL,
      validAfter,
      validBefore,
    });
    // The bound nonce for CANONICAL is the locked normative vector.
    expect(authorization.nonce).toBe(NORMATIVE_NONCE);
  });

  it("sets from/to/value as given", async () => {
    const { sign, payer } = newSigner();
    const { authorization } = await signInteractionPayment({
      sign,
      payer,
      domain: USDC_BASE_SEPOLIA,
      payTo: PAY_TO,
      amount: AMOUNT,
      nonceBinding: CANONICAL,
      validAfter: 1n,
      validBefore: 99_999_999n,
    });
    expect(getAddress(authorization.from)).toBe(getAddress(payer));
    expect(getAddress(authorization.to)).toBe(PAY_TO);
    expect(authorization.value).toBe(AMOUNT);
  });
});

describe("buildExactEvmPaymentPayload", () => {
  const auth: TransferAuthorization = {
    from: "0x2222222222222222222222222222222222222222",
    to: PAY_TO,
    value: 10000n,
    validAfter: 1n,
    validBefore: 99_999n,
    nonce: NORMATIVE_NONCE,
  };
  // A shape-valid 65-byte EIP signature (r,s,v); not cryptographically meaningful.
  const SIG = ("0x" + "ab".repeat(65)) as Hex;

  it("wraps the authorization with x402Version 1 and decimal-string fields", () => {
    const p = buildExactEvmPaymentPayload({
      network: "base-sepolia",
      authorization: auth,
      signature: SIG,
    });
    expect(p.x402Version).toBe(1);
    expect(p.scheme).toBe("exact");
    expect(p.network).toBe("base-sepolia");
    expect(p.payload.signature).toBe(SIG);
    expect(p.payload.authorization.from).toBe(auth.from);
    expect(p.payload.authorization.to).toBe(PAY_TO);
    expect(p.payload.authorization.value).toBe("10000");
    expect(p.payload.authorization.validAfter).toBe("1");
    expect(p.payload.authorization.validBefore).toBe("99999");
    expect(p.payload.authorization.nonce).toBe(auth.nonce);
  });

  it("rejects a malformed signature", () => {
    expect(() =>
      buildExactEvmPaymentPayload({
        network: "base-sepolia",
        authorization: auth,
        signature: "not-hex" as Hex,
      }),
    ).toThrow(/signature/);
  });

  it("rejects a malformed nonce", () => {
    expect(() =>
      buildExactEvmPaymentPayload({
        network: "base-sepolia",
        authorization: { ...auth, nonce: "0xdeadbeef" as Hex },
        signature: SIG,
      }),
    ).toThrow(/nonce/);
  });
});
