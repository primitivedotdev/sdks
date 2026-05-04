# `@primitivedotdev/sdk`

The official Node.js SDK and command-line tool for [Primitive](https://primitive.dev), an email API for sending and receiving programmatic mail.

The package ships two things in one install:

- A **`primitive` CLI** for interactive use, scripts, and agent workflows. Sends mail, reads inbound, inspects send history, manages domains and webhook endpoints, all in one binary.
- A **typed Node library** for programmatic integration in app code. Receives and verifies inbound webhooks, sends mail, parses raw MIME, and exposes the full HTTP API as generated functions.

Pick whichever fits the call site. The two share the same auth (`PRIMITIVE_API_KEY`), the same data shapes, and the same OpenAPI spec.

## Install

```bash
npm install @primitivedotdev/sdk
```

For one-off CLI use, `npx @primitivedotdev/sdk@latest <command>` works without installing.

Requires Node.js 22 or newer.

## Set your API key

Get a key from your [dashboard](https://primitive.dev) and export it. Both the CLI and the library default to reading `PRIMITIVE_API_KEY` from the environment.

```bash
export PRIMITIVE_API_KEY=prim_...
```

## Command line

Everything below assumes `PRIMITIVE_API_KEY` is set. Each command also accepts `--api-key <value>` if you want to pass it explicitly.

```bash
# Confirm the key is live and see which account it authenticates.
primitive whoami

# Send an email. --wait blocks until the receiving MTA returns a delivery
# outcome (a synchronous SMTP 250 from Gmail, etc.); without it, the call
# returns once Primitive has accepted the message for delivery.
primitive send --to alice@example.com --body "Hi Alice!" --wait

# See the most recent inbound emails as a compact text table.
# IDs are full UUIDs when piped, truncated for interactive terminals.
primitive emails:latest --limit 5

# Read one inbound's full record (body, headers, threading metadata).
primitive emails:get-email --id <uuid>

# Reply to an inbound. Threading and the "Re:" subject are derived
# server-side from the parent message; you supply only the body.
primitive sending:reply-to-email --id <inbound-id> --body-text "..."

# See where you are allowed to send. Returns a typed list of
# permission rules (managed-zone wildcards, your own verified domains,
# specific addresses with grants). The send-mail call enforces these
# at request time.
primitive sending:get-send-permissions

# Look up an operation's request/response schema, including per-field
# descriptions sourced from the OpenAPI spec.
primitive describe emails:get-email
primitive describe sending:send-email
```

Run `primitive --help` for the full topic list and `primitive <topic> --help` for the commands within each. Every command accepts `--help`, and the descriptions are detailed enough that the CLI is self-documenting for most workflows.

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
  // Use a unique key per logical send. Reusing a key returns the original
  // response from the first send, which is how retries are deduplicated.
  idempotencyKey: "customer-key-abc123",
  wait: true,
  waitTimeoutMs: 5000,
});

console.log(result.id, result.status, result.queueId, result.deliveryStatus);
```

`send`, `reply`, and `forward` keep the HTTP request open until Primitive's downstream SMTP transaction completes. In production, configure your runtime or transport with a request timeout long enough for SMTP delivery, typically 30 to 60 seconds.

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
  body: rawBodyString,
  headers: req.headers,
  secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
});
```

For the full reference (response codes, replay protection details), see the API-level "Webhook signing" section in the [OpenAPI spec](https://primitive.dev/api/v1/openapi).

### Other subpath imports

- `@primitivedotdev/sdk/openapi` exports the OpenAPI document and the operation manifest as JSON. Useful for tools that want the spec inline.
- `@primitivedotdev/sdk/contract` builds and signs webhook payloads. Useful for tests or replaying inbound events through your own handler.
- `@primitivedotdev/sdk/parser` parses raw `.eml` files and bundles attachments. Useful when you receive inbound mail through a different path (forwarded `.eml` files, archived storage) and want the same normalization the webhook receiver applies.

## Going further

- [primitive.dev/docs](https://primitive.dev/docs) for product docs (quickstart, webhook payload reference, FAQ).
- [primitive.dev/api/v1/openapi](https://primitive.dev/api/v1/openapi) for the machine-readable OpenAPI spec.
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
