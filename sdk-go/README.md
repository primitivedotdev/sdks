# `github.com/primitivedotdev/sdks/sdk-go`

Official Primitive Go SDK for webhook verification and validation.

This package helps you:

- verify Primitive webhook signatures
- parse webhook request bodies
- validate webhook payloads against the canonical JSON schema
- work with typed `email.received` events in Go

## Requirements

- Go `>=1.21`

## Installation

```bash
go get github.com/primitivedotdev/sdks/sdk-go@latest
```

In Go code, import the module path and use the package as `primitive`.

## Basic Usage

```go
package main

import (
	"log"

	primitive "github.com/primitivedotdev/sdks/sdk-go"
)

func handle(body []byte, headers map[string]string) {
	event, err := primitive.HandleWebhook(primitive.HandleWebhookOptions{
		Body:    body,
		Headers: headers,
		Secret:  "whsec_...",
	})
	if err != nil {
		log.Printf("invalid webhook: %v", err)
		return
	}

	log.Println("Email from:", event.Email.Headers.From)
	log.Println("Subject:", deref(event.Email.Headers.Subject))
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
```

## Core API

### Main functions

- `HandleWebhookEvent(options)`
  - verifies the webhook signature
  - decodes and parses the request body
  - returns a known webhook event or `UnknownEvent`
- `HandleWebhook(options)`
  - verifies the webhook signature
  - decodes and parses the request body
  - validates an `email.received` payload
  - returns a typed `EmailReceivedEvent`
- `ParseWebhookEvent(input)`
  - parses a JSON payload into a known webhook event or `UnknownEvent`
  - validates known event types against the canonical schema
  - returns `*WebhookValidationError` for malformed known events
- `ValidateEmailReceivedEvent(input)`
  - validates an `email.received` payload and returns the typed event
- `SafeValidateEmailReceivedEvent(input)`
  - returns a success flag plus data or error
- `VerifyWebhookSignature(options)`
  - verifies `Primitive-Signature`
- `ValidateEmailAuth(auth)`
  - computes a verdict from SPF, DKIM, and DMARC results

### Helpful exports

- `WebhookVersion`
- `PrimitiveSignatureHeader`
- `PrimitiveConfirmedHeader`
- `PrimitiveWebhookError`
- `WebhookVerificationError`
- `WebhookPayloadError`
- `WebhookValidationError`
- `RawEmailDecodeError`

### Types

The package exports the main webhook types, including:

- `EmailReceivedEvent`
- `WebhookEvent`
- `UnknownEvent`
- `EmailAuth`
- `EmailAnalysis`
- `ParsedData`
- `RawContent`
- `WebhookAttachment`

## Parsing Events

- `ParseWebhookEvent(input)` strictly validates known event types such as `email.received`
- malformed known events return `*WebhookValidationError`
- unknown future event types are returned as `UnknownEvent`

## JSON Schema

The webhook payload contract is defined by the canonical JSON schema in the repository and is embedded in the Go package as generated source.

The SDK uses that schema to drive:

- the embedded schema artifact
- runtime validation
- shared cross-SDK compatibility checks

## Error Handling

All SDK-specific runtime errors include a stable error code.

```go
import (
	"errors"
	"log"

	primitive "github.com/primitivedotdev/sdks/sdk-go"
)

if err != nil {
	var webhookErr *primitive.PrimitiveWebhookError
	if errors.As(err, &webhookErr) {
		log.Println(webhookErr.Code(), webhookErr.Message())
	}
}
```

## Development

From `sdks/sdk-go`:

```bash
make -C .. go-generate
go test ./...
go test -run TestSharedCompatibilityFixtures ./...
gofmt -w .
```

Or from repo root `sdks/`:

```bash
make go-generate
make go-check
```

## Repository Layout

```text
sdks/
  json-schema/
    email-received-event.schema.json
  sdk-go/
    webhook.go
    validation.go
    schema.go
    schema_generated.go
    types.go
    scripts/
      generate_schema_module.py
```
