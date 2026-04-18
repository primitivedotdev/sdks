# Changelog

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
