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
wait := true

result, err := client.Send(ctx, primitive.SendParams{
	From:    "Support <support@example.com>",
	To:      "alice@example.com",
	Subject: "Hello",
	BodyText: "Hi there",
	// Use a unique key per logical send. Reusing a key returns the original
	// response from the first send, which is how retries are deduplicated.
	IdempotencyKey: "customer-key-abc123",
	Wait:           &wait,
	WaitTimeoutMs:  5000,
})
```

`Send`, `Reply`, and `Forward` keep the HTTP request open until Primitive's
downstream SMTP transaction completes. Use a context deadline long enough for
SMTP delivery, typically 30-60 seconds.

### Per-call timeout and cancellation

Every client method takes `ctx context.Context` as its first argument, so
per-call deadlines, cancellation, and request-scoped values use the standard
library directly. There is no separate `RequestOptions` struct.

```go
// Per-call timeout: cancel after 15 seconds.
ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
defer cancel()
_, err := client.Send(ctx, primitive.SendParams{
    From:    "Support <support@example.com>",
    To:      "alice@example.com",
    Subject: "Hello",
    BodyText: "Hi there",
})

// Per-call cancellation: bail out from another goroutine.
ctx, cancel := context.WithCancel(context.Background())
go func() { <-userBailoutSignal; cancel() }()
_, err := client.Send(ctx, primitive.SendParams{ /* params */ })
```

A canceled `ctx` surfaces as `context.Canceled`; a deadline exceeded surfaces
as `context.DeadlineExceeded`. Both are distinct from API errors returned as
`*primitive.APIError`, so callers can tell a client-side abort apart from a
server response.

For idempotent retries, set `IdempotencyKey` on `SendParams` or
`ForwardParams` (see the `Send` example above). The same key replays the
original response.

### About `Wait` mode

When `Wait` is true, the call returns the first downstream SMTP outcome (or
`WaitTimeoutMs`, default 30000). Possible terminal `DeliveryStatus` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure, the receiving MTA may retry
- `wait_timeout` no outcome was observed in time. Treat as "outcome unknown."
  The send may still complete after the response returns.

### Reply from a different address

`Reply` defaults the From address to the inbound recipient (the address that
received the email). When your verified outbound domain differs from your
inbound domain, pass `From` explicitly:

```go
_, err = client.Reply(ctx, email, primitive.ReplyParams{
	BodyText: "Thanks for your email.",
	From:     "notifications@outbound.example.com",
})
```

### HTML replies and waiting on the delivery outcome

`Reply` accepts `BodyHTML` as a sibling of `BodyText`, plus the same `Wait`
flag the top-level `Send` takes:

```go
wait := true
_, err = client.Reply(ctx, email, primitive.ReplyParams{
	BodyText: "Thanks for your email.",
	BodyHTML: "<p>Thanks for your email.</p>",
	Attachments: []primitive.SendAttachment{
		{
			Filename:      "report.txt",
			ContentBase64: "aGVsbG8=",
		},
	},
	Wait:     &wait,
})
```

A subject override is intentionally not exposed on `ReplyParams`. Gmail's
Conversation View needs both a References match and a normalized-subject match
to thread, so a custom subject silently breaks the thread for half the
recipient population. Use `client.Send(...)` if you need full subject control.

If the inbound row is not in a state we can reply to (no `Message-Id` recorded,
or content was discarded), the API returns `inbound_not_repliable` (HTTP 422)
and the SDK returns an error.

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

## x402 payments

The x402 client lets one agent request a USDC payment and another pay it. It is
non-custodial: the payer signs an EIP-3009 `transferWithAuthorization` locally
with their own key, and the key never leaves the caller. The platform resolves
the real payee address, verifies every signed field against its own records,
enforces the org's spend policy, and settles on chain.

The model in four steps:

1. The payee registers a payout address once (proving control of it with a local
   signature).
2. The payee creates a challenge with `Charge`, which the platform fills in with
   the registered payout address.
3. The payer signs the challenge locally and submits it with `Pay`.
4. The platform verifies and settles.

Amounts can be given as a human USDC string (`AmountUsdc: "0.01"`) or as token
base units (`Amount: "10000"`, since USDC has 6 decimals). Networks are `base`
(mainnet) and `base-sepolia` (testnet). A `PrivateKeySigner` built from a hex
private key holds the wallet key in process and signs both the EIP-712 payment
authorization (for `Pay`) and the ownership message (for `RegisterPayoutAddress`);
the key is never sent to Primitive.

Build the client with `NewX402Client`. With zero options it reads
`PRIMITIVE_API_KEY` from the environment and targets the production host.

```go
client := primitive.NewX402Client(primitive.X402ClientOptions{
	APIKey: os.Getenv("PRIMITIVE_API_KEY"),
})
```

### Register a payout address (payee, one time)

The signer proves control of its own address with an ownership message; the
recovered address becomes your default payout destination for that network.
`Charge` resolves its `PayTo` from this directory, so register before requesting
payments. The org is resolved automatically from your API key, so you do not set
it (set `Org` only to override the default).

```go
payee, err := primitive.NewPrivateKeySigner(os.Getenv("PAYEE_KEY"))
if err != nil {
	log.Fatal(err)
}

