/**
 * Email Authentication Validation
 *
 * This module provides the `validateEmailAuth()` function for computing
 * an authentication verdict based on SPF, DKIM, and DMARC results.
 *
 * @example
 * ```typescript
 * import { handleWebhook, validateEmailAuth } from '@primitivedotdev/sdk-node';
 *
 * const event = handleWebhook({ body, headers, secret });
 * const result = validateEmailAuth(event.email.auth);
 *
 * if (result.verdict === 'legit') {
 *   // Email is authenticated
 * } else if (result.verdict === 'suspicious') {
 *   // Email may be spoofed
 *   console.warn('Suspicious email:', result.reasons);
 * }
 * ```
 *
 * @packageDocumentation
 */

import type {
  AuthConfidence,
  AuthVerdict,
  DkimSignature,
  EmailAuth,
  ValidateEmailAuthResult,
} from "../types.js";

/**
 * Minimum DKIM key size considered acceptable.
 *
 * 1024-bit RSA keys are cryptographically weak by modern standards (NIST
 * deprecated them in 2013), but they remain extremely common in email due to:
 * - DNS TXT record size limits (255 bytes per string)
 * - Legacy infrastructure constraints
 * - Major ESPs like Amazon SES and Resend still use 1024-bit keys
 *
 * We flag keys <1024 bits as weak (these are truly dangerous), while accepting
 * >=1024 bits to avoid false positives against legitimate senders. For maximum
 * security, domain owners should use 2048+ bit keys where possible.
 */
const MIN_SECURE_KEY_BITS = 1024;

/**
 * Validate email authentication and compute a verdict.
 *
 * This function analyzes SPF, DKIM, and DMARC results to determine
 * whether an email is likely authentic ("legit"), potentially spoofed
 * ("suspicious"), or indeterminate ("unknown").
 *
 * ## Verdict Logic
 *
 * **Legit (high confidence):**
 * - DMARC pass with DKIM alignment (cryptographic proof of authenticity)
 *
 * **Legit (medium confidence):**
 * - DMARC pass with SPF alignment only (no DKIM)
 *   - Note: SPF can break through forwarding, but DMARC pass is still meaningful
 *
 * **Suspicious (high confidence):**
 * - DMARC fail when domain has `reject` or `quarantine` policy
 *   - The domain owner explicitly says to distrust failing emails
 * - SPF explicitly fails (IP not authorized by sender)
 *
 * **Suspicious (low confidence):**
 * - DMARC fail when domain has `none` policy (monitoring mode)
 * - No DMARC record but SPF/DKIM fail
 *
 * **Unknown:**
 * - No DMARC record and no clear pass/fail
 * - Temporary errors during authentication
 * - No authentication data available
 *
 * @param auth - Email authentication results from the webhook
 * @returns Verdict, confidence level, and explanatory reasons
 *
 * @example
 * ```typescript
 * const result = validateEmailAuth({
 *   spf: 'pass',
 *   dmarc: 'pass',
 *   dmarcPolicy: 'reject',
 *   dmarcFromDomain: 'example.com',
 *   dmarcSpfAligned: true,
 *   dmarcDkimAligned: true,
 *   dmarcSpfStrict: false,
 *   dmarcDkimStrict: false,
 *   dkimSignatures: [{
 *     domain: 'example.com',
 *     selector: 'default',
 *     result: 'pass',
 *     aligned: true,
 *     keyBits: 2048,
 *     algo: 'rsa-sha256',
 *   }],
 * });
 *
 * // result.verdict === 'legit'
 * // result.confidence === 'high'
 * // result.reasons === ['DMARC passed with DKIM alignment']
 * ```
 */
