# Primitive SDKs

[![SDK Checks](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml/badge.svg?branch=main)](https://github.com/primitivedotdev/sdks/actions/workflows/sdk-checks.yml)

Monorepo for the Primitive SDKs.

Primitive is an inbound and outbound email platform. The SDKs are centered on a
small default workflow:

1. receive an inbound email
2. inspect a normalized email object
3. send, reply, or forward synchronously

## SDKs

| SDK | Install target | README |
| --- | --- | --- |
| Node.js | `npm install @primitivedotdev/sdk` | `sdk-node/README.md` |
| Python | `pip install primitivedotdev` | `sdk-python/README.md` |
| Go | `go get github.com/primitivedotdev/sdks/sdk-go@latest` | `sdk-go/README.md` |

## Default API shape

Across the SDKs, the default story is:

- receive inbound mail with `receive(...)`
- create an outbound client with `client(...)`
- send new mail with `send(...)`
- continue a thread with `reply(...)`
- forward a message with `forward(...)`

The Node.js end-state looks like this:

```ts
import primitive from "@primitivedotdev/sdk";

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

## Advanced surfaces

The low-level and generated APIs still exist for advanced use cases:

- webhook verification/parsing helpers
- generated HTTP API packages
- OpenAPI exports
- contract tooling
- raw MIME parsing helpers
- CLI

The SDK refresh keeps those escape hatches available, but the primary docs story
focuses on the inbound/outbound automation flow above.

## Repository layout

```text
sdks/
  .github/workflows/
  openapi/
  json-schema/
  sdk-go/
  sdk-node/
  sdk-python/
  test-fixtures/
```

## Development

Use the root `Makefile` as the main task interface:

```bash
make node-generate python-generate go-generate
make check
make build
make shared-check
```

The `Makefile` wraps each SDK's native commands. You can still run them directly
 from each SDK directory when needed:

```bash
cd sdk-node && pnpm typecheck && pnpm test
cd sdk-python && uv sync --dev && uv run pytest && uv run ruff check . && uv run basedpyright
cd sdk-go && go test ./... && go test -run TestSharedCompatibilityFixtures ./...
```

## Documentation

- `docs/architecture.md` gives the repository architecture and package layout
- `docs/schema-generation.md` documents schema/codegen flow
- `docs/repo-model.md` documents the monorepo task model
- `RELEASE.md` documents the release process
