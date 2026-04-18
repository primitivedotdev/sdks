import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  generateDownloadToken,
  verifyDownloadToken,
} from "../../src/webhook/download-tokens.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(
  __dirname,
  "../../../test-fixtures/download-tokens/vectors.json",
);

interface TokenVector {
  name: string;
  email_id: string;
  expires_at: number;
  audience: string;
  secret: string;
  expected_token: string;
}

const vectors: { cases: TokenVector[] } = JSON.parse(
  readFileSync(FIXTURE_PATH, "utf8"),
);

describe("generateDownloadToken", () => {
  it("produces the expected bytes for a known fixture", () => {
    for (const vector of vectors.cases) {
      const token = generateDownloadToken({
        emailId: vector.email_id,
        expiresAt: vector.expires_at,
        audience: vector.audience,
        secret: vector.secret,
      });
      expect(token).toBe(vector.expected_token);
    }
  });

  it("is deterministic across calls with the same inputs", () => {
    const params = {
      emailId: "email_abc",
      expiresAt: 1700000000,
      audience: "primitive:raw-download",
      secret: "secret-value",
    };
    expect(generateDownloadToken(params)).toBe(generateDownloadToken(params));
  });

  it("produces different tokens for different audiences", () => {
    const base = {
      emailId: "email_abc",
      expiresAt: 1700000000,
      secret: "secret-value",
    };
    const a = generateDownloadToken({
      ...base,
      audience: "primitive:raw-download",
    });
    const b = generateDownloadToken({
      ...base,
      audience: "primitive:attachments-download",
    });
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different secrets", () => {
    const base = {
      emailId: "email_abc",
      expiresAt: 1700000000,
      audience: "primitive:raw-download",
    };
    const a = generateDownloadToken({ ...base, secret: "secret-one" });
    const b = generateDownloadToken({ ...base, secret: "secret-two" });

    const aPayload = a.split(".")[0];
    const bPayload = b.split(".")[0];
    expect(aPayload).toBe(bPayload);
    expect(a).not.toBe(b);
  });

  it("produces a token with exactly one '.'", () => {
    const token = generateDownloadToken({
      emailId: "email_abc",
      expiresAt: 1700000000,
      audience: "primitive:raw-download",
      secret: "secret-value",
    });
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });
});

describe("verifyDownloadToken", () => {
  const params = {
    emailId: "email_abc",
    expiresAt: 1_900_000_000,
    audience: "primitive:raw-download",
    secret: "secret-value",
  };

  it("verifies a token produced with matching inputs", () => {
    const token = generateDownloadToken(params);
    const result = verifyDownloadToken({
      token,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
      nowSeconds: params.expiresAt - 60,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a token whose payload has been mutated", () => {
    const token = generateDownloadToken(params);
    const [payload, sig] = token.split(".");
    const mutatedPayload = `${payload.slice(0, -1)}${payload.endsWith("A") ? "B" : "A"}`;
    const mutated = `${mutatedPayload}.${sig}`;
    const result = verifyDownloadToken({
      token: mutated,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
      nowSeconds: params.expiresAt - 60,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/signature/i);
  });

  it("rejects a token whose signature has been mutated", () => {
    const token = generateDownloadToken(params);
    const [payload, sig] = token.split(".");
    const flipped = sig.endsWith("A")
      ? `${sig.slice(0, -1)}B`
      : `${sig.slice(0, -1)}A`;
    const result = verifyDownloadToken({
      token: `${payload}.${flipped}`,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
      nowSeconds: params.expiresAt - 60,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/signature/i);
  });

  it("rejects a token with the wrong audience", () => {
    const token = generateDownloadToken(params);
    const result = verifyDownloadToken({
      token,
      emailId: params.emailId,
      audience: "primitive:attachments-download",
      secret: params.secret,
      nowSeconds: params.expiresAt - 60,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/audience/i);
  });

  it("rejects a token with the wrong email ID", () => {
    const token = generateDownloadToken(params);
    const result = verifyDownloadToken({
      token,
      emailId: "different_email",
      audience: params.audience,
      secret: params.secret,
      nowSeconds: params.expiresAt - 60,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/email/i);
  });

  it("rejects an expired token", () => {
    const token = generateDownloadToken({ ...params, expiresAt: 100 });
    const result = verifyDownloadToken({
      token,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
      nowSeconds: 200,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/expired/i);
  });

  it("rejects a token exactly at its expiry", () => {
    const exp = 1_500_000_000;
    const token = generateDownloadToken({ ...params, expiresAt: exp });
    const result = verifyDownloadToken({
      token,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
      nowSeconds: exp,
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed token with no '.'", () => {
    const result = verifyDownloadToken({
      token: "not-a-real-token",
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/malformed/i);
  });

  it("rejects a malformed token with multiple dots", () => {
    const result = verifyDownloadToken({
      token: "aaa.bbb.ccc",
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/malformed/i);
  });

  it("rejects an empty token", () => {
    const result = verifyDownloadToken({
      token: "",
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/empty/i);
  });

  it("rejects a token with an empty payload or signature part", () => {
    const result = verifyDownloadToken({
      token: ".signaturepart",
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/empty part/i);
  });

  it("rejects a token whose payload contains non-base64url characters", () => {
    const garbage = "not!valid@chars";
    const sig = createHmac("sha256", params.secret)
      .update(garbage)
      .digest("base64url");
    const result = verifyDownloadToken({
      token: `${garbage}.${sig}`,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/base64url/i);
  });

  it("rejects a token whose payload is valid base64url but not JSON", () => {
    const garbage = Buffer.from("not json at all", "utf8").toString(
      "base64url",
    );
    const sig = createHmac("sha256", params.secret)
      .update(garbage)
      .digest("base64url");
    const result = verifyDownloadToken({
      token: `${garbage}.${sig}`,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/JSON/);
  });

  it("rejects a token whose payload JSON has the wrong shape", () => {
    const payloadJson = JSON.stringify({ email_id: 42, aud: "x", exp: 1 });
    const payloadStr = Buffer.from(payloadJson, "utf8").toString("base64url");
    const sig = createHmac("sha256", params.secret)
      .update(payloadStr)
      .digest("base64url");
    const result = verifyDownloadToken({
      token: `${payloadStr}.${sig}`,
      emailId: params.emailId,
      audience: params.audience,
      secret: params.secret,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/shape/i);
  });
});

describe("download token round-trip", () => {
  const base = {
    emailId: "email_xyz",
    audience: "primitive:raw-download",
    secret: "round-trip-secret",
  };

  it("generates and verifies with identical inputs", () => {
    const token = generateDownloadToken({ ...base, expiresAt: 2_000_000_000 });
    const result = verifyDownloadToken({
      token,
      ...base,
      nowSeconds: 1_999_999_000,
    });
    expect(result.valid).toBe(true);
  });

  it("fails verification when email ID changes on verify", () => {
    const token = generateDownloadToken({ ...base, expiresAt: 2_000_000_000 });
    const result = verifyDownloadToken({
      token,
      ...base,
      emailId: "email_other",
      nowSeconds: 1_999_999_000,
    });
    expect(result.valid).toBe(false);
  });

  it("fails verification after expiry when using nowSeconds", () => {
    const expiresAt = 1_000_000_500;
    const token = generateDownloadToken({ ...base, expiresAt });
    const result = verifyDownloadToken({
      token,
      ...base,
      nowSeconds: expiresAt + 1,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toMatch(/expired/i);
  });
});
