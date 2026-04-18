/**
 * Signed download tokens.
 *
 * A download token is a self-describing bearer credential for fetching a
 * specific email's raw bytes or attachment bundle from a per-deployment
 * download endpoint. It binds:
 *
 * - `email_id` — the specific email the token authorizes.
 * - `aud` — a caller-chosen audience label (e.g. the resource kind being
 *   downloaded). Tokens minted for one audience will not verify under another.
 * - `exp` — an absolute expiration time (unix seconds).
 *
 * Format: `<base64url(payload)>.<base64url(signature)>` where `signature`
 * is HMAC-SHA256 over the base64url-encoded payload using the shared secret.
 *
 * The audience is an opaque caller-chosen string. Both the issuer and the
 * verifier must agree on the exact bytes; the SDK does not prescribe a
 * convention. New integrations are encouraged to namespace audiences
 * (e.g. `primitive:raw-download`).
 *
 * Tokens are stateless: verification needs only the shared secret. Keep
 * expirations as short as operationally tolerable.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

interface DownloadTokenPayload {
  email_id: string;
  exp: number;
  aud: string;
}

/**
 * Input for issuing a download token.
 */
export interface GenerateDownloadTokenOptions {
  /** The email ID the token authorizes. */
  emailId: string;
  /** Absolute expiration as unix seconds (not a TTL). */
  expiresAt: number;
  /** Caller-chosen audience label; the verifier must supply the same value. */
  audience: string;
  /** Shared HMAC secret. */
  secret: string;
}

/**
 * Issue a signed download token.
 *
 * The resulting token is `<base64url-payload>.<base64url-signature>`, where
 * the payload is `{"email_id":"...","exp":...,"aud":"..."}` (snake_case,
 * field order fixed) and the signature is HMAC-SHA256 of the base64url
 * payload string using `secret`.
 *
 * @param params - Token inputs.
 * @returns The signed token string.
 */
export function generateDownloadToken(
  params: GenerateDownloadTokenOptions,
): string {
  const { emailId, expiresAt, audience, secret } = params;

  const payload: DownloadTokenPayload = {
    email_id: emailId,
    exp: expiresAt,
    aud: audience,
  };

  const payloadJson = JSON.stringify(payload);
  const payloadStr = Buffer.from(payloadJson, "utf8").toString("base64url");

  const signature = createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  return `${payloadStr}.${signature}`;
}

/**
 * Input for verifying a download token.
 */
export interface VerifyDownloadTokenOptions {
  /** The token string to verify. */
  token: string;
  /** Expected email ID — must match the token payload exactly. */
  emailId: string;
  /** Expected audience — must match the token payload exactly. */
  audience: string;
  /** Shared HMAC secret. */
  secret: string;
  /** Override the current time (unix seconds) for deterministic tests. */
  nowSeconds?: number;
}

/**
 * Result of verifying a download token.
 *
 * On failure, `error` is a short human-readable reason suitable for logs.
 * Do not surface it to untrusted clients — it may reveal which check failed.
 */
export type VerifyDownloadTokenResult =
  | { valid: true }
  | { valid: false; error: string };

/**
 * Verify a signed download token.
 *
 * Returns a discriminated-union result. The function never throws for
 * verification failures — only malformed inputs at the crypto layer would
 * surface. Callers should check `result.valid` and log `result.error`.
 *
 * @param params - Verification inputs.
 * @returns Whether the token is valid, plus a reason on failure.
 */
export function verifyDownloadToken(
  params: VerifyDownloadTokenOptions,
): VerifyDownloadTokenResult {
  const { token, emailId, audience, secret, nowSeconds } = params;

  if (typeof token !== "string" || token.length === 0) {
    return { valid: false, error: "Token is empty" };
  }

  const firstDot = token.indexOf(".");
  const lastDot = token.lastIndexOf(".");
  if (firstDot === -1 || firstDot !== lastDot) {
    return { valid: false, error: "Token is malformed: expected one '.'" };
  }

  const payloadStr = token.slice(0, firstDot);
  const providedSignature = token.slice(firstDot + 1);

  if (payloadStr.length === 0 || providedSignature.length === 0) {
    return { valid: false, error: "Token is malformed: empty part" };
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadStr)
    .digest("base64url");

  const providedBytes = Buffer.from(providedSignature, "base64url");
  const expectedBytes = Buffer.from(expectedSignature, "base64url");

  if (
    providedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(providedBytes, expectedBytes)
  ) {
    return { valid: false, error: "Invalid signature" };
  }

  // Buffer.from(..., "base64url") is lenient — it silently drops non-alphabet
  // characters instead of throwing — so validate the charset explicitly.
  if (!BASE64URL_PATTERN.test(payloadStr)) {
    return { valid: false, error: "Token payload is not valid base64url" };
  }
  const decodedJson = Buffer.from(payloadStr, "base64url").toString("utf8");

  let payload: unknown;
  try {
    payload = JSON.parse(decodedJson);
  } catch {
    return { valid: false, error: "Token payload is not valid JSON" };
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    typeof (payload as { email_id?: unknown }).email_id !== "string" ||
    typeof (payload as { aud?: unknown }).aud !== "string" ||
    typeof (payload as { exp?: unknown }).exp !== "number"
  ) {
    return { valid: false, error: "Token payload has wrong shape" };
  }

  const { email_id, aud, exp } = payload as DownloadTokenPayload;

  if (aud !== audience) {
    return { valid: false, error: "Audience mismatch" };
  }

  if (email_id !== emailId) {
    return { valid: false, error: "Email ID mismatch" };
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (exp <= now) {
    return { valid: false, error: "Token is expired" };
  }

  return { valid: true };
}
