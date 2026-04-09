import type { ErrorObject } from "ajv";

// -----------------------------------------------------------------------------
// Error Definitions (Single Source of Truth)
// -----------------------------------------------------------------------------

/**
 * Verification error definitions.
 * Use these for documentation, dashboards, and i18n.
 */
export const VERIFICATION_ERRORS = {
  INVALID_SIGNATURE_HEADER: {
    message: "Missing or malformed Primitive-Signature header",
    suggestion:
      "Check that you're reading the correct header (Primitive-Signature) and it's being passed correctly from your web framework.",
  },
  TIMESTAMP_OUT_OF_RANGE: {
    message: "Timestamp is too old (possible replay attack)",
    suggestion:
      "This could indicate a replay attack, network delay, or server clock drift. Check your server's time is synced.",
  },
  SIGNATURE_MISMATCH: {
    message: "Signature doesn't match expected value",
    suggestion:
      "Verify the webhook secret matches and you're using the raw request body (not re-serialized JSON).",
  },
  MISSING_SECRET: {
    message: "No webhook secret was provided",
    suggestion:
      "Pass your webhook secret from the Primitive dashboard. Check that the environment variable is set.",
  },
} as const;

/**
 * Payload parsing error definitions.
 * Use these for documentation, dashboards, and i18n.
 */
export const PAYLOAD_ERRORS = {
  PAYLOAD_NULL: {
    message: "Webhook payload is null",
    suggestion:
      "Ensure you're passing the parsed JSON body, not null. Check your framework's body parsing middleware.",
  },
  PAYLOAD_UNDEFINED: {
    message: "Webhook payload is undefined",
    suggestion:
      "The payload was not provided. Make sure you're passing the request body to the handler.",
  },
  PAYLOAD_WRONG_TYPE: {
    message: "Webhook payload must be an object",
    suggestion:
      "The payload should be a parsed JSON object. Check that you're not passing a string or other primitive.",
  },
  PAYLOAD_IS_ARRAY: {
    message: "Webhook payload is an array, expected object",
    suggestion:
      "Primitive webhooks are single event objects, not arrays. Check the payload structure.",
  },
  PAYLOAD_MISSING_EVENT: {
    message: "Webhook payload missing 'event' field",
    suggestion:
      "All webhook payloads must have an 'event' field. This may not be a valid Primitive webhook.",
  },
  PAYLOAD_UNKNOWN_EVENT: {
    message: "Unknown webhook event type",
    suggestion:
      "This event type is not recognized. You may need to update your SDK or handle unknown events gracefully.",
  },
  PAYLOAD_EMPTY_BODY: {
    message: "Request body is empty",
    suggestion:
      "The request body was empty. Ensure the webhook is sending data and your framework is parsing it correctly.",
  },
  JSON_PARSE_FAILED: {
    message: "Failed to parse JSON body",
    suggestion:
      "The request body is not valid JSON. Check the raw body content and Content-Type header.",
  },
  INVALID_ENCODING: {
    message: "Invalid body encoding",
    suggestion:
      "The request body encoding is not supported. Primitive webhooks use UTF-8 encoded JSON.",
  },
} as const;

/**
 * Raw email decode error definitions.
 * Use these for documentation, dashboards, and i18n.
 */
export const RAW_EMAIL_ERRORS = {
  NOT_INCLUDED: {
    message: "Raw email content not included inline",
    suggestion:
      "Use the download URL at event.email.content.download.url to fetch the raw email.",
  },
  HASH_MISMATCH: {
    message: "SHA-256 hash verification failed",
    suggestion:
      "The raw email data may be corrupted. Try downloading from the URL instead.",
  },
} as const;

// -----------------------------------------------------------------------------
// Base Error Class
// -----------------------------------------------------------------------------

/**
 * All error codes that can be thrown by the SDK.
 */
export type WebhookErrorCode =
  | WebhookVerificationErrorCode
  | WebhookPayloadErrorCode
  | WebhookValidationErrorCode
  | RawEmailDecodeErrorCode;

export type RawEmailDecodeErrorCode = keyof typeof RAW_EMAIL_ERRORS;

/**
 * Base class for all Primitive webhook errors.
 *
 * Catch this to handle any error from the SDK in a single catch block.
 *
 * @example
 * ```typescript
 * import { handleWebhook, PrimitiveWebhookError } from '@primitivedotdev/sdk-node';
 *
 * try {
 *   const event = handleWebhook({ body, signature, secret });
 * } catch (err) {
 *   if (err instanceof PrimitiveWebhookError) {
 *     console.error(`[${err.code}] ${err.message}`);
 *     return res.status(400).json({ error: err.code });
 *   }
 *   throw err;
 * }
 * ```
 */
export abstract class PrimitiveWebhookError extends Error {
  /** Programmatic error code for monitoring and handling */
  abstract readonly code: WebhookErrorCode;
  /** Actionable guidance for fixing the issue */
  abstract readonly suggestion: string;

