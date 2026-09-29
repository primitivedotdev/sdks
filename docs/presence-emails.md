# Presence emails

These pure helpers prepare a proposed `primitive.presence/1` probe and its
terminal alive reply using ordinary email and one `interaction.json` attachment.
They never send, schedule, authenticate, consult a receiver, or start a model turn.
Use an authenticated configured issuer and authenticate the exact attachment
bytes separately. Protocol parsing alone grants no authority.
Primitive-hosted probes are issued by the platform scheduler. Preparing a probe
does not register an outstanding challenge or grant control-send permission.

The Primitive CLI handles these exchanges automatically for a connected session.
A custom receiver can prepare its reply with the Node helper below, using a
probe already authenticated by its host. `client` is its configured API client,
and `savePrepared` must durably save the snapshot before the send:

```ts
import { randomUUID } from "node:crypto";
import { sendEmail } from "@primitivedotdev/sdk/api";
import { preparePresenceAliveEmail } from "@primitivedotdev/sdk/interactions";

const reply = preparePresenceAliveEmail({
  accountScope,
  from: assignedAddress,
  to: pinnedReturnAddress,
  probe: authenticatedProbe,
  messageId: receivedMessageId,
  references: receivedReferences,
}, { uuid: randomUUID, now: Date.now });

if (reply.status === "prepared") {
  await savePrepared(reply.prepared);
  const result = await sendEmail({
    client,
    body: JSON.parse(reply.prepared.requestJson),
    headers: { "Idempotency-Key": reply.prepared.idempotencyKey },
  });
  // Inspect the result and reconcile uncertain outcomes before retrying.
}
```

Node exports `parsePresenceEnvelope`, `preparePresenceProbeEmail`, and
`preparePresenceAliveEmail` from `@primitivedotdev/sdk/interactions`. Python
exports the corresponding snake_case helpers from `primitive.presence` and
`primitive.interactions`. Go exports `ParsePresenceEnvelope`,
`ParsePresenceEnvelopeString`, `PreparePresenceProbeEmail`, and
`PreparePresenceAliveEmail` from the root package.

Probe preparation takes explicit account scope, sender and recipient, plus
injected clock, UUID and nonce functions. Alive preparation takes the
caller-authenticated parsed probe, assigned sender, pinned return address,
actual probe Message-ID and References, plus clock and UUID functions. The nonce
is 32 or 64 lowercase hexadecimal characters, representing 128 or 256 random
bits. Generate it cryptographically. Addresses are single ASCII bare mailboxes
with multiple domain labels; preparation normalizes their case. Wire addresses
and UUIDs are lowercase. Times use canonical UTC milliseconds. Expiry is exactly
600,000 milliseconds after issuance and the reply copies that fixed expiry.

Parsing returns valid, unsupported or invalid, retains exact source, rejects
duplicate decoded JSON keys, extensions, malformed dates and identity fields,
and limits JSON to 4 KiB. Expired envelopes still have valid syntax. The caller
checks current binding, authenticated issuer and server freshness before preparing
or sending a reply. The alive helper's local clock only records preparation time;
it never decides or renews freshness.

Preparation returns waiting_on_parent without creating IDs when the original
Message-ID is unavailable, or a prepared snapshot with account scope,
preparation/expiry times, idempotency key and complete request JSON. Persist the
prepared value before sending. Forward its explicit key unchanged as
`Idempotency-Key` through the ordinary `sendEmail` operation. Retry the same
request/key and reconcile uncertain outcomes; re-preparation is a new observation,
not a retry. Helpers do not follow incoming Reply-To or infer another account.

Carriers contain one `application/json` attachment, fixed subject and plain text,
and no HTML, copied recipients or extra headers. Their decoded content is bounded
to 8 KiB. Preparation reserves 4 KiB for MIME/transport overhead inside a 16 KiB
rendering budget; the sending/receiving host must also enforce the actual rendered
mail limit. Mixed messages must remain ordinary mail. A successful roundtrip
establishes recent receipt through the authenticated adapter, not model
responsiveness or continuous availability. This proposed convention does not yet
claim cross-provider interoperability.
