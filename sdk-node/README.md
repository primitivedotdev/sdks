# `primitivedotdev`

Official Primitive Node.js SDK.

This package ships three Node.js modules:

- `primitivedotdev` for the webhook module
- `primitivedotdev/contract` for the contract module
- `primitivedotdev/parser` for the parser module

`contract` and `parser` are only available in the Node SDK. The Go and Python SDKs expose the webhook surface only.

## Requirements

- Node.js `>=22`

## Installation

```bash
npm install primitivedotdev
```

## Modules

### Webhook

The root entrypoint remains webhook-focused.

```ts
import * as primitive from "primitivedotdev";

app.post("/webhooks/email", express.raw({ type: "application/json" }), (req, res) => {
  try {
    const event = primitive.handleWebhook({
      body: req.body,
      headers: req.headers,
      secret: process.env.PRIMITIVE_WEBHOOK_SECRET!,
    });

    console.log("Email from:", event.email.headers.from);
    console.log("Subject:", event.email.headers.subject);

    res.json({ received: true });
  } catch (error) {
    if (error instanceof primitive.PrimitiveWebhookError) {
      return res.status(400).json({ error: error.code, message: error.message });
    }

    throw error;
  }
});
```

The same API is also available from `primitivedotdev/webhook`.

Webhook exports include:

- `handleWebhook(options)`
- `parseWebhookEvent(input)`
- `validateEmailReceivedEvent(input)`
- `safeValidateEmailReceivedEvent(input)`
- `verifyWebhookSignature(options)`
- `validateEmailAuth(auth)`
- `emailReceivedEventJsonSchema`
- `WEBHOOK_VERSION`
- webhook error classes and webhook types

### Contract

Use the contract module when constructing canonical Primitive webhook payloads on the producer side.

```ts
import { buildEmailReceivedEvent, signWebhookPayload } from "primitivedotdev/contract";

const event = buildEmailReceivedEvent({
  email_id: "email-123",
  endpoint_id: "endpoint-456",
  message_id: "<msg@example.com>",
  sender: "from@example.com",
  recipient: "to@example.com",
  subject: "Hello",
  received_at: "2025-01-01T00:00:00Z",
  smtp_helo: "mail.example.com",
  smtp_mail_from: "from@example.com",
  smtp_rcpt_to: ["to@example.com"],
  raw_bytes: Buffer.from("hello"),
  raw_sha256: "a".repeat(64),
  raw_size_bytes: 5,
  attempt_count: 1,
  date_header: null,
  download_url: "https://example.com/raw",
  download_expires_at: "2025-01-02T00:00:00Z",
  attachments_download_url: null,
  auth: {
    spf: "pass",
    dmarc: "pass",
    dmarcPolicy: "reject",
    dmarcFromDomain: "example.com",
    dmarcSpfAligned: true,
    dmarcDkimAligned: true,
    dmarcSpfStrict: false,
    dmarcDkimStrict: false,
    dkimSignatures: [],
  },
  analysis: {},
});

const signature = signWebhookPayload(JSON.stringify(event), "whsec_test");
```

Contract exports include:

- `buildEmailReceivedEvent(input, options?)`
- `generateEventId(endpointId, emailId)`
- `RAW_EMAIL_INLINE_THRESHOLD`
- `signWebhookPayload(rawBody, secret, timestamp?)`
- `WEBHOOK_VERSION`
- contract input and payload helper types

### Parser

Use the parser module for raw `.eml` parsing and attachment extraction.

```ts
import {
  bundleAttachments,
  parseEmail,
  parseEmailWithAttachments,
  toParsedDataComplete,
} from "primitivedotdev/parser";

const parsed = await parseEmailWithAttachments(emlBuffer);
const archive = await bundleAttachments(parsed.attachments);
const webhookParsed = toParsedDataComplete(parsed, null);

await parseEmail(emlBuffer.toString("utf8"));
```

Parser exports include:

- `parseEmail(emlRaw)`
- `parseEmailWithAttachments(emlBuffer, options?)`
- `bundleAttachments(attachments)`
- `extractAttachmentMetadata(attachments)`
- `getAttachmentsStorageKey(emailId, sha256)`
- `toParsedDataComplete(parsed, attachmentsDownloadUrl)`
- `toWebhookAttachments(attachments)`
- `attachmentMetadataToWebhookAttachments(metadata)`
- `toCanonicalHeaders(parsed)`
- parser attachment and bundle types

## Shared Schema

The webhook payload contract is defined by the canonical JSON schema in the repository and is exported by this package as `emailReceivedEventJsonSchema`.

The SDK uses that schema to generate:

- TypeScript types
- runtime validators
- the published schema export

## Error Handling

All SDK-specific runtime errors extend `PrimitiveWebhookError` and include a stable error `code`.

```ts
import * as primitive from "primitivedotdev";

try {
  // ...
} catch (error) {
  if (error instanceof primitive.PrimitiveWebhookError) {
    console.error(error.code, error.message);
  }
}
```

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
make node-install
make node-check
make node-build
```

## Package Layout

```text
sdk-node/
  src/
    contract/
      contract.ts
      index.ts
    parser/
      attachment-bundler.ts
      attachment-parser.ts
      email-parser.ts
      index.ts
      mapping.ts
    webhook/
      auth.ts
      encoding.ts
      errors.ts
      index.ts
      parsing.ts
      signing.ts
      version.ts
    generated/
      email-received-event.validator.generated.ts
    index.ts
    schema.generated.ts
    types.generated.ts
    types.ts
    validation.ts
```