  /**
   * Formats the error for logging/display.
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}\n\nSuggestion: ${this.suggestion}`;
  }

  /**
   * Serializes cleanly for structured logging (Datadog, CloudWatch, etc.)
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      suggestion: this.suggestion,
    };
  }
}

// -----------------------------------------------------------------------------
// Verification Errors
// -----------------------------------------------------------------------------

/**
 * Error codes for webhook verification failures.
 * Derived from VERIFICATION_ERRORS keys.
 */
export type WebhookVerificationErrorCode = keyof typeof VERIFICATION_ERRORS;

/**
 * Error thrown when webhook signature verification fails.
 *
 * Use the `code` property to programmatically handle specific error cases.
 */
export class WebhookVerificationError extends PrimitiveWebhookError {
  readonly code: WebhookVerificationErrorCode;
  readonly suggestion: string;

  constructor(
    code: WebhookVerificationErrorCode,
    message?: string,
    suggestion?: string,
  ) {
    super(message ?? VERIFICATION_ERRORS[code].message);
    this.name = "WebhookVerificationError";
    this.code = code;
    this.suggestion = suggestion ?? VERIFICATION_ERRORS[code].suggestion;
  }
}

// -----------------------------------------------------------------------------
// Payload Parsing Errors
// -----------------------------------------------------------------------------

/**
 * Error codes for webhook payload parsing failures.
 * Derived from PAYLOAD_ERRORS keys.
 */
export type WebhookPayloadErrorCode = keyof typeof PAYLOAD_ERRORS;

/**
 * Error thrown when webhook payload parsing fails (lightweight parser).
 *
 * Use the `code` property for programmatic handling and monitoring.
 * The `suggestion` property contains actionable guidance for fixing the issue.
 */
export class WebhookPayloadError extends PrimitiveWebhookError {
  readonly code: WebhookPayloadErrorCode;
  readonly suggestion: string;
  /** Original error if this wraps another error (e.g., JSON.parse failure) */
  readonly cause?: Error;

  constructor(
    code: WebhookPayloadErrorCode,
    message?: string,
    suggestion?: string,
    cause?: Error,
  ) {
    super(message ?? PAYLOAD_ERRORS[code].message);
    this.name = "WebhookPayloadError";
    this.code = code;
    this.suggestion = suggestion ?? PAYLOAD_ERRORS[code].suggestion;
    this.cause = cause;
  }
}

// -----------------------------------------------------------------------------
// Schema Validation Errors
// -----------------------------------------------------------------------------

/**
 * Error code for schema validation failures.
 */
export type WebhookValidationErrorCode = "SCHEMA_VALIDATION_FAILED";

/**
 * Error thrown when schema validation fails.
 */
export class WebhookValidationError extends PrimitiveWebhookError {
  readonly code: WebhookValidationErrorCode = "SCHEMA_VALIDATION_FAILED";
  readonly suggestion: string;
  /** The specific field path that failed (e.g., "email.headers.from") */
  readonly field: string;
  /** Original schema validation errors for advanced debugging */
  readonly validationErrors: readonly ErrorObject[];
  /** Number of additional validation errors beyond the first */
  readonly additionalErrorCount: number;

  constructor(
    field: string,
    message: string,
    suggestion: string,
    validationErrors: readonly ErrorObject[],
  ) {
    super(message);
    this.name = "WebhookValidationError";
    this.field = field;
    this.suggestion = suggestion;
    this.validationErrors = validationErrors;
    this.additionalErrorCount = Math.max(0, validationErrors.length - 1);
  }

  /**
   * Formats the error for logging/display.
   * Includes error count and suggestion.
   */
  toString(): string {
    let output = `${this.name} [${this.code}]: ${this.message}`;
    if (this.additionalErrorCount > 0) {
      output += ` (and ${this.additionalErrorCount} more validation error${this.additionalErrorCount > 1 ? "s" : ""})`;
    }
    output += `\n\nSuggestion: ${this.suggestion}`;
    return output;
  }

  /**
   * Serializes cleanly for structured logging (Datadog, CloudWatch, etc.)
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      field: this.field,
      message: this.message,
      suggestion: this.suggestion,
      additionalErrorCount: this.additionalErrorCount,
    };
  }
}

// -----------------------------------------------------------------------------
// Raw Email Decode Errors
// -----------------------------------------------------------------------------

/**
 * Error thrown when raw email decoding or verification fails.
 *
 * Use the `code` property to determine the failure reason:
 * - `NOT_INCLUDED`: Raw email not inline, must download from URL
 * - `HASH_MISMATCH`: SHA-256 verification failed, content may be corrupted
 */
export class RawEmailDecodeError extends PrimitiveWebhookError {
  readonly code: RawEmailDecodeErrorCode;
  readonly suggestion: string;

  constructor(code: RawEmailDecodeErrorCode, message?: string) {
    super(message ?? RAW_EMAIL_ERRORS[code].message);
    this.name = "RawEmailDecodeError";
    this.code = code;
    this.suggestion = RAW_EMAIL_ERRORS[code].suggestion;
  }
}