label := "treasury"
_, err = client.RegisterPayoutAddress(ctx, primitive.X402PayoutRegistrationInput{
	Network: "base-sepolia",
	Label:   &label,
}, payee)
```

### Create a challenge (payee)

```go
challenge, err := client.Charge(ctx, primitive.X402ChargeInput{
	AmountUsdc:  "0.01", // human USDC amount
	Network:     "base-sepolia",
	PayerOrg:    os.Getenv("PAYER_ORG_ID"), // org allowed to pay
	Description: "API call",
})
```

Set exactly one of `AmountUsdc` (a human USDC string like `"0.01"`) or `Amount`
(token base units, e.g. `"10000"`). `AmountUsdc` is the easy path; `Amount`
remains available when you already have a base-unit value.

Hand the returned `*X402Challenge` to the payer over any out-of-band channel.
`client.GetChallenge(ctx, id)` re-hydrates a challenge by id, for example to
retry `Pay` after a restart.

### Pay a challenge (payer)

The payer signs the interaction-bound authorization locally and submits it. The
key never leaves the caller.

```go
payer, err := primitive.NewPrivateKeySigner(os.Getenv("PAYER_KEY"))
if err != nil {
	log.Fatal(err)
}

receipt, err := client.Pay(ctx, challenge, payer)
if err != nil {
	log.Fatal(err)
}
log.Println(receipt.Status, receipt.SettleTx) // settled, on-chain tx hash
```

### Email-native payments

The challenge can also ride a real email thread instead of a synthetic id. The
payee issues it as an email; the payer signs it into an `interaction.json`
payment step and sends it back attached to the reply.

The payee issues the challenge with `CreateEmailChallenge`. The `pay_to` payout
wallet and the token asset are resolved server-side; you only supply the
addresses, amount, and network:

```go
issued, err := client.CreateEmailChallenge(ctx, primitive.X402EmailChargeInput{
	From:       "payee@your-domain.example", // your sending address (funds receiver)
	To:         "payer@their-domain.example", // the payer's address
	AmountUsdc: "0.01",
	Network:    "base-sepolia",
})
if err != nil {
	log.Fatal(err)
}
// issued.InteractionID is the email thread the payment is bound to;
// issued.Challenge carries the payment_requirements + nonce_binding to sign.
```

The payer receives the challenge as an `interaction.json` MIME part on an
inbound email. Rather than hand-parsing it, pass the part bytes to
`ExtractEmailChallenge`, which validates the envelope and returns the typed
`*X402EmailChallenge`:

```go
// interactionPart is the body of the inbound email's `interaction.json`
// attachment.
issued, err := primitive.ExtractEmailChallenge(interactionPart)
if err != nil {
	log.Fatal(err)
}
```

The payer then signs the challenge locally with `PayEmailChallenge` and replies
with the resulting envelope attached. `PayEmailChallenge` does not send
anything; it returns the signed payment-step envelope and its canonical JSON
bytes. The validity window is computed and clamped into the accepted band for
you, so you never hand-set `ValidBefore`:

```go
payer, err := primitive.NewPrivateKeySigner(os.Getenv("PAYER_KEY"))
if err != nil {
	log.Fatal(err)
}

