# `@primitivedotdev/sdk`

The official Node.js library for [Primitive](https://primitive.dev), an email API for sending and receiving programmatic mail. Typed client for receiving and verifying inbound webhooks, sending mail, parsing raw MIME, and calling the full HTTP API.

## Looking for the CLI?

The `primitive` CLI ships as a separate package, [`primitive`](https://www.npmjs.com/package/primitive). Install it with:

```bash
npm install -g primitive
# or, no-install:
npx primitive@latest <command>
```

This package no longer ships a `primitive` bin. Install `primitive` to get the CLI.

## Install

```bash
npm install @primitivedotdev/sdk
```

Requires Node.js 22 or newer.

## Set your API key

Get a key from your [dashboard](https://primitive.dev) and export it, then pass it to the client as `apiKey` (the examples below read it from `process.env.PRIMITIVE_API_KEY`).

```bash
export PRIMITIVE_API_KEY=prim_...
```

## Library

The default root import is intentionally small and centered on the two most common app-code use cases: receiving inbound webhook deliveries and sending mail.

```ts
import primitive from "@primitivedotdev/sdk";
```

### Receive and reply in a Next.js route

```ts
import primitive from "@primitivedotdev/sdk";

export const runtime = "nodejs";
export const maxDuration = 300;

const client = primitive.client({
  apiKey: process.env.PRIMITIVE_API_KEY!,
});

export async function POST(req: Request) {
  const email = await primitive.receive(req, {
    secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
  });

  await client.reply(email, "Thank you for your email.");

  return Response.json({ ok: true });
}
```

`primitive.receive(...)` reads the request body, verifies the HMAC-SHA256 signature against your account secret (rejecting expired or tampered deliveries), and returns a normalized email object. `client.reply(email, ...)` derives threading and the `Re:` subject from the parent message server-side.

### Send a new email

```ts
import primitive from "@primitivedotdev/sdk";

const client = primitive.client({
  apiKey: process.env.PRIMITIVE_API_KEY!,
});

const result = await client.send({
  from: "Support <support@example.com>",
  to: "alice@example.com",
  subject: "Hello",
  bodyText: "Hi there",
  wait: true,
  waitTimeoutMs: 5000,
});

console.log(result.id, result.status, result.queueId, result.deliveryStatus);
```

By default `send`, `reply`, and `forward` return as soon as Primitive accepts the message for delivery. On `send` and `reply`, pass `wait: true` to keep the HTTP request open until the first downstream SMTP delivery outcome; in that mode, configure your runtime or transport with a request timeout long enough for SMTP delivery, typically 30 to 60 seconds.

### Per-call request options

Every client method accepts an optional second argument with cancellation, timeout, header, and idempotency controls:

```ts
interface RequestOptions {
  // Cancel the in-flight request when this signal fires. Surfaces as AbortError.
  signal?: AbortSignal;
  // Per-call timeout in milliseconds. Composed with `signal` so either fires.
  timeout?: number;
  // Per-call headers merged on top of client-level headers. Last write wins.
  headers?: Record<string, string>;
  // Idempotency key for safe retries. Sent as the Idempotency-Key request header.
  idempotencyKey?: string;
}
```

Cap a single send at 15 seconds:

```ts
await client.send(
  { from, to, subject, bodyText },
  { signal: AbortSignal.timeout(15000) },
);
```

Idempotency key for safe retries (reusing a key returns the original response, so a retried network call deduplicates against the first send):

```ts
await client.send(
  { from, to, subject, bodyText },
  { idempotencyKey: "customer-key-abc123" },
);
```

Client-level config (default fetch, base URL, default headers passed to `primitive.client({...})`) still applies to every call. Per-call `RequestOptions` overrides or merges on top: headers merge (per-call wins on conflict), `signal` and `timeout` compose so the first to fire wins.

### About `wait` mode

When `wait: true`, the call returns the first downstream SMTP outcome (or `waitTimeoutMs`, default 30000). Possible terminal `deliveryStatus` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure (receiver said 4xx); Primitive retries the delivery later
- `wait_timeout` no outcome was observed in time. Treat as "outcome unknown." The send may still complete after the response returns.

### Reply from a different address

`reply()` defaults the From address to the inbound recipient (the address that received the email). When your verified outbound domain differs from your inbound domain, pass `from` explicitly:

```ts
await client.reply(email, {
  text: "Thanks for your email.",
  from: "notifications@outbound.example.com",
});
```

### HTML replies and waiting on the delivery outcome

`reply()` accepts `html` as a sibling of `text`, plus the same `wait` flag the top-level `send()` takes:

```ts
await client.reply(email, {
  text: "Thanks for your email.",
  html: "<p>Thanks for your email.</p>",
  attachments: [
    {
      filename: "report.txt",
      content_base64: Buffer.from("hello").toString("base64"),
    },
  ],
  wait: true,
});
```

`subject` is intentionally not accepted on `reply()`. Gmail's Conversation View needs both a References match and a normalized-subject match to thread, so a custom subject silently breaks the thread for half the recipient population. Use `client.send(...)` if you need full subject control.

If the inbound row is not in a state we can reply to (it was rejected at ingestion, its content was discarded, or it has no recipient recorded), the API returns `inbound_not_repliable` (HTTP 422) and the SDK throws.

### Forward an inbound email

```ts
await client.forward(email, {
  to: "ops@example.com",
  bodyText: "Can you take this one?",
});
```

## The normalized email object

`primitive.receive(...)` returns a normalized inbound email object that keeps the common case clean:

```ts
email.sender.address;
email.sender.name;

email.receivedBy;
email.receivedByAll;

email.replyTarget.address;
email.replySubject;
email.forwardSubject;

email.subject;
email.text;

email.thread.messageId;
email.thread.references;

email.raw;
```

Use `email.raw` when you need the original validated webhook event shape.

## Deciding whether to trust an inbound email

Every `email.received` event carries the server's SPF, DKIM, and DMARC results on `event.email.auth`. Two helpers turn those into decisions, and both are importable from `@primitivedotdev/sdk/api` so they work inside Primitive Functions:

`validateEmailAuth(event.email.auth)` computes an overall verdict (`legit`, `suspicious`, or `unknown`) with a confidence level and human-readable reasons. It answers "was this email authenticated?" but not which domain it was authenticated as: a fully authenticated email from any domain, including one an attacker registered, returns `legit`.

`isTrustedSender(event, { domain, sender? })` anchors the verdict to an expected From domain, for handlers that gate an action on "this really came from our domain":

```ts
import { isTrustedSender } from "@primitivedotdev/sdk/api";

const trust = isTrustedSender(email.raw, { domain: "example.com" });

if (trust.trusted) {
  // Authenticated mail whose From address is @example.com
} else if (trust.retryable) {
  // Transient DNS failure during DMARC evaluation. Respond with a 5xx
  // so webhook redelivery retries this email later.
} else {
  console.warn("Untrusted:", trust.reason, trust.auth.reasons);
}
```

`trusted` is true only when the verdict is `legit`, the domain DMARC evaluated equals `domain`, and the From header strict-parses to a single valid address in `domain` (exactly matching `sender` when given). `reason` is a stable machine-readable code naming the first check that failed.

If you are writing your own check instead, three details matter:

- Do not regex the raw From header. `From: "trusted@example.com" <x@evil.com>` puts an allowlisted address in the display name while DMARC evaluates, and can pass for, `evil.com`.
- Do not authorize based on `email.replyTarget` or `email.smtp.mail_from`; both are fully sender-controlled. `email.sender` is parsed leniently for display purposes and falls back to `smtp.mail_from`, so it is not a safe authorization anchor either.
- An `unknown` verdict has two very different causes: a temporary DNS error (retry later) and a sender domain that publishes no DMARC record (permanent for that email). `isTrustedSender` separates them via `retryable`.

The same helper is available in the Python SDK (`is_trusted_sender`) and the Go SDK (`IsTrustedSender`) with identical semantics.

## x402 payments

The `x402` client lets one agent request a USDC payment and another pay it. It is non-custodial: the payer signs an EIP-3009 `transferWithAuthorization` locally with their own key, and the key never leaves the caller. The platform resolves the real payee address, verifies every signed field against its own records, enforces the org's spend policy, and settles on chain.

The model in four steps:

1. The payee registers a payout address once (proving control of it with a local signature).
2. The payee creates a challenge with `charge()`, which the platform fills in with the registered payout address.
3. The payer signs the challenge locally and submits it with `pay()`.
4. The platform verifies and settles.

Amounts can be given as a human USDC string (`amountUsdc: "0.01"`) or as token base units (`amount: "10000"`, since USDC has 6 decimals). Networks are `base` (mainnet) and `base-sepolia` (testnet). A viem `LocalAccount` from `privateKeyToAccount` is a valid signer: `pay()` uses its `signTypedData`, and `registerPayoutAddress()` also uses its `signMessage`.

Construct the client from the `x402` subpath import (or `primitive.x402(...)` from the root import):

```ts
import { createX402Client } from "@primitivedotdev/sdk/x402";

const x402 = createX402Client({ apiKey: process.env.PRIMITIVE_API_KEY! });
```

### Register a payout address (payee, one time)

The signer proves control of its own address with an ownership message that binds your organization id, so a captured signature can never register the address under a different org. The recovered address becomes your default payout destination for that network, and `charge()` resolves its `pay_to` from this directory, so register before requesting payments. The org id is resolved automatically from your account, so you do not pass it (supply `org` only to override).

```ts
import { createX402Client } from "@primitivedotdev/sdk/x402";
import { privateKeyToAccount } from "viem/accounts";

const x402 = createX402Client({ apiKey: process.env.PRIMITIVE_API_KEY! });
const payee = privateKeyToAccount(process.env.PAYEE_KEY as `0x${string}`);

await x402.registerPayoutAddress(
  { network: "base-sepolia", label: "treasury" },
  { signer: payee },
);
```

### Create a challenge (payee)

```ts
const challenge = await x402.charge({
  amountUsdc: "0.01", // human USDC amount
  network: "base-sepolia",
  payerOrg: process.env.PAYER_ORG_ID, // org allowed to pay this challenge
  description: "API call",
});
```

Pass exactly one of `amountUsdc` (a human USDC string like `"0.01"`) or `amount` (token base units, e.g. `"10000"`). `amountUsdc` is the easy path; `amount` remains available when you already have a base-unit value.

Hand the returned `challenge` object to the payer (for example over email or any out-of-band channel). `getChallenge(id)` re-hydrates a challenge by id, for example to retry `pay()` after a restart.

### Pay a challenge (payer)

The payer signs the interaction-bound authorization locally and submits it. The key never leaves the caller.

```ts
import { privateKeyToAccount } from "viem/accounts";

const payer = privateKeyToAccount(process.env.PAYER_KEY as `0x${string}`);
const receipt = await x402.pay(challenge, { signer: payer });

console.log(receipt.status, receipt.settle_tx); // settled, on-chain tx hash
```

### Email-native payments

The challenge can also ride a real email thread instead of a synthetic id. The payee issues the challenge as an email; the payer signs it into an `interaction.json` payment step and sends it back as an attachment on the reply.

The payee issues the challenge with `createEmailChallenge`. The `pay_to` payout wallet and the token asset are resolved server-side; you only supply the addresses, amount, and network:

```ts
const issued = await x402.createEmailChallenge({
  from: "payee@your-domain.example", // your sending address (the funds receiver)
  to: "payer@their-domain.example", // the payer's address
  amountUsdc: "0.01",
  network: "base-sepolia",
});
// issued.interaction_id is the email thread the payment is bound to;
// issued.challenge carries the payment_requirements + nonce_binding the payer signs.
```

The payer receives the challenge as an `interaction.json` MIME part on an inbound email. Rather than hand-parsing it, pass the part bytes to `parseEmailChallengeFromPart`, which validates the envelope and returns the typed `X402EmailChallenge`:

```ts
import { parseEmailChallengeFromPart } from "@primitivedotdev/sdk/x402";

// `interactionPart` is the body of the inbound email's `interaction.json`
// attachment (a string, a Buffer/Uint8Array, or an already-parsed object).
const issued = parseEmailChallengeFromPart(interactionPart);
```

The payer then signs the challenge locally with `payEmailChallenge` and sends the resulting envelope back as an `interaction.json` attachment. `payEmailChallenge` does not send anything; it returns the signed payment-step envelope and its canonical JSON bytes. The validity window is computed and clamped into the accepted band for you, so you never hand-set `validBefore`:

```ts
import { privateKeyToAccount } from "viem/accounts";

const payer = privateKeyToAccount(process.env.PAYER_KEY as `0x${string}`);
const built = await x402.payEmailChallenge(issued, { signer: payer });

// `built.json` is the interaction.json body. The payer received the challenge
// as an inbound email; reply to it with the envelope attached as
// `interaction.json` using the email client's `reply` method (see the email
// client above). The platform reads the envelope, re-derives the
// interaction-bound nonce, and settles on chain.
import { Buffer } from "node:buffer";
import primitive from "@primitivedotdev/sdk";

const mail = primitive.client({ apiKey: process.env.PRIMITIVE_API_KEY! });
await mail.reply(challengeEmail, {
  text: "Payment attached.",
  attachments: [
    {
      filename: "interaction.json",
      content_type: "application/json",
      content_base64: Buffer.from(built.json, "utf8").toString("base64"),
    },
  ],
});
```

### Signing primitives (lower level)

`pay()` builds and signs the payment for you. When you need to drive the signing yourself, for example to sign a challenge carried in an email reply and submit the payment separately, the same building blocks are exported directly:

- `deriveEip3009Nonce(binding)` derives the interaction-bound EIP-3009 nonce. The byte layout (`keccak256` over the lowercased `interaction_id`, a `0x00` separator, the lowercased `challenge_step_id`, a `0x00` separator, and the 32 raw bytes of the challenge nonce) is locked to a normative vector the platform recomputes.
- `parseEmailChallengeFromPart(part)` validates an inbound `interaction.json` challenge part (string, bytes, or a parsed object) and returns the typed `X402EmailChallenge` ready for `payEmailChallenge`, so you never hand-parse the envelope.
- `computePaymentValidityWindow({ challengeExpiresAtSec, nowSec })` returns the `{ validAfter, validBefore }` window. By default it lands the window inside the band the platform accepts: `validBefore` keeps at least a minimum settlement headroom (60s) so a near-expired challenge is not signed into a guaranteed rejection, and the total window is clamped to the 24h cap so a far-future expiry never produces an "authorization window too wide" rejection. Pass an explicit `validBeforeSec`/`validAfterSec` to pin a bound; with `clamp: false` an out-of-band pinned value throws a specific error naming which bound was violated instead of silently signing a doomed authorization.
- `signInteractionPayment({ sign, payer, domain, payTo, amount, nonceBinding, validAfter, validBefore })` derives the bound nonce, assembles the authorization, and signs it with your `sign` callback. Returns `{ authorization, signature }`. The key never leaves the caller.
- `buildExactEvmPaymentPayload({ network, authorization, signature })` assembles the exact-EVM x402 wire payload, validating the nonce and signature shape.

```ts
import {
  buildExactEvmPaymentPayload,
  computePaymentValidityWindow,
  signInteractionPayment,
} from "@primitivedotdev/sdk/x402";
import { privateKeyToAccount } from "viem/accounts";

const payer = privateKeyToAccount(process.env.PAYER_KEY as `0x${string}`);
const pr = challenge.payment_requirements;
const nowSec = Math.floor(Date.now() / 1000);

const { validAfter, validBefore } = computePaymentValidityWindow({
  challengeExpiresAtSec: Math.floor(Date.parse(challenge.expires_at) / 1000),
  nowSec,
});

const { authorization, signature } = await signInteractionPayment({
  sign: (typedData) => payer.signTypedData(typedData),
  payer: payer.address,
  domain: {
    name: pr.extra.name,
    version: pr.extra.version,
    chainId: 84532, // base-sepolia
    verifyingContract: pr.asset as `0x${string}`,
  },
  payTo: pr.payTo as `0x${string}`,
  amount: BigInt(pr.maxAmountRequired),
  nonceBinding: {
    interactionId: challenge.nonce_binding.interaction_id,
    challengeStepId: challenge.nonce_binding.challenge_step_id,
    challengeNonce: challenge.nonce_binding.challenge_nonce,
  },
  validAfter,
  validBefore,
});

const payment = buildExactEvmPaymentPayload({
  network: "base-sepolia",
  authorization,
  signature,
});
// submit `payment` to /v1/x402/challenges/{id}/pay
```

### Read and set the spend policy

The spend policy guards outbound payments: a `paused` kill-switch, per-payment and daily caps (token base units, or `null` for no cap), and a payee `allowlist` (`null` means any on-net payee, `[]` denies all). `setSpendPolicy` merges: only the fields you pass change, and omitted fields keep their current value. Pass `null` to clear a cap.

```ts
await x402.setSpendPolicy({ paused: false, max_per_payment: "5000000" });
const policy = await x402.getSpendPolicy();

await x402.listPayoutAddresses();
```

### Errors

Every method throws `X402Error` on a client-side, transport, or non-2xx server error. It carries `status` (the HTTP status, or `0` for a request that never reached the server), `body` (the parsed error envelope when present), and `retryAfter` (the `Retry-After` header, when the server sent one). On `pay()`, a `status === 0` error means the request may not have been sent, so the payment outcome is indeterminate.

## Lower-level surfaces

### Explicit `receive` form

If your framework does not expose a standard `Request`, use the lower-level form:

```ts
const email = primitive.receive({
  body: req.body,
  headers: req.headers,
  secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
});
```

### Generated API client

The full HTTP API is exposed as a generated client. Use it when the high-level helpers don't cover what you need:

```ts
import { PrimitiveApiClient, getAccount } from "@primitivedotdev/sdk/api";

const api = new PrimitiveApiClient({ apiKey: process.env.PRIMITIVE_API_KEY });
const result = await getAccount({ client: api.client });
```

#### Primitive Memories

The high-level API client exposes Primitive Memories as durable JSON key-value
records under `client.memories`. Memories default to org scope. Inside a
Primitive Function, omitted scope resolves to that Function id automatically;
explicit function scope uses the function id UUID, not the function name.

```ts
import { createPrimitiveClient } from "@primitivedotdev/sdk/api";

const client = createPrimitiveClient({ apiKey: process.env.PRIMITIVE_API_KEY });

await client.memories.set({
  key: "thread:latest",
  value: { email_id: "em_123" },
});

await client.memories.set({
  key: "state",
  value: { step: 2 },
  scope: { type: "function", id: functionId },
});

const memory = await client.memories.get("thread:latest");

const page = await client.memories.search({
  prefix: "thread:",
  includeValue: false,
});

await client.memories.delete("thread:latest");
```

`client.memories.search` lists memories by key prefix; it is not free-text or
semantic search. Use `client.semanticSearch(...)` for mail search. The raw
generated operations (`setMemory`, `getMemory`, `searchMemories`,
`deleteMemory`) remain exported from `@primitivedotdev/sdk/api` for callers who
want the exact OpenAPI operation shape.

### Webhook signature verification

`primitive.receive(...)` handles verification automatically. If you need to verify a delivery yourself (a different language reverse-proxying through Node, a one-off audit, etc.), the wire format is:

- Header: `Primitive-Signature: t=<unix-seconds>,v1=<hex>`. The same value also rides `X-Primitive-Signature` and `X-Webhook-Signature`; the SDK additionally accepts the retired `MyMX-Signature` name when verifying older captured deliveries.
- Signed string: `${timestamp}.${rawBody}` where `rawBody` is the exact request bytes before any JSON decoding.
- Signature: HMAC-SHA256, hex-encoded.
- Secret: returned by `GET /account/webhook-secret`. Use as a UTF-8 string; do not base64-decode despite the base64-shaped output.
- Tolerance: reject deliveries with a timestamp more than 5 minutes off your wall-clock.

The Node helper:

```ts
import { verifyWebhookSignature } from "@primitivedotdev/sdk/webhook";

verifyWebhookSignature({
  rawBody: rawBodyString,
  signatureHeader: req.headers["primitive-signature"] as string,
  secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
});
```

`rawBody` must be the exact bytes of the HTTP body (string or Buffer) before any JSON parsing. `signatureHeader` is the value of the `Primitive-Signature` header verbatim. Throws `WebhookVerificationError` on mismatch, expired timestamp, or malformed input. Pass `toleranceSeconds` to override the default 300-second replay window.

For most app-code callers, `primitive.receive(...)` from the root import handles both the body extraction and verification in one call (see "Receive and reply in a Next.js route" above). Reach for `verifyWebhookSignature` directly when your framework doesn't expose a standard `Request` and you've already pulled the raw body and header value yourself.

For the full reference (response codes, replay protection details), see the API-level "Webhook signing" section in the [OpenAPI spec](https://api.primitive.dev/v1/openapi).

### Payment and interaction webhook events

Webhooks are not email-only. The same endpoint also receives `payment.*` settlement notifications and `interaction.x402.*` events from the x402-over-email flow. The event name is carried in the **`X-Webhook-Event` header** for every family. The body is sent verbatim with no envelope, so it is the header (not a body field) that names the event: an `email.*` body carries `event`, a `payment.*` body carries the name in `type`, and an `interaction.*` body is just `{ interaction: { ... } }` with no event/type field at all.

`handleWebhookEvent` verifies the signature over the raw body first, then keys on the header to return a typed event for known types and an `UnknownEvent` (it does not throw) for the rest:

```ts
import {
  handleWebhookEvent,
  isPaymentSettledEvent,
  isInteractionX402Event,
} from "@primitivedotdev/sdk/webhook";

const event = handleWebhookEvent({
  body: rawBodyString,
  headers: req.headers,
  secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
});

if (isPaymentSettledEvent(event)) {
  // typed PaymentSettledEvent: flat fields, amount in token base units
  console.log("settled", event.challenge_id, event.amount, event.settle_tx);
} else if (isInteractionX402Event(event)) {
  // typed interaction.x402.* event (challenge/payment/settled/...)
  console.log(event.event, event.interaction);
}
```

The full catalog of header values is the `WebhookEventType` union, also exported as the `WEBHOOK_EVENT_TYPES` array:

- `email.received`, `email.bounced`, `email.tls_report`, `email.dmarc_report`, `email.dmarc_failure`
- `payment.settled`, `payment.failed`
- `interaction.x402.challenge`, `interaction.x402.payment`, `interaction.x402.settled`, `interaction.x402.rejected`, `interaction.x402.declined`, `interaction.x402.expired`, `interaction.x402.verify_timeout`
- `interaction.ack.received`, `interaction.ack.requested`, `interaction.ack.acked`, `interaction.ack.canceled`, `interaction.ack.expired`

Signature verification runs on the raw body and is independent of the event type, so it works identically for `payment.*` and `interaction.*` bodies. Each delivery is signed once; the same `t=...,v1=...` value is sent on the primary `Primitive-Signature` header plus `X-Primitive-Signature` and `X-Webhook-Signature` for non-SDK consumers. The SDK verifies `Primitive-Signature`, and still accepts the retired `MyMX-Signature` header name when verifying older captured deliveries. `handleWebhook` remains hard-typed to `email.received` for backward compatibility; reach for `handleWebhookEvent` when you need the full event union.

### Other subpath imports

- `@primitivedotdev/sdk/openapi` exports the OpenAPI document and the operation manifest as JSON. Useful for tools that want the spec inline.
- `@primitivedotdev/sdk/contract` builds and signs webhook payloads. Useful for tests or replaying inbound events through your own handler.
- `@primitivedotdev/sdk/parser` parses raw `.eml` files and bundles attachments. Useful when you receive inbound mail through a different path (forwarded `.eml` files, archived storage) and want the same normalization the webhook receiver applies.

## Going further

- [primitive.dev/docs](https://primitive.dev/docs) for product docs (quickstart, webhook payload reference, FAQ).
- [api.primitive.dev/v1/openapi](https://api.primitive.dev/v1/openapi) for the machine-readable OpenAPI spec.
- `primitive list-operations` for the same spec as a JSON manifest, fetched from the bundled SDK.
- `primitive describe <command>` for the inlined request/response schema of a single operation, including per-field descriptions.

## Development

From `sdks/sdk-node`:

```bash
pnpm install
pnpm generate
pnpm typecheck
pnpm test
pnpm build
```

Or from repo root `sdks/`:

```bash
make node-generate
make node-check
make node-build
```
