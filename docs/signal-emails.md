# Optional email signals

An email signal is an ordinary threaded email with a short text body and one
`interaction.json` attachment. Sending is always an explicit caller action.
These helpers do not watch an inbox, mark mail read, report progress automatically,
persist an outbox, or introduce another transport.

This document specifies the existing `ack/1` shape and proposed `read/1` and
`working/1` conventions. It does not promise server-side interpretation or UI
support for the proposed conventions. An ordinary send result only describes the
send operation; it does not prove a recipient read or acted on the message.

## Wire format

Use the [version 1 interaction envelope](interaction-envelopes.md), encoded as
UTF-8 JSON, with filename `interaction.json` and content type `application/json`.
The decoded attachment must be at most 65,536 bytes. Each independent signal has
fresh `interaction_id` and `step_id` values and `prev_step_id: null`. Do not append
signals to a completed ACK interaction.

| Kind | protocol | protocol_version | step | expires_at | payload |
| --- | --- | --- | --- | --- | --- |
| ACK | `ack` | `1` | `ack` | `null` | `subject_message_id`, `status`, optional `note` |
| Read | `read` | `1` | `read` | `null` | `subject_message_id` |
| Working | `working` | `1` | `working` | Absolute UTC timestamp | `subject_message_id` |

`subject_message_id` is the original email's RFC Message-ID, including angle
brackets. It is not an API record ID. ACK `status` is exactly one of `received`,
`will_process`, or `will_not_process`. `note`, when present, is a string with at
most 2,000 UTF-16 code units. The helpers reject NUL and invalid Unicode; they
preserve other note whitespace, including CR/LF. No other payload fields are
emitted. Existing ACK meanings are unchanged:

| Signal | Meaning reported by sender | Canonical plain-text body |
| --- | --- | --- |
| `received` | Receipt | `Received your message.` |
| `will_process` | Intention to process | `I intend to process your message.` |
| `will_not_process` | Intention not to process | `I will not process your message.` |
| `read` | Read observation | `I read your message.` |
| `working` | Currently working observation | `I am working on your message.` |

Append an ACK note to its body with exactly two LF characters, followed by the
unchanged note. Receipt does not mean read, and intention does not mean currently
working. A working observation expires at its original timestamp, at most 60
seconds after preparation. It is not a lease, heartbeat, completion guarantee,
or cancellation protocol. Retrying never renews it.

Example attachment:

```json
{"interaction_version":1,"interaction_id":"11111111-1111-4111-8111-111111111111@agent.example","protocol":"read","protocol_version":1,"step":"read","step_id":"22222222-2222-4222-8222-222222222222","prev_step_id":null,"expires_at":null,"payload":{"subject_message_id":"<original@example.com>"}}
```

Envelope fields and the domain suffix are not authentication. Receiver policy
must authenticate the email carrier and associate its sender with the original
recipient before interpreting any status. Parsing an attachment alone grants no
authority and must not trigger actions.

## Preparation contract

Node exports `prepareSignalEmail` and `sendPreparedSignal` from
`@primitivedotdev/sdk/interactions`. Python exports `prepare_signal_email` and
`send_prepared_signal` from `primitive.signals` (also re-exported by
`primitive.interactions`). Go exports `PrepareSignalEmail` and
`SendPreparedSignal` from the root package.

Preparation requires:

- An explicit parent with account scope, authenticated original From, selected
  authorized recipient identity, Message-ID, subject and References.
- Kind `ack`, `read`, or `working`; ACK status/optional note, or an absolute
  `expiresAtMs` for working (Python uses `expires_at_ms`).
- Injected UUID and clock functions. The clock returns integer Unix milliseconds.
  The UUID function must return a fresh UUID on each call; two distinct UUIDs
  are required per signal and normalized to lowercase.

The result is `waiting_on_parent` when the original Message-ID is null or empty.
No clock or UUID call is made in that case. Resolve the original wire ID before
trying again. Malformed nonempty IDs are errors, not waiting states.

The helper accepts single bare ASCII mailboxes, not display names or recipient
lists. Message-IDs accept a bounded printable ASCII form with one `@` and no
internal whitespace or angle brackets; enclosing brackets and outer ASCII spaces
are normalized without case folding. This is a restricted wire-ID form, not a
complete RFC address or Message-ID parser. CR/LF and other header controls are
rejected, including in subjects and account scope. The caller must normalize
address headers and authenticate the original sender before preparation.

The ordinary send body has:

- `from`: the explicitly selected original recipient; `to`: the authenticated
  original sender. No Reply-To following, copied recipients, or inferred account.
- The original nonempty subject, or `Re: Your message` for a missing/empty subject.
- `in_reply_to`: the normalized original Message-ID.
- `references`: the parent's ordered references followed by that Message-ID,
  removing previous copies of the target. Keep the newest suffix bounded to 100
  IDs and 8,192 ASCII bytes including separators. Inputs over 1,000 IDs fail.