export function validateEmailAuth(auth: EmailAuth): ValidateEmailAuthResult {
  const reasons: string[] = [];
  let verdict: AuthVerdict;
  let confidence: AuthConfidence;

  // Check for temporary/permanent errors first
  if (auth.dmarc === "temperror" || auth.dmarc === "permerror") {
    return {
      verdict: "unknown",
      confidence: "low",
      reasons: [
        `DMARC verification error (${auth.dmarc})`,
        "Cannot determine email authenticity due to DNS or policy errors",
      ],
    };
  }

  if (auth.spf === "temperror" || auth.spf === "permerror") {
    reasons.push(`SPF verification error (${auth.spf})`);
  }

  // Check for weak DKIM keys (< 1024 bits)
  const weakKeySignatures = auth.dkimSignatures.filter(
    (sig: DkimSignature) =>
      sig.keyBits != null && sig.keyBits < MIN_SECURE_KEY_BITS,
  );
  if (weakKeySignatures.length > 0) {
    for (const sig of weakKeySignatures) {
      reasons.push(
        `Weak DKIM key (${sig.keyBits} bits) for ${sig.domain} - minimum ${MIN_SECURE_KEY_BITS} bits recommended`,
      );
    }
  }

  // DMARC passed
  if (auth.dmarc === "pass") {
    // Find aligned DKIM signatures to include domain names in reasons.
    // If dmarcDkimAligned is true but no signatures match (e.g., signature
    // details weren't fully populated in the webhook), we fall through to
    // the fallback below - still "legit" since the server verified alignment.
    const alignedSigs = auth.dkimSignatures.filter(
      (sig: DkimSignature) => sig.result === "pass" && sig.aligned,
    );

    // DMARC pass with DKIM alignment = highest confidence
    if (auth.dmarcDkimAligned && alignedSigs.length > 0) {
      const domains = alignedSigs
        .map((sig: DkimSignature) => sig.domain)
        .join(", ");
      reasons.unshift(`DMARC passed with DKIM alignment (${domains})`);
      verdict = "legit";
      confidence = weakKeySignatures.length > 0 ? "medium" : "high";
      return { verdict, confidence, reasons };
    }

    // DMARC pass with SPF alignment only = medium confidence
    if (auth.dmarcSpfAligned && auth.spf === "pass") {
      reasons.unshift("DMARC passed with SPF alignment");
      reasons.push(
        "No aligned DKIM signature (SPF can break through forwarding)",
      );
      return {
        verdict: "legit",
        confidence: "medium",
        reasons,
      };
    }

    // DMARC passed but alignment details aren't available in the data.
    // Trust the server's DMARC verdict - verification happened server-side.
    reasons.unshift("DMARC passed");
    return {
      verdict: "legit",
      confidence: "medium",
      reasons,
    };
  }

  // DMARC failed
  if (auth.dmarc === "fail") {
    // Check domain policy
    if (auth.dmarcPolicy === "reject") {
      reasons.unshift("DMARC failed and domain has reject policy");
      reasons.push(
        "The sender's domain explicitly rejects emails that fail authentication",
      );
      return {
        verdict: "suspicious",
        confidence: "high",
        reasons,
      };
    }

    if (auth.dmarcPolicy === "quarantine") {
      reasons.unshift("DMARC failed and domain has quarantine policy");
      reasons.push("The sender's domain marks failing emails as suspicious");
      return {
        verdict: "suspicious",
        confidence: "high",
        reasons,
      };
    }

    // DMARC failed but policy is 'none' (monitoring mode)
    reasons.unshift("DMARC failed (domain is in monitoring mode)");

    // Check if SPF explicitly failed
    if (auth.spf === "fail") {
      reasons.push("SPF failed - sending IP not authorized");
      return {
        verdict: "suspicious",
        confidence: "medium",
        reasons,
      };
    }

    return {
      verdict: "suspicious",
      confidence: "low",
      reasons,
    };
  }

  // DMARC is 'none' (no record found)
  if (auth.dmarc === "none") {
    // No DMARC but check for other indicators
    if (auth.spf === "fail") {
      reasons.push("No DMARC record for sender domain");
      reasons.push("SPF failed - sending IP not authorized");
      return {
        verdict: "suspicious",
        confidence: "medium",
        reasons,
      };
    }

    // Check for any passing DKIM signatures (even if not aligned for DMARC)
    const passingDkim = auth.dkimSignatures.filter(
      (sig: DkimSignature) => sig.result === "pass",
    );
    if (passingDkim.length > 0) {
      const domains = passingDkim
        .map((sig: DkimSignature) => sig.domain)
        .join(", ");
      reasons.push("No DMARC record for sender domain");
      reasons.push(`DKIM verified for: ${domains}`);
      if (auth.spf === "pass") {
        reasons.push("SPF passed");
      }
      return {
        verdict: "unknown",
        confidence: "low",
        reasons,
      };
    }

    // No DMARC, no DKIM, but SPF passed
    if (auth.spf === "pass") {
      reasons.push("No DMARC record for sender domain");
      reasons.push("No DKIM signatures present");
      reasons.push("SPF passed (but SPF alone is weak authentication)");
      return {
        verdict: "unknown",
        confidence: "low",
        reasons,
      };
    }

    // No DMARC, no DKIM, no SPF pass
    reasons.push("No DMARC record for sender domain");
    reasons.push("No valid authentication found");
    return {
      verdict: "unknown",
      confidence: "low",
      reasons,
    };
  }

  // Fallback for any unhandled cases
  return {
    verdict: "unknown",
    confidence: "low",
    reasons: ["Unable to determine email authenticity"],
  };
}
