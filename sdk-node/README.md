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
  idempotencyKey: "customer-key-123",
  wait: true,
  waitTimeoutMs: 5000,
});

console.log(result.id, result.status, result.queueId, result.deliveryStatus);
```

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
