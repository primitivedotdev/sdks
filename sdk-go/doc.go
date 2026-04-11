// Package primitive provides webhook verification and validation helpers for
// Primitive.
//
// The package is centered around HandleWebhookEvent and HandleWebhook, which
// verify the Primitive-Signature header, decode the raw request body, and parse
// the JSON payload.
//
// HandleWebhookEvent preserves unknown future event types as UnknownEvent values.
// HandleWebhook is the email.received-specific convenience wrapper.
//
// For lower-level use cases, applications can call VerifyWebhookSignature,
// ParseWebhookEvent, or ValidateEmailReceivedEvent directly.
//
// Unknown future event types are preserved as UnknownEvent values so consumers
// can continue receiving webhook traffic before a package update ships.
package primitive
