# Changelog

## 0.7.0

### Added

#### Node SDK

- `parseFromHeader` and `parseFromHeaderLoose` at `@primitivedotdev/sdk/parser`: structured parsers for RFC 5322 From-style headers, built on `nodemailer/lib/addressparser` (the same parser mailparser and mailauth use under the hood). The strict variant returns a typed `Result` and rejects multi-address headers, group syntax, malformed addresses, and over-long input. It is intended for security-bearing callers like permission gates. The loose variant returns the first parseable address or null and is intended for display-only uses (inbox UI, log lines). Both lowercase the address and bound input length. Node-only because parsing is a hosting-side concern.

## 0.6.0

### Breaking Changes

#### Node SDK

- Dropped the `event_id` override from `buildEmailReceivedEvent` options and from `BuildEventFromParsedDataOptions.buildOptions`. The event ID is now always computed by `generateEventId(endpoint_id, email_id)`. Callers that previously passed `event_id` can rely on the deterministic generator, or supply a unique `email_id` per call if they need distinct IDs. Rationale: the option accepted any `string` but was validated at runtime against `^evt_[a-f0-9]{64}$`, letting producers ship payloads that crashed the schema validator only when the webhook fired.

## 0.5.1

### Changed

- Relaxed the URL pattern on `email.content.download.url` and `email.parsed.attachments_download_url` from `^https://` to `^https?://`. Managed Primitive continues to issue HTTPS URLs; self-host deployments may now issue HTTP URLs that resolve inside the operator's network (e.g. `http://localhost:4001/...`) without failing schema validation. Receivers that want to refuse plaintext downloads should check the scheme explicitly — the SDK no longer guarantees it.

## Unreleased

### Added

#### Node SDK

- `buildEventFromParsedData` at `@primitivedotdev/sdk/contract`: pure adapter that takes raw bytes plus parser output plus delivery metadata and returns a schema-valid `EmailReceivedEvent`. Handy when a producer already has parsed email data in memory and needs to ship an event without reading from disk.
- `generateDownloadToken` and `verifyDownloadToken` at `@primitivedotdev/sdk/webhook`: HMAC-SHA256 signed tokens for per-email download URLs. Tokens are self-describing (`email_id`, audience, expiry) and verify without server-side state. The verifier returns a discriminated-union result with distinct reasons on failure.

Python and Go parity for the download-token functions will follow in later releases. `buildEventFromParsedData` is Node-only because it consumes the Node parser's output shape.

### Breaking Changes

#### Node SDK

- Added explicit `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/contract`, and `@primitivedotdev/sdk/parser` module entrypoints.
- Kept the root `@primitivedotdev/sdk` entrypoint webhook-focused for compatibility.
- Folded the former standalone Node contract package into `@primitivedotdev/sdk/contract`.
- Added the Node-only email parser surface at `@primitivedotdev/sdk/parser`.

#### Python SDK

- Renamed the published Python package to `primitivedotdev`.
- Renamed the public Python import package to `primitive`.

### Migration Notes

#### Import Path Changes

```ts
import { handleWebhook } from "@primitivedotdev/sdk";
import { buildEmailReceivedEvent } from "@primitivedotdev/sdk/contract";
import { parseEmailWithAttachments } from "@primitivedotdev/sdk/parser";
```

#### Node-only Modules

`contract` and `parser` are only available in the Node SDK. The Go and Python SDKs continue to expose the webhook surface only.

#### Python Import Path Changes

```py
from primitive import PrimitiveWebhookError, handle_webhook
```
