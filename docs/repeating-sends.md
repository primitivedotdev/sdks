# Repeating sends

A send (`POST /v1/send-mail`) or reply (`POST /v1/emails/{id}/reply`) with a
`repeat` object goes out now and then again every `every_minutes` in the same
thread. Each later message is an ordinary scheduled send, so quotas, gates and
cancellation apply as usual.

```json
"repeat": {
  "every_minutes": 30,
  "only_if_recipient_idle_minutes": 15,
  "stoppable_by_recipient": true,
  "max_sends": 8,
  "until": "2026-10-09T17:00:00Z"
}
```

Only `every_minutes` (5 to 10080) is required. A repeating send needs exactly
one `to` recipient and no cc, bcc, attachments or `fyi`
(`422 repeat_unsupported`), and is created with a member login or an organization
API key; connected-agent and Function credentials get `403 repeat_unsupported`.
The recipient must be an address of your own
organization (`403 repeat_recipient_external`), and
`only_if_recipient_idle_minutes` likewise needs a recipient in your organization
(`422 repeat_idle_requires_internal_recipient`). The send result carries
`repeat_id`.

Manage repeats you created under `/v1/repeating-sends` (list, get, `PATCH` to
pause, resume or cancel, delete). Agent credentials get 403 there. Email reads carry a `repeat` marker,
`{"repeat_id": "...", "sequence": 1}` or null, resolved from Primitive's own
records rather than the message content.

## Interactions

Each repeated message carries an `interaction.json` part:

| Field | Value |
|---|---|
| `protocol` | `repeat.tick` |
| `protocol_version` | `1` |
| `step` | `tick` |
| `payload.repeat_id` | repeat UUID |
| `payload.sequence` | 1 for the first message, then one higher per message |
| `payload.every_minutes` | 5 to 10080 |
| `payload.only_if_recipient_idle_minutes` | 1 to 10080, or null |
| `payload.stoppable_by_recipient` | whether the recipient may stop the repeat |

When the recipient stops a repeat, the server replies in the thread from the
recipient to the sender with a `repeat.stop` (version 1, step `stop`) part whose
payload is `{"reason": "..."}`, or `{}` without a reason. The reason is
recipient-written text of at most 280 UTF-16 code units.

Hand-built `repeat.stop` mail is not interpreted. Only the stop endpoint stops a
repeat.

## Stopping a repeat as the recipient

`POST /v1/emails/{id}/repeat-stop` with `{"reason": "..."}` (optional), as the
recipient: a connected agent's own credential, or the member whose personal
address received it. `{id}` is the recipient's copy of any message of the
repeat, or the repeat id the message footer prints. A repeat call on a repeat already stopped returns the same result
without a second reply.

- CLI: `primitive repeat stop --id <repeat-id or email-id> [--reason "..."]`
- Node: `client.repeats.stop(emailId, { reason })`

## Parsing helpers

The helpers parse and build data only; they make no requests and do not show
that Primitive sent a message. Use the `repeat` marker for that.

| Node (`@primitivedotdev/sdk/interactions`) | Python (`primitive.repeats`) | Go |
|---|---|---|
| `parseRepeatTick(bytes)` | `parse_repeat_tick(bytes)` | `ParseRepeatTick` |
| `readRepeatTick(envelope)` | `read_repeat_tick(envelope)` | `ReadRepeatTick` |
| `parseRepeatStop(bytes)` | `parse_repeat_stop(bytes)` | `ParseRepeatStop` |
| `readRepeatStop(envelope)` | `read_repeat_stop(envelope)` | `ReadRepeatStop` |
| `buildRepeatStopBody({ reason })` | `build_repeat_stop_body(reason)` | `BuildRepeatStopBody` |
| `repeatStopCommand(emailId)` | `repeat_stop_command(email_id)` | `RepeatStopCommand` |

Parse results have status `valid`, `other` (a valid envelope of a different
protocol or version) or `invalid` (`invalid_envelope`, `invalid_step` or
`invalid_payload`). `test-fixtures/repeat-interactions.json` holds the shared
cases all three SDKs run.
