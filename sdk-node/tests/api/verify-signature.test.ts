import { describe, expect, it } from "vitest";
import {
  PRIMITIVE_SIGNATURE_HEADER,
  verifyWebhookSignature,
  WebhookVerificationError,
} from "../../src/api/verify-signature.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";

// The Workers-safe verifier in src/api/verify-signature.ts must produce
// the same accept/reject decisions as the Node verifier in
// src/webhook/signing.ts for every shape of input. The signing side
// stays on node:crypto (faster path for server-side use), so these
// tests use signWebhookPayload from the Node module to generate
// fixtures and assert the Web Crypto verifier accepts them.

const SECRET = "whsec_test_workers_safe_verify_2026";

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

describe("PRIMITIVE_SIGNATURE_HEADER", () => {
  it("matches the canonical header name", () => {
    expect(PRIMITIVE_SIGNATURE_HEADER).toBe("Primitive-Signature");
  });
});

describe("verifyWebhookSignature (Web Crypto)", () => {
  it("accepts a signature produced by the Node signWebhookPayload helper", async () => {
    const rawBody = '{"event":"email.received","email":{"id":"e1"}}';
    const ts = nowSec();
    const signed = signWebhookPayload(rawBody, SECRET, ts);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: signed.header,
        secret: SECRET,
        nowSeconds: ts,
      }),
    ).resolves.toBe(true);
  });

  it("rejects a tampered body with SIGNATURE_MISMATCH", async () => {
    const rawBody = '{"event":"email.received","email":{"id":"e1"}}';
    const ts = nowSec();
    const signed = signWebhookPayload(rawBody, SECRET, ts);

    await expect(
      verifyWebhookSignature({
        rawBody: `${rawBody} `, // single trailing space changes the HMAC
        signatureHeader: signed.header,
        secret: SECRET,
        nowSeconds: ts,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "SIGNATURE_MISMATCH",
    });
  });

  it("rejects an old timestamp with TIMESTAMP_OUT_OF_RANGE", async () => {
    const rawBody = "{}";
    const tooOld = nowSec() - 600; // 10 minutes back; default tolerance is 5
    const signed = signWebhookPayload(rawBody, SECRET, tooOld);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: signed.header,
        secret: SECRET,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "TIMESTAMP_OUT_OF_RANGE",
    });
  });

  it("rejects a far-future timestamp with TIMESTAMP_OUT_OF_RANGE", async () => {
    const rawBody = "{}";
    const tooFuture = nowSec() + 600;
    const signed = signWebhookPayload(rawBody, SECRET, tooFuture);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: signed.header,
        secret: SECRET,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "TIMESTAMP_OUT_OF_RANGE",
    });
  });

  it("range-rejects an 11+ digit timestamp like the Node verifier (not a header error)", async () => {
    // A 12-digit unix-seconds value parses fine but is far future. The Node
    // verifier returns TIMESTAMP_OUT_OF_RANGE; the Web Crypto verifier must
    // agree (it previously short-circuited to INVALID_SIGNATURE_HEADER on the
    // digit-count regex).
    await expect(
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=100000000000,v1=abc",
        secret: SECRET,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "TIMESTAMP_OUT_OF_RANGE",
    });
  });

  it("rejects an empty secret with MISSING_SECRET", async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "t=1,v1=abc",
        secret: "",
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "MISSING_SECRET",
    });
  });

  it("rejects a malformed signature header with INVALID_SIGNATURE_HEADER", async () => {
    await expect(
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "not-a-real-header",
        secret: SECRET,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "INVALID_SIGNATURE_HEADER",
    });
  });

  it("accepts a header carrying multiple v1 signatures when one matches (key rotation)", async () => {
    // During a secret rotation the dashboard signs the same payload
    // with two secrets and joins them as v1=<sig1>,v1=<sig2>. The
    // verifier should accept if either matches the configured secret.
    const rawBody = "rotation-test";
    const ts = nowSec();
    const goodSig = signWebhookPayload(rawBody, SECRET, ts).v1;
    const noiseSig = "0".repeat(64);
    const header = `t=${ts},v1=${noiseSig},v1=${goodSig}`;

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret: SECRET,
        nowSeconds: ts,
      }),
    ).resolves.toBe(true);
  });

  it("accepts an uppercase-hex candidate to stay byte-for-byte compatible with the Node verifier", async () => {
    // The Node verifier decodes via `Buffer.from(str, "hex")`, which
    // is case-insensitive. A third-party signer that uppercases the
    // digest should still verify against either implementation.
    // Greptile flagged this divergence on PR review: HEX_PATTERN
    // previously lacked the /i flag and the comparison ran on raw
    // charCodeAt, so uppercase candidates fell through to
    // SIGNATURE_MISMATCH on the Web Crypto path while the Node path
    // accepted them. Regression guard.
    const rawBody = "case-mix";
    const ts = nowSec();
    const signed = signWebhookPayload(rawBody, SECRET, ts);
    const uppercased = signed.v1.toUpperCase();
    const header = `t=${ts},v1=${uppercased}`;

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: header,
        secret: SECRET,
        nowSeconds: ts,
      }),
    ).resolves.toBe(true);
  });

  it("rejects when every candidate signature is invalid hex", async () => {
    const ts = nowSec();
    const header = `t=${ts},v1=not_hex_at_all,v1=also_not_hex`;
    await expect(
      verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: header,
        secret: SECRET,
        nowSeconds: ts,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "SIGNATURE_MISMATCH",
    });
  });

  it("honors a custom toleranceSeconds when set", async () => {
    const rawBody = "{}";
    const ts = nowSec() - 60; // 60 seconds back
    const signed = signWebhookPayload(rawBody, SECRET, ts);

    await expect(
      verifyWebhookSignature({
        rawBody,
        signatureHeader: signed.header,
        secret: SECRET,
        toleranceSeconds: 30,
      }),
    ).rejects.toMatchObject({
      name: "WebhookVerificationError",
      code: "TIMESTAMP_OUT_OF_RANGE",
    });
  });

  it("returns a WebhookVerificationError instance on every rejection path", async () => {
    // Guard against the Workers verifier accidentally returning a
    // plain Error or a different class than the Node counterpart;
    // consumers branch on `instanceof WebhookVerificationError` in
    // their handler, and the import has to resolve to the same class.
    try {
      await verifyWebhookSignature({
        rawBody: "{}",
        signatureHeader: "bogus",
        secret: SECRET,
      });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(WebhookVerificationError);
    }
  });
});
