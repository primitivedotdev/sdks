# Changelog

## Unreleased

### Breaking Changes

#### Node SDK

- Added explicit `primitivedotdev/webhook`, `primitivedotdev/contract`, and `primitivedotdev/parser` module entrypoints.
- Kept the root `primitivedotdev` entrypoint webhook-focused for compatibility.
- Folded the former standalone Node contract package into `primitivedotdev/contract`.
- Added the Node-only email parser surface at `primitivedotdev/parser`.

### Migration Notes

#### Import Path Changes

```ts
import * as primitive from "primitivedotdev";
import { buildEmailReceivedEvent } from "primitivedotdev/contract";
import { parseEmailWithAttachments } from "primitivedotdev/parser";
```

#### Node-only Modules

`contract` and `parser` are only available in the Node SDK. The Go and Python SDKs continue to expose the webhook surface only.
