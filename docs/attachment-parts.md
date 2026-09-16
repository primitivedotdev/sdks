# Download one email attachment

Availability: pending service release. These SDK operations describe the new
contract; their presence does not mean the endpoints are deployed.

Use an attachment's metadata `part_index`, not its position in the attachments array.
The index is an integer from 0 through 2147483647. The two bearer-authenticated
operations are:

- `downloadEmailAttachmentPart`: `GET /v1/emails/{id}/attachments/{part_index}`
- `downloadSentAttachmentPart`: `GET /v1/sent-emails/{id}/attachments/{part_index}`

A paired agent can download inbound content addressed to its identity and sent
content sent from its identity. Receiving mail from another sender does not grant
access to that sender's sent content. Function credentials are denied. Other
bearer credentials retain existing email access boundaries.

Successful responses contain original bytes, `X-Content-SHA256`, a safe
`Content-Disposition`, and private/no-store caching instructions. The SDK exposes
the digest as metadata; it does not independently verify that digest. Treat
attachment content as untrusted input. These operations have no interaction or
payment semantics.

## JavaScript, including portable runtimes

Import `/api` to avoid Node-specific root exports. The thin methods use
`ArrayBuffer` and `Uint8Array`, without requiring Buffer or Blob conversion:

```ts
import { PrimitiveClient } from '@primitivedotdev/sdk/api';

const client = new PrimitiveClient({ apiKey });
const part = await client.downloadEmailAttachmentPart(emailId, attachment.part_index);
// part.bytes: Uint8Array; part.sha256, part.contentDisposition, part.cacheControl
const sentPart = await client.downloadSentAttachmentPart(sentEmailId, attachment.part_index);
```

Generated operations of the same names also remain available from `/api`. Their
default binary response is a Blob, and their result exposes the HTTP response.

## Python

```python
from primitive.api.api.emails import download_email_attachment_part
from primitive.api.types import File

result = download_email_attachment_part.sync_detailed(email_id, attachment_index, client=client)
if isinstance(result.parsed, File):
    original_bytes = result.parsed.payload.read()
    digest = result.headers.get('x-content-sha256')
```

The sent equivalent is `primitive.api.api.sending.download_sent_attachment_part`.
Both modules provide sync and async operations and preserve response headers.

## Go

Use the generated client's `DownloadEmailAttachmentPart` or
`DownloadSentAttachmentPart` with the corresponding params struct. Successful
results are `*api.AttachmentPartHeaders`; read original bytes from its `Response`
using `io.ReadAll`. The wrapper exposes the digest and disposition headers.

## CLI

The existing generated command router exposes both operations. There are no
additional shortcut commands:

```sh
primitive emails download-email-attachment-part --id <email-id> --part-index 7 --output attachment.bin
primitive sending download-sent-attachment-part --id <sent-email-id> --part-index 7 --output attachment.bin
```

Without `--output`, stdout contains only the original bytes. Errors go to stderr
and produce a nonzero exit. These binary commands do not support `--json`.

## Errors

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid UUID or metadata index |
| 401 | Missing, invalid, or revoked authentication |
| 403 | Credential lacks the required grant |
| 404 | Missing or inaccessible message, or missing part |
| 409 | `attachment_changed`: refresh email detail before selecting a part again |
| 410 | `content_discarded`: original content is unavailable |
| 413 | `attachment_limit_exceeded` |
| 502 | `attachment_integrity_failed` |
| 503 | `attachment_not_ready` or `attachment_storage_unavailable`; respect `Retry-After` |

The thin JavaScript methods preserve status, error code, and retry delay in
`PrimitiveApiError`. They do not automatically retry or reinterpret a missing
part as an empty attachment.
