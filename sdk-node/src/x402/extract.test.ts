import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { parseEmailChallengeFromPart, X402Error } from "./client.js";

// The challenge-step interaction.json an inbound payer email carries. Its
// `step_id` is the challenge step id (a nonce-binding input), and the payload
// carries the challenge_nonce + payment_requirements the payer signs over. The
// platform's private challenge id is NOT on the wire.
const INTERACTION_ID = "a1b2c3d4-0000-0000-0000-000000000001@payer.example";
const CHALLENGE_STEP_ID = "f00dface-0000-0000-0000-0000000000aa";
const CHALLENGE_NONCE =
  "aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899";

function validEnvelope(): Record<string, unknown> {
  return {
    interaction_version: 1,
    interaction_id: INTERACTION_ID,
    protocol: "x402.payment",
    protocol_version: 1,
    step: "challenge",
    step_id: CHALLENGE_STEP_ID,
    prev_step_id: null,
    expires_at: "2030-01-01T00:00:00.000Z",
    payload: {
      challenge_nonce: CHALLENGE_NONCE,
      payment_requirements: {
        scheme: "exact",
        network: "base-sepolia",
        maxAmountRequired: "10000",
        payTo: "0x1111111111111111111111111111111111111111",
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra: { name: "USDC", version: "2" },
      },
    },
  };
}

describe("parseEmailChallengeFromPart", () => {
  it("round-trips a real challenge part (string) to a typed challenge", () => {
    const json = JSON.stringify(validEnvelope());
    const challenge = parseEmailChallengeFromPart(json);
    expect(challenge.interaction_id).toBe(INTERACTION_ID);
    // The challenge id is not carried on the wire; payEmailChallenge does not
    // need it (it binds to interaction_id + the challenge step id).
    expect(challenge.challenge_id).toBe("");
    expect(challenge.challenge.expires_at).toBe("2030-01-01T00:00:00.000Z");
    expect(challenge.challenge.nonce_binding).toEqual({
      interaction_id: INTERACTION_ID,
      challenge_step_id: CHALLENGE_STEP_ID,
      challenge_nonce: CHALLENGE_NONCE,
    });
    expect(challenge.challenge.payment_requirements.maxAmountRequired).toBe(
      "10000",
    );
  });

  it("accepts the part as raw bytes (Buffer) and a parsed object", () => {
    const bytes = Buffer.from(JSON.stringify(validEnvelope()), "utf8");
    expect(parseEmailChallengeFromPart(bytes).interaction_id).toBe(
      INTERACTION_ID,
    );
    expect(parseEmailChallengeFromPart(validEnvelope()).interaction_id).toBe(
      INTERACTION_ID,
    );
  });

  it("rejects non-JSON bytes", () => {
    expect(() => parseEmailChallengeFromPart("not json {")).toThrow(X402Error);
    expect(() => parseEmailChallengeFromPart("not json {")).toThrow(
      /not valid JSON/,
    );
  });

  it("rejects a non-challenge step (e.g. a payment part)", () => {
    const env = validEnvelope();
    env.step = "payment";
    expect(() => parseEmailChallengeFromPart(JSON.stringify(env))).toThrow(
      /step \(expected "challenge"/,
    );
  });

  it("rejects the wrong protocol", () => {
    const env = validEnvelope();
    env.protocol = "something.else";
    expect(() => parseEmailChallengeFromPart(JSON.stringify(env))).toThrow(
      /protocol/,
    );
  });

  it("rejects a malformed challenge_nonce", () => {
    const env = validEnvelope();
    (env.payload as Record<string, unknown>).challenge_nonce = "tooshort";
    expect(() => parseEmailChallengeFromPart(JSON.stringify(env))).toThrow(
      /challenge_nonce/,
    );
  });

  it("rejects a missing interaction_id", () => {
    const env = validEnvelope();
    env.interaction_id = "not-a-wire-id";
    expect(() => parseEmailChallengeFromPart(JSON.stringify(env))).toThrow(
      /interaction_id/,
    );
  });

  it("rejects malformed payment_requirements (caught by the hydration check)", () => {
    const env = validEnvelope();
    (env.payload as Record<string, unknown>).payment_requirements = {
      scheme: "exact",
      network: "base-sepolia",
      maxAmountRequired: "0", // not a positive integer
      payTo: "0x1111111111111111111111111111111111111111",
      asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      extra: { name: "USDC", version: "2" },
    };
    expect(() => parseEmailChallengeFromPart(JSON.stringify(env))).toThrow(
      /maxAmountRequired/,
    );
  });
});