built, err := client.PayEmailChallenge(issued, payer)
if err != nil {
	log.Fatal(err)
}

// built.JSON is the interaction.json body. The payer received the challenge as
// an inbound email; reply to it with the envelope attached as `interaction.json`
// using the email client's Reply method (see above). The platform reads the
// envelope, re-derives the interaction-bound nonce, and settles on chain.
_, err = client.Reply(ctx, challengeEmail, primitive.ReplyParams{
	BodyText: "Payment attached.",
	Attachments: []primitive.SendAttachment{
		{
			Filename:      "interaction.json",
			ContentBase64: base64.StdEncoding.EncodeToString([]byte(built.JSON)),
		},
	},
})
if err != nil {
	log.Fatal(err)
}
```

### Signing primitives (lower level)

`Pay` builds and signs the payment for you. When you need to drive the signing
yourself, for example to sign a challenge carried in an email reply and submit
the payment separately, the same building blocks are exported directly:

- `DeriveEIP3009Nonce(binding)` derives the interaction-bound EIP-3009 nonce,
  locked to a normative vector the platform recomputes.
- `ExtractEmailChallenge(part)` validates an inbound `interaction.json` challenge
  part (its raw bytes) and returns the typed `*X402EmailChallenge` ready for
  `PayEmailChallenge`, so you never hand-parse the envelope.
- `ComputePaymentValidityWindow(input)` returns the `(validAfter, validBefore)`
  window, landed inside the band the platform accepts by default: `validBefore`
  keeps at least a minimum settlement headroom (60s) so a near-expired challenge
  is not signed into a guaranteed rejection, and the total window is clamped to
  the 24h cap so a far-future expiry never produces an "authorization window too
  wide" rejection. Pin `ValidBeforeSec`/`ValidAfterSec` to set a bound; with
  `Clamp` pointing to false an out-of-band pinned value returns a specific error
  naming which bound was violated instead of silently signing a doomed
  authorization.
- `SignInteractionPayment(input)` derives the bound nonce, assembles the
  authorization, and signs it with your `Sign` callback. The key never leaves the
  caller.
- `BuildExactEvmPaymentPayload(network, authorization, signature)` assembles the
  exact-EVM x402 wire payload.

```go
payer, err := primitive.NewPrivateKeySigner(os.Getenv("PAYER_KEY"))
if err != nil {
	log.Fatal(err)
}
pr := challenge.PaymentRequirements
expiresAt, _ := time.Parse(time.RFC3339Nano, challenge.ExpiresAt)

validAfter, validBefore, err := primitive.ComputePaymentValidityWindow(primitive.ValidityWindowInput{
	ChallengeExpiresAtSec: expiresAt.Unix(),
	NowSec:                time.Now().Unix(),
})
if err != nil {
	log.Fatal(err)
}

amount, _ := new(big.Int).SetString(pr.MaxAmountRequired, 10)
auth, signature, err := primitive.SignInteractionPayment(primitive.SignInteractionPaymentInput{
	Sign:  payer.SignTypedData,
	Payer: payer.Address(),
	Domain: primitive.TokenDomain{
		Name:              pr.Extra.Name,
		Version:           pr.Extra.Version,
		ChainID:           84532, // base-sepolia
		VerifyingContract: pr.Asset,
	},
	PayTo:  pr.PayTo,
	Amount: amount,
	NonceBinding: primitive.NonceBinding{
		InteractionID:   challenge.NonceBinding.InteractionID,
		ChallengeStepID: challenge.NonceBinding.ChallengeStepID,
		ChallengeNonce:  challenge.NonceBinding.ChallengeNonce,
	},
	ValidAfter:  validAfter,
	ValidBefore: validBefore,
})
if err != nil {
	log.Fatal(err)
}

