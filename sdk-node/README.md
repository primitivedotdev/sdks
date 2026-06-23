# `@primitivedotdev/sdk`

The official Node.js library for [Primitive](https://primitive.dev), an email API for sending and receiving programmatic mail. Typed client for receiving and verifying inbound webhooks, sending mail, parsing raw MIME, and calling the full HTTP API.

## Looking for the CLI?

The `primitive` CLI ships as a separate package, [`@primitivedotdev/cli`](https://www.npmjs.com/package/@primitivedotdev/cli). Install it with:

```bash
npm install -g @primitivedotdev/cli
# or, no-install:
npx @primitivedotdev/cli@latest <command>
```

This package no longer ships a `primitive` bin. Install `@primitivedotdev/cli` to get the CLI.

## Install

```bash
npm install @primitivedotdev/sdk
```

Requires Node.js 22 or newer.

## Set your API key

Get a key from your [dashboard](https://primitive.dev) and export it. The library defaults to reading `PRIMITIVE_API_KEY` from the environment.

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

`send`, `reply`, and `forward` keep the HTTP request open until Primitive's downstream SMTP transaction completes. In production, configure your runtime or transport with a request timeout long enough for SMTP delivery, typically 30 to 60 seconds.

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
- `deferred` temporary failure, the receiving MTA may retry
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

If the inbound row is not in a state we can reply to (no `Message-Id` recorded, or content was discarded), the API returns `inbound_not_repliable` (HTTP 422) and the SDK throws.

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

### Webhook signature verification

`primitive.receive(...)` handles verification automatically. If you need to verify a delivery yourself (a different language reverse-proxying through Node, a one-off audit, etc.), the wire format is:

- Header: `Primitive-Signature: t=<unix-seconds>,v1=<hex>`. A legacy `MyMX-Signature` header carries the same value for back-compat.
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
