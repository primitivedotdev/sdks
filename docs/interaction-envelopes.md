# Reading interaction envelopes

An `interaction.json` attachment carries a protocol step. The portable parser
checks its JSON and envelope shape for display. It makes no requests, sends no
mail, verifies no identity or signature, and makes no payment or protocol-state
decision. Treat the payload and every displayed field as untrusted data.

The shape follows the public [x402 over email guide](https://docs.primitive.dev/docs/x402-over-email)
and the existing `InteractionEnvelope` type. Unknown protocol names and protocol
versions remain valid; an unknown positive integer `interaction_version` returns
`unsupported`. Version 1 requires the snake_case envelope fields, UUID step IDs,
a `uuid@domain` interaction ID, nonblank protocol and step, a positive integer
protocol version, nullable previous step and expiry, and a JSON payload of any
shape. Extra fields remain data. Expiry is a string or null; the generic parser
does not interpret its date or decide whether a step has expired.

```ts
import { parseInteractionEnvelope, validateInteractionEnvelope } from '@primitivedotdev/sdk/interactions';

const result = parseInteractionEnvelope(attachmentBytes); // string | Uint8Array
if (result.status === 'valid') {
  display(result.envelope.protocol, result.envelope.step);
} else if (result.status === 'unsupported') {
  displayUnsupportedVersion(result.version);
} else {
  displayInvalidAttachment(result.reason);
}
```

Successful source parsing retains the exact input text in `result.source.text`.
Byte input also retains a defensive copy in `result.source.bytes`; string input
cannot establish original transport bytes. Decoded envelopes are independent of
the retained source. Reserializing or editing an envelope does not preserve the
original bytes or establish authenticity.

Python has `parse_interaction_envelope(str | bytes)` and
`validate_interaction_envelope(object)` in `primitive.interactions`. Results have
`status`, `envelope`, `version`, `reason`, `text`, and `source_bytes` attributes.
Go has `ParseInteractionEnvelope([]byte)`, `ParseInteractionEnvelopeString(string)`
and `ValidateInteractionEnvelope(any)` in the root package, with corresponding
`Status`, `Envelope`, `Version`, `Reason`, and `Source` fields.

All parsers return `valid`, `unsupported`, or `invalid`. Input is limited to
65,536 UTF-8 bytes, including whitespace, and 64 nested objects/arrays, counting
the root. They reject invalid UTF-8, a byte-order mark, lone Unicode surrogates,
duplicate decoded keys at any depth, non-JSON syntax, nonfinite numbers, integer
values outside JavaScript's safe integer range, and number tokens longer than
128 characters. Other JSON numbers use IEEE-754 binary64 and may be rounded;
the retained source is the place to preserve exact spelling. Prototype-related
keys are ordinary data, never merged into another object.

Decoded-object validation is a separate convenience. It checks a bounded
snapshot of plain JSON data and returns no original source. Its 65,536-unit
work budget counts UTF-8 string/key bytes plus one unit per value and key; this
is a work limit, not a measurement of serialized bytes. It cannot detect
duplicate keys, number spellings or bytes already lost by an earlier decoder.
JavaScript accessors, custom prototypes, symbols, sparse arrays and cycles are
rejected. Python accepts builtin dict/list/scalars; Go accepts decoded
`map[string]any`/`[]any`/scalars, plus `int`, `int64` and `json.Number`. Application
objects must first be converted deliberately to JSON data. Validation does not
invoke their serialization hooks.
