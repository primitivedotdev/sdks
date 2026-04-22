// Package primitive provides webhook verification, validation, and a small
// convenience client for outbound API calls.
//
// The package is centered around HandleWebhookEvent and HandleWebhook, which
// verify the Primitive-Signature header, decode the raw request body, and parse
// the JSON payload.
//
// HandleWebhookEvent preserves unknown future event types as UnknownEvent values.
// HandleWebhook is the email.received-specific convenience wrapper.
//
// Import the module path github.com/primitivedotdev/sdks/sdk-go and use the
// package name primitive in code.
//
// For lower-level use cases, applications can call VerifyWebhookSignature,
// ParseWebhookEvent, or ValidateEmailReceivedEvent directly, or use the
// generated API client in the sibling api package.
//
// Unknown future event types are preserved as UnknownEvent values so consumers
// can continue receiving webhook traffic before a package update ships.
package primitive
