import { getAddress, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it } from "vitest";
import {
  buildExactEvmPaymentPayload,
  buildPaymentStepEnvelope,
  buildPayoutRegistrationMessage,
  computePaymentValidityWindow,
  DEFAULT_MAX_WINDOW_SEC,
  DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC,
  deriveEip3009Nonce,
  type NonceBinding,
  signInteractionPayment,
  type TokenDomain,
  type TransferAuthorization,
  toPaymentPayload,
  transferWithAuthorizationTypedData,
  X402_INTERACTION_PROTOCOL,
  X402_INTERACTION_PROTOCOL_VERSION,
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
const TEST_KEY = [
  "0xac0974bec39a17e3",
  "6ba4a6b4d238ff94",
  "4bacb478cbed5efc",
  "ae784d7bf4f2ff80",
].join("") as Hex;
const TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const PAYOUT_SIGNATURE =
  "0xdc3458886b30a1707d8f7520236fd7f540809655596dfaba074cf5497dd3a7142714e7904f50ee17c08616917353fbe2e2847ec9b796e4017189fa645aff9bc91b";
const TRANSFER_SIGNATURE =
  "0x7b4900f43d7eca503136a94065a333144959683cc1d112352bcfa9eb007e83727316924e11486d35b2a3f16b561971cc3cd07bfd6c30d49b1f0da3ab7deab7e91c";

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

  it("matches the viem-compatible deterministic signature vector", async () => {
    const account = privateKeyToAccount(TEST_KEY);
    expect(account.address).toBe(TEST_ADDRESS);
    const msg = buildPayoutRegistrationMessage({
      org: "11111111-1111-4111-8111-111111111111",
      address: "0x2222222222222222222222222222222222222222",
      network: "base-sepolia",
      issuedAt: "2026-01-01T00:00:00.000Z",
    });
    await expect(account.signMessage({ message: msg })).resolves.toBe(
      PAYOUT_SIGNATURE,
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

  it("clamps a too-tight window up to the settlement-headroom floor", () => {
    // The challenge already expired, so expiry + margin lands in the past: the
    // raw validBefore is below now. The default path clamps it up to
    // now + minHeadroom rather than throwing, so the payer gets a signable
    // window instead of a guaranteed rejection.
    const now = 100_000;
    const w = computePaymentValidityWindow({
      challengeExpiresAtSec: 1000,
      nowSec: now,
      settlementMarginSec: 60,
      clockSkewSec: 60,
    });
    expect(w.validBefore).toBe(
      BigInt(now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC),
    );
    expect(w.validBefore).toBeGreaterThan(w.validAfter);
    expect(w.validBefore - w.validAfter).toBeLessThanOrEqual(
      BigInt(DEFAULT_MAX_WINDOW_SEC),
    );
  });

  it("clamps a too-wide window down to the cap (expiry too far out)", () => {
    const now = 1000;
    const w = computePaymentValidityWindow({
      challengeExpiresAtSec: now + 48 * 60 * 60, // 48h out, past the 24h cap
      nowSec: now,
    });
    // validBefore is pulled down to validAfter + the 24h cap.
    expect(w.validBefore - w.validAfter).toBe(BigInt(DEFAULT_MAX_WINDOW_SEC));
    expect(w.validBefore).toBeGreaterThanOrEqual(
      BigInt(now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC),
    );
  });

  it("rejects a caller-pinned too-tight validBefore when clamp is off, naming the bound", () => {
    const now = 1000;
    expect(() =>
      computePaymentValidityWindow({
        challengeExpiresAtSec: now + 600,
        nowSec: now,
        validBeforeSec: now + 5, // only 5s headroom, below the 60s floor
        clamp: false,
      }),
    ).toThrow(/settlement headroom/);
  });

  it("rejects a caller-pinned too-wide validBefore when clamp is off, naming the bound", () => {
    const now = 1000;
    expect(() =>
      computePaymentValidityWindow({
        challengeExpiresAtSec: now + 600,
        nowSec: now,
        validBeforeSec: now + 48 * 60 * 60, // 48h out, past the 24h cap
        clamp: false,
      }),
    ).toThrow(/window is too wide/);
  });

  it("clamps a caller-pinned out-of-band validBefore when clamp stays on", () => {
    const now = 1000;
    const tight = computePaymentValidityWindow({
      challengeExpiresAtSec: now + 600,
      nowSec: now,
      validBeforeSec: now + 5,
    });
    expect(tight.validBefore).toBe(
      BigInt(now + DEFAULT_MIN_SETTLEMENT_HEADROOM_SEC),
    );
    const wide = computePaymentValidityWindow({
      challengeExpiresAtSec: now + 600,
      nowSec: now,
      validBeforeSec: now + 48 * 60 * 60,
    });
    expect(wide.validBefore - wide.validAfter).toBe(
      BigInt(DEFAULT_MAX_WINDOW_SEC),
    );
  });

  it("accepts a caller-pinned in-band validBefore unchanged under clamp:false", () => {
    const now = 1000;
    const w = computePaymentValidityWindow({
      challengeExpiresAtSec: now + 600,
      nowSec: now,
      validBeforeSec: now + 900,
      clamp: false,
    });
    expect(w.validBefore).toBe(BigInt(now + 900));
  });
});

describe("signInteractionPayment", () => {
  it("matches the viem-compatible deterministic EIP-3009 signature vector", async () => {
    const account = privateKeyToAccount(TEST_KEY);
    const typed = transferWithAuthorizationTypedData(USDC_BASE_SEPOLIA, {
      from: "0x2222222222222222222222222222222222222222",
      to: PAY_TO,
      value: AMOUNT,
      validAfter: 1n,
      validBefore: 99_999n,
      nonce: NORMATIVE_NONCE,
    });

    await expect(account.signTypedData(typed)).resolves.toBe(
      TRANSFER_SIGNATURE,
    );
  });

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
  const SIG = `0x${"ab".repeat(65)}` as Hex;

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

describe("buildPaymentStepEnvelope", () => {
  const SIG = `0x${"ab".repeat(65)}` as Hex;
  const payment = buildExactEvmPaymentPayload({
    network: "base-sepolia",
    authorization: {
      from: "0x2222222222222222222222222222222222222222",
      to: PAY_TO,
      value: 10000n,
      validAfter: 1n,
      validBefore: 99_999n,
      nonce: NORMATIVE_NONCE,
    },
    signature: SIG,
  });
  const INTERACTION_ID = "a1b2c3d4-0000-0000-0000-000000000001@payer.example";
  const STEP_ID = "11111111-1111-4111-8111-111111111111";
  const PREV_STEP_ID = "f00dface-0000-0000-0000-0000000000aa";

  it("builds the x402.payment payment-step envelope", () => {
    const { envelope, json } = buildPaymentStepEnvelope({
      interactionId: INTERACTION_ID,
      stepId: STEP_ID,
      prevStepId: PREV_STEP_ID,
      payment,
    });
    expect(envelope).toEqual({
      interaction_version: 1,
      interaction_id: INTERACTION_ID,
      protocol: X402_INTERACTION_PROTOCOL,
      protocol_version: X402_INTERACTION_PROTOCOL_VERSION,
      step: "payment",
      step_id: STEP_ID,
      prev_step_id: PREV_STEP_ID,
      expires_at: null,
      payload: { payment },
    });
    // The JSON is the canonical bytes the platform reads back.
    expect(JSON.parse(json)).toEqual(envelope);
  });

  it("carries the exact signed payment payload unchanged", () => {
    const { envelope } = buildPaymentStepEnvelope({
      interactionId: INTERACTION_ID,
      stepId: STEP_ID,
      prevStepId: PREV_STEP_ID,
      payment,
    });
    expect(envelope.payload.payment.payload.authorization.nonce).toBe(
      NORMATIVE_NONCE,
    );
    expect(envelope.payload.payment.payload.signature).toBe(SIG);
  });

  it("threads the payment step after the challenge step", () => {
    const { envelope } = buildPaymentStepEnvelope({
      interactionId: INTERACTION_ID,
      stepId: STEP_ID,
      prevStepId: PREV_STEP_ID,
      payment,
    });
    expect(envelope.prev_step_id).toBe(PREV_STEP_ID);
    expect(envelope.step_id).toBe(STEP_ID);
  });

  it("rejects a non-uuid@domain interaction id", () => {
    expect(() =>
      buildPaymentStepEnvelope({
        interactionId: "not-a-wire-id",
        stepId: STEP_ID,
        prevStepId: PREV_STEP_ID,
        payment,
      }),
    ).toThrow(/uuid@domain/);
  });

  it("rejects non-uuid step ids", () => {
    expect(() =>
      buildPaymentStepEnvelope({
        interactionId: INTERACTION_ID,
        stepId: "nope",
        prevStepId: PREV_STEP_ID,
        payment,
      }),
    ).toThrow(/stepId/);
    expect(() =>
      buildPaymentStepEnvelope({
        interactionId: INTERACTION_ID,
        stepId: STEP_ID,
        prevStepId: "nope",
        payment,
      }),
    ).toThrow(/prevStepId/);
  });
});
