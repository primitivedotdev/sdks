/**
 * Webhook API Version
 *
 * Single source of truth for the webhook version.
 * Update this file when bumping the API version.
 */

/**
 * The current webhook API version this SDK is built for.
 * Webhooks may be sent with different versions - the SDK accepts any valid
 * YYYY-MM-DD formatted version string. Compare against this constant if you
 * need to handle version-specific behavior.
 */
export const WEBHOOK_VERSION = "2025-12-14";

/**
 * Valid webhook version format (YYYY-MM-DD date string).
 * The SDK accepts any valid date-formatted version, not just the current one,
 * for forward and backward compatibility.
 */
export type WebhookVersion = string;
