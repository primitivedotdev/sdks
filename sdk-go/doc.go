// Package primitive provides a small, high-level inbound/outbound email SDK for
// Primitive.
//
// The main surface is centered around Receive for inbound webhooks and Client
// for outbound send/reply/forward operations.
//
// Lower-level webhook and generated API helpers still remain available for
// advanced use cases.
//
// Import the module path github.com/primitivedotdev/sdks/sdk-go and use the
// package name primitive in code.
//
// For lower-level use cases, applications can call HandleWebhook,
// VerifyWebhookSignature, ParseWebhookEvent, or ValidateEmailReceivedEvent
// directly, or use the generated API client in the sibling api package.
//
// Unknown future event types are preserved as UnknownEvent values so consumers
// can continue receiving webhook traffic before a package update ships.
package primitive