payment, err := primitive.BuildExactEvmPaymentPayload(challenge.Network, auth, signature)
if err != nil {
	log.Fatal(err)
}
// submit `payment` to /v1/x402/challenges/{id}/pay
```

### Read and set the spend policy

The spend policy guards outbound payments: a `Paused` kill-switch, per-payment
and daily caps (token base units, or nil for no cap), and a payee allowlist (nil
means any on-net payee, an empty slice denies all). `SetSpendPolicy` merges: only
the fields you set on the update change, and omitted fields keep their current
value. Use the builder methods on `X402SpendPolicyUpdate`, and
`ClearMaxPerPayment` / `ClearMaxPerDay` to remove a cap.

```go
var update primitive.X402SpendPolicyUpdate
update.SetPaused(false).SetMaxPerPayment("5000000")

policy, err := client.SetSpendPolicy(ctx, update)
if err != nil {
	log.Fatal(err)
}
_ = policy

addresses, err := client.ListPayoutAddresses(ctx)
```

### Errors

Every method returns a `*primitive.X402Error` on a client-side, transport, or
non-2xx server error. Use `errors.As` to inspect it. It carries `Status` (the
HTTP status, or `0` for a request that never reached the server), `Body` (the
parsed error envelope when present), and `RetryAfter` (the `Retry-After` header,
when the server sent one). On `Pay`, a `Status == 0` error means the request may
not have been sent, so the payment outcome is indeterminate.

## Advanced usage

### Generated API package

Use the sibling `api` package when you want the full generated HTTP API surface.

```go
import primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"

client, err := primitiveapi.NewAPIClient("prim_test")
```

### Payment and interaction webhook events

Webhooks are not email-only. The same endpoint also receives `payment.*` settlement notifications and `interaction.x402.*` events from the x402-over-email flow. The event name is carried in the **`X-Webhook-Event` header** for every family. The body is sent verbatim with no envelope, so it is the header (not a body field) that names the event: an `email.*` body carries `event`, a `payment.*` body carries the name in `type`, and an `interaction.*` body is just `{"interaction": {...}}` with no event/type field at all.

`HandleWebhookEvent(...)` verifies the signature over the raw body first, then keys on the header to return a typed event for known types and an `UnknownEvent` (it does not error) for the rest:

```go
event, err := primitive.HandleWebhookEvent(primitive.HandleWebhookOptions{
	Body:    rawBody,
	Headers: req.Header,
	Secret:  os.Getenv("PRIMITIVE_WEBHOOK_SECRET"),
})
if err != nil {
	// signature/verification failure
}

switch {
case primitive.IsPaymentSettledEvent(event):
	settled := event.(primitive.PaymentEvent) // flat fields; amount in base units
	log.Println(settled.ChallengeID, settled.Amount, settled.SettleTx)
case primitive.IsInteractionX402Event(event):
	x402 := event.(primitive.InteractionEvent) // interaction.x402.* lifecycle
	_ = x402
}
```

The full catalog of header values is exported as the `WebhookEventTypes` slice:

- `email.received`, `email.bounced`, `email.tls_report`, `email.dmarc_report`, `email.dmarc_failure`
- `payment.settled`, `payment.failed`
- `interaction.x402.challenge`, `interaction.x402.payment`, `interaction.x402.settled`, `interaction.x402.rejected`, `interaction.x402.declined`, `interaction.x402.expired`, `interaction.x402.verify_timeout`
- `interaction.ack.received`, `interaction.ack.requested`, `interaction.ack.acked`, `interaction.ack.canceled`, `interaction.ack.expired`

Signature verification runs on the raw body and is independent of the event type, so it works identically for `payment.*` and `interaction.*` bodies. Each delivery is signed with the dual-header scheme: the primary `Primitive-Signature` header and a legacy `MyMX-Signature` header carrying the same value. `HandleWebhook(...)` remains hard-typed to `email.received` for backward compatibility; reach for `HandleWebhookEvent(...)` when you need the full event union.

### Lower-level webhook helpers

Advanced users can still work directly with:

- `HandleWebhook(...)`
- `HandleWebhookEvent(...)`
- `ParseWebhookEvent(...)` (pass the `X-Webhook-Event` value as the optional second argument)
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