- The canonical `body_text` and one inline `attachments` entry with
  `filename`, `content_type`, and `content_base64`. No extra classification header.

Parent IDs and references are capped at 998 bytes after normalization; mailbox
fields at 320 bytes, subject at 998 UTF-8 bytes and account scope at 256 UTF-8 bytes.
The account scope must be nonempty. Clock/expiry values are bounded to the UTC
calendar range from 1970 through 9999. Working expiry must be strictly after the
original preparation clock and no more than 60,000 milliseconds later.

## Persistence, attempts and reconciliation

Preparation returns a record containing `accountScope`, `preparedAtMs`,
`expiresAtMs`, `idempotencyKey` and `requestJson` (idiomatic snake_case fields in
Python). `requestJson` is the complete fixed ordinary send body, including base64
attachment bytes. The key is `signal-` followed by the prepared step UUID. Store
all fields in the caller's outbox **before** attempting HTTP. No credential is
included. Treat this record as immutable: Node freezes it, Python uses a frozen
dataclass, and Go uses a value snapshot whose fields must not be edited. Each
attempt receives a fresh decoded request/copy so adapter mutation cannot change
later retries. Keep persisted state private and trusted; this is not a signed
or authenticated outbox format.

The caller supplies its current account scope again at send time. A mismatch
fails locally before invoking the send operation. This comparison prevents an
accidental account switch; it does not inspect credentials or prove identity.

`sendPreparedSignal` makes one explicit ordinary send operation through the
supplied adapter. The adapter **must forward the prepared idempotency key** as
`Idempotency-Key` unchanged. Distinct messages use distinct explicit keys; retries
reuse their original key. Parent-only suppression applies to automatically
derived keys, so omitting the explicit header can suppress later signals on the
same parent. The helper preserves threading and does not fall back to an
unthreaded send. It returns `response` with the original operation result, even
when that result is an HTTP error response. Operation exceptions propagate.
Python's helper is async: scope and expiry are checked when it is awaited.
Do not introduce delayed dispatch inside an adapter after this check.

At or after a working signal's fixed expiry, send returns `expired` with its
original idempotency key and does not call the adapter. This says nothing about
whether an earlier attempt succeeded. If the record was never dispatched, the
caller can cancel it. If a previous attempt timed out or may have reached the
service, reconcile that same key using the ordinary sent-email reads. Before
expiry, retry the same prepared record and key. Never call preparation again to
retry, replace an uncertain key, or extend an expired working assertion.

## Ordinary-operation adapters

These adapters use the generated `sendEmail` / `send_email` / `SendEmail`
operation, `POST /v1/send-mail`. Configure the existing generated client for the
attachment-capable send host, `https://api.primitive.dev/v1`. Credentials remain
in that client, not in the prepared record. Examples assume a prepared record
already persisted by the caller and an existing configured client.

Node:

```ts
import { sendEmail } from "@primitivedotdev/sdk/api";
import { sendPreparedSignal } from "@primitivedotdev/sdk/interactions";

const outcome = await sendPreparedSignal(
  (body, key) => sendEmail({ client, body, headers: { "Idempotency-Key": key } }),
  prepared,
  { accountScope: currentAccountScope, now: Date.now },
);
```

Python:

```python
import time
from primitive.api.api.sending.send_email import asyncio_detailed
from primitive.api.models.send_mail_input import SendMailInput
from primitive.signals import send_prepared_signal

async def ordinary_send(body, key):
    return await asyncio_detailed(
        client=client, body=SendMailInput.from_dict(body), idempotency_key=key,
    )

outcome = await send_prepared_signal(
    ordinary_send, prepared, account_scope=current_account_scope,
    now=lambda: time.time_ns() // 1_000_000,
)
```

Go:

```go
import (
    "context"
    "encoding/json"
    "time"
    primitive "github.com/primitivedotdev/sdks/sdk-go"
    primitiveapi "github.com/primitivedotdev/sdks/sdk-go/api"
)

// Inside the caller's send function, using an existing generated client:
outcome, err := primitive.SendPreparedSignal(ctx,
    func(ctx context.Context, raw json.RawMessage, key string) (primitiveapi.SendEmailRes, error) {
        var body primitiveapi.SendMailInput
        if err := json.Unmarshal(raw, &body); err != nil { return nil, err }
        return client.SendEmail(ctx, &body, primitiveapi.SendEmailParams{
            IdempotencyKey: primitiveapi.NewOptString(key),
        })
    }, prepared, currentAccountScope, func() int64 { return time.Now().UnixMilli() },
)
```

Shared fixtures exercise preparation byte parity, header bounds, body/key reuse,
account mismatch and expiry. Mock HTTP tests invoke the generated operations in
all three languages. These checks do not claim live email delivery or receiver
interpretation of signals.
