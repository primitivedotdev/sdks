// Package primitive provides webhook verification and validation helpers for
// Primitive.
//
// The package is centered around HandleWebhook, which verifies the
// Primitive-Signature header, decodes the raw request body, parses the JSON
// payload, and validates known event types such as email.received.
//
// For lower-level use cases, applications can call VerifyWebhookSignature,
// ParseWebhookEvent, or ValidateEmailReceivedEvent directly.
//
// Unknown future event types are preserved as UnknownEvent values so consumers
// can continue receiving webhook traffic before a package update ships.
package primitive
