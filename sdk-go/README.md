# `github.com/primitivedotdev/sdks/sdk-go`

Official Primitive Go SDK.

The package is intentionally centered on a small inbound/outbound email
automation flow:

- `primitive.Receive(...)`
- `primitive.NewClient(...)`
- `client.Send(...)`
- `client.Reply(...)`
- `client.Forward(...)`

The generated HTTP API and lower-level webhook helpers remain available for
advanced use.

## Requirements

- Go `>=1.25`

## Installation

```bash
go get github.com/primitivedotdev/sdks/sdk-go@latest
```

## Basic usage

### Receive and reply

```go
package main

import (
	"context"
	"log"
	"time"

	primitive "github.com/primitivedotdev/sdks/sdk-go"
)

func handle(ctx context.Context, body []byte, headers map[string]string) {
	email, err := primitive.Receive(primitive.HandleWebhookOptions{
		Body:    body,
		Headers: headers,
		Secret:  "whsec_...",
	})
	if err != nil {
		log.Printf("invalid webhook: %v", err)
		return
	}

	client, err := primitive.NewClient("prim_test")
	if err != nil {
		log.Fatal(err)
	}

	_, err = client.Reply(ctx, email, primitive.ReplyParams{BodyText: "Thank you for your email."})
	if err != nil {
		log.Printf("reply failed: %v", err)
	}
}
```

### Send a new email

```go
ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
defer cancel()

result, err := client.Send(ctx, primitive.SendParams{
	From:    "support@example.com",
	To:      "alice@example.com",
	Subject: "Hello",
	BodyText: "Hi there",
})
```

`Send`, `Reply`, and `Forward` keep the HTTP request open until Primitive's
downstream SMTP transaction completes. Use a context deadline long enough for
SMTP delivery, typically 30-60 seconds.

### Forward an inbound email

```go
_, err = client.Forward(context.Background(), email, primitive.ForwardParams{
	To:       "ops@example.com",
	BodyText: "Can you take this one?",
})
```

## The normalized email object

`primitive.Receive(...)` returns a normalized inbound email object with fields
such as:

```go
email.Sender.Address
email.ReceivedBy
email.ReplyTarget.Address
email.ReplySubject
email.ForwardSubject
email.Subject
email.Text
email.Thread.MessageID
email.Thread.References
email.Raw
```

## Advanced usage

### Generated API package

Use the sibling `api` package when you want the full generated HTTP API surface.

```go
import primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"

client, err := primitiveapi.NewAPIClient("prim_test")
```

### Lower-level webhook helpers

Advanced users can still work directly with:

- `HandleWebhook(...)`
- `HandleWebhookEvent(...)`
- `ParseWebhookEvent(...)`
- `VerifyWebhookSignature(...)`

## Development

From `sdks/sdk-go`:

```bash
go test ./...
go test -run TestSharedCompatibilityFixtures ./...
gofmt -w .
```

Or from repo root `sdks/`:

```bash
make go-generate
make go-check
make go-build
```
