# Changelog

## Unreleased

### Breaking Changes

#### Node SDK

- Added explicit `@primitivedotdev/sdk/webhook`, `@primitivedotdev/sdk/contract`, and `@primitivedotdev/sdk/parser` module entrypoints.
- Kept the root `@primitivedotdev/sdk` entrypoint webhook-focused for compatibility.
- Folded the former standalone Node contract package into `@primitivedotdev/sdk/contract`.
- Added the Node-only email parser surface at `@primitivedotdev/sdk/parser`.

### Migration Notes

#### Import Path Changes

```ts
import { handleWebhook } from "@primitivedotdev/sdk";
import { buildEmailReceivedEvent } from "@primitivedotdev/sdk/contract";
import { parseEmailWithAttachments } from "@primitivedotdev/sdk/parser";
```

#### Node-only Modules

`contract` and `parser` are only available in the Node SDK. The Go and Python SDKs continue to expose the webhook surface only.
