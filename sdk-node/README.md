# `@primitivedotdev/sdk`

Official Primitive Node.js SDK.

The default root import is intentionally small and centered on email
automation:

- `primitive.receive(...)`
- `primitive.client(...)`
- `client.send(...)`
- `client.reply(...)`
- `client.forward(...)`

Advanced webhook helpers, generated API operations, OpenAPI exports, contract
tooling, raw MIME parsing, and the CLI still exist as named exports or subpath
imports.

## Requirements

- Node.js `>=22`

## Installation

```bash
npm install @primitivedotdev/sdk
```

## Basic usage

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

`send`, `reply`, and `forward` keep the HTTP request open until Primitive's
downstream SMTP transaction completes. In production, configure your runtime or
transport with a request timeout long enough for SMTP delivery, typically 30-60
seconds.

### About `wait` mode

When `wait: true`, the call returns the first downstream SMTP outcome (or
`waitTimeoutMs`, default 30000). Possible terminal `deliveryStatus` values:

- `delivered` accepted by the receiving MTA
- `bounced` rejected by the receiving MTA (the response is still 200 OK)
- `deferred` temporary failure, the receiving MTA may retry
- `wait_timeout` no outcome was observed in time. Treat as "outcome unknown."
  The send may still complete after the response returns.

### Reply from a different address

`reply()` defaults the From address to the inbound recipient (the address that
received the email). When your verified outbound domain differs from your
inbound domain, pass `from` explicitly:

```ts
await client.reply(email, {
  text: "Thanks for your email.",
  from: "notifications@outbound.example.com",
});
```

### HTML replies and waiting on the delivery outcome

`reply()` accepts `html` as a sibling of `text`, plus the same `wait` flag the
top-level `send()` takes:

```ts
await client.reply(email, {
  text: "Thanks for your email.",
  html: "<p>Thanks for your email.</p>",
  wait: true,
});
```

`subject` is intentionally not accepted on `reply()`. Gmail's Conversation View
needs both a References match and a normalized-subject match to thread, so a
custom subject silently breaks the thread for half the recipient population.
Use `client.send(...)` if you need full subject control.

If the inbound row is not in a state we can reply to (no `Message-Id` recorded,
or content was discarded), the API returns `inbound_not_repliable` (HTTP 422)
and the SDK throws.

### Forward an inbound email

```ts
await client.forward(email, {
  to: "ops@example.com",
  bodyText: "Can you take this one?",
});
```

## The normalized email object

`primitive.receive(...)` returns a normalized inbound email object that keeps the
common case clean:

```ts
email.sender.address
email.sender.name

email.receivedBy
email.receivedByAll

email.replyTarget.address
email.replySubject
email.forwardSubject

email.subject
email.text

email.thread.messageId
email.thread.references

email.raw
```

Use `email.raw` when you need the original validated webhook event shape.

## Advanced usage

### Explicit receive form

If your framework does not expose a standard `Request`, use the lower-level
form:

```ts
const email = primitive.receive({
  body: req.body,
  headers: req.headers,
  secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
});
```

### Generated API module

Use the API subpath when you want the full generated HTTP API surface:

```ts
import { PrimitiveApiClient, getAccount } from "@primitivedotdev/sdk/api";

const api = new PrimitiveApiClient({ apiKey: process.env.PRIMITIVE_API_KEY });
const result = await getAccount({ client: api.client });
```

### Other advanced surfaces

- `@primitivedotdev/sdk/webhook`
- `@primitivedotdev/sdk/openapi`
- `@primitivedotdev/sdk/contract`
- `@primitivedotdev/sdk/parser`
- `primitive` CLI

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
