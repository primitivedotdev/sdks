# Changelog

## Unreleased

### Breaking Changes

#### Node SDK

- Added explicit `@primitivedotdev/sdk-node/webhook`, `@primitivedotdev/sdk-node/contract`, and `@primitivedotdev/sdk-node/parser` module entrypoints.
- Kept the root `@primitivedotdev/sdk-node` entrypoint webhook-focused for compatibility.
- Folded the former standalone Node contract package into `@primitivedotdev/sdk-node/contract`.
- Added the Node-only email parser surface at `@primitivedotdev/sdk-node/parser`.

### Migration Notes

#### Import Path Changes

```ts
import { handleWebhook } from "@primitivedotdev/sdk-node";
import { buildEmailReceivedEvent } from "@primitivedotdev/sdk-node/contract";
import { parseEmailWithAttachments } from "@primitivedotdev/sdk-node/parser";
```

#### Node-only Modules

`contract` and `parser` are only available in the Node SDK. The Go and Python SDKs continue to expose the webhook surface only.
