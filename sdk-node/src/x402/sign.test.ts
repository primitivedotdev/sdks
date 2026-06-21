import { describe, expect, it } from "vitest";
import {
  deriveEip3009Nonce,
  type NonceBinding,
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
